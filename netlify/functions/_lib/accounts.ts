import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./crypto";
import type { Account, AccountRole, PublicAccount } from "../../../types/account";

export interface BlobStore {
  setJSON(key: string, value: unknown): Promise<void>;
  get(key: string): Promise<unknown>;
  list(options: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
}

// Netlify Blobs renvoie du texte par défaut : on force la lecture en JSON pour tous les stores.
export function jsonStore(name: string): BlobStore {
  const store = getStore(name);
  return {
    setJSON: (key, value) => store.setJSON(key, value).then(() => undefined),
    get: (key) => store.get(key, { type: "json" }),
    list: (options) => store.list(options),
  };
}

function defaultStore(): BlobStore {
  return jsonStore("agrotruck-accounts");
}

export async function createAccount(
  input: { phone: string; displayName: string; password: string; role: AccountRole },
  store: BlobStore = defaultStore(),
): Promise<Account> {
  const account: Account = {
    id: randomUUID(),
    phone: input.phone,
    displayName: input.displayName,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  await store.setJSON(`by-id/${account.id}`, account);
  await store.setJSON(`by-phone/${normalizePhone(input.phone)}`, account.id);
  return account;
}

export async function findAccountByPhone(phone: string, store: BlobStore = defaultStore()): Promise<Account | null> {
  const id = (await store.get(`by-phone/${normalizePhone(phone)}`)) as string | null;
  if (!id) return null;
  const account = await findAccountById(id, store);
  // Un changement de numéro laisse l'ancien index en place : on ne le suit que s'il correspond encore.
  return account && normalizePhone(account.phone) === normalizePhone(phone) ? account : null;
}

export async function findAccountById(id: string, store: BlobStore = defaultStore()): Promise<Account | null> {
  return ((await store.get(`by-id/${id}`)) as Account | null) ?? null;
}

export async function listAccounts(role: AccountRole | undefined, store: BlobStore = defaultStore()): Promise<PublicAccount[]> {
  const { blobs } = await store.list({ prefix: "by-id/" });
  const accounts = (await Promise.all(blobs.map(({ key }) => store.get(key) as Promise<Account>)));
  return accounts
    .filter((account): account is Account => Boolean(account) && (!role || account.role === role))
    .map(toPublicAccount);
}

export function toPublicAccount(account: Account): PublicAccount {
  const copy: Partial<Account> = { ...account };
  delete copy.passwordHash;
  return copy as PublicAccount;
}

export type ProfileInput = Partial<Pick<Account,
  "displayName" | "phone" | "companyName" | "vehicleCategories" | "vehicleCapacityTons" | "workZones" | "mainZone" | "mainLocation">>;

const commonProfileFields = ["displayName", "phone", "companyName"] as const;
const profileFieldsByRole: Record<AccountRole, readonly (keyof ProfileInput)[]> = {
  admin: commonProfileFields,
  partner: [...commonProfileFields, "vehicleCategories", "vehicleCapacityTons", "workZones"],
  producer: [...commonProfileFields, "mainZone", "mainLocation"],
};

export type ProfileResult = { ok: true; account: Account } | { ok: false; status: 404 | 409; error: string };

export async function updateProfile(id: string, input: ProfileInput, store: BlobStore = defaultStore()): Promise<ProfileResult> {
  const account = await findAccountById(id, store);
  if (!account) return { ok: false, status: 404, error: "Compte introuvable" };
  const patch = Object.fromEntries(
    profileFieldsByRole[account.role].filter((field) => input[field] !== undefined).map((field) => [field, input[field]]),
  ) as ProfileInput;
  if (patch.phone && normalizePhone(patch.phone) !== normalizePhone(account.phone)) {
    if (await findAccountByPhone(patch.phone, store)) return { ok: false, status: 409, error: "Ce numéro a déjà un compte" };
    await store.setJSON(`by-phone/${normalizePhone(patch.phone)}`, account.id);
  }
  const updated: Account = { ...account, ...patch, updatedAt: new Date().toISOString() };
  await store.setJSON(`by-id/${id}`, updated);
  return { ok: true, account: updated };
}

async function patchAccount(id: string, patch: Partial<Account>, store: BlobStore): Promise<Account | null> {
  const account = await findAccountById(id, store);
  if (!account) return null;
  const updated: Account = { ...account, ...patch, updatedAt: new Date().toISOString() };
  await store.setJSON(`by-id/${id}`, updated);
  return updated;
}

export function setAccountDisabled(id: string, disabled: boolean, store: BlobStore = defaultStore()): Promise<Account | null> {
  return patchAccount(id, { disabled }, store);
}

export async function setAccountPassword(id: string, password: string, store: BlobStore = defaultStore()): Promise<Account | null> {
  return patchAccount(id, { passwordHash: await hashPassword(password) }, store);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

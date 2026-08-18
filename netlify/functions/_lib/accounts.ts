import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./crypto";
import type { Account, AccountRole, PublicAccount } from "../../../types/account";

export interface BlobStore {
  setJSON(key: string, value: unknown): Promise<void>;
  get(key: string): Promise<unknown>;
  list(options: { prefix: string }): Promise<{ blobs: { key: string }[] }>;
}

function defaultStore(): BlobStore {
  return getStore("agrotruck-accounts") as unknown as BlobStore;
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
  return findAccountById(id, store);
}

export async function findAccountById(id: string, store: BlobStore = defaultStore()): Promise<Account | null> {
  return ((await store.get(`by-id/${id}`)) as Account | null) ?? null;
}

export async function listAccounts(role: AccountRole | undefined, store: BlobStore = defaultStore()): Promise<PublicAccount[]> {
  const { blobs } = await store.list({ prefix: "by-id/" });
  const accounts = (await Promise.all(blobs.map(({ key }) => store.get(key) as Promise<Account>)));
  return accounts
    .filter((account): account is Account => Boolean(account) && (!role || account.role === role))
    .map((account): PublicAccount => ({ id: account.id, phone: account.phone, role: account.role, displayName: account.displayName, createdAt: account.createdAt }));
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

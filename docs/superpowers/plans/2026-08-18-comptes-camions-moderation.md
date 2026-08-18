# Comptes, camions & modération partenaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only, externally-sourced truck directory with a system where Badora (admin) and invited partners publish trucks through the app itself, Badora validates every listing before it goes public, and the public site presents everything under one unified "AgroTrucks by Badora" brand with no price and no partner identity shown.

**Architecture:** Next.js stays a static export (`output: "export"` in `next.config.ts` — unchanged, unmodifiable in this plan) deployed on Netlify. All server logic (accounts, sessions, truck CRUD, moderation) lives in Netlify Functions backed by Netlify Blobs, exactly the pattern `netlify/functions/reviews.mts` already established. Public pages (`/`, `/trucks`, `/trucks/[slug]`, `/location`) keep being statically generated at build time — `lib/truck-directory.ts` now fetches from our own `trucks` Netlify Function instead of an external API, and every truck mutation (create, publish, reject, availability change) fires a Netlify Build Hook so the public static pages pick up the change within a normal deploy cycle. Authenticated tooling (`/login`, `/partner/*`, `/admin/*`) is fully client-rendered and always calls the Netlify Functions directly at runtime, so Badora's fleet view is never stale regardless of build timing — this is where the "coup d'œil" promise from the pitch actually lives. Because static export cannot serve arbitrary dynamic route segments without listing them at build time, every authenticated edit/review screen uses a static route with an `?id=` query string (e.g. `/partner/trucks/edit?id=…`) instead of a `[id]` folder.

**Tech Stack:** Next.js 16 (static export), React 19, Tailwind, `@netlify/blobs` (already a dependency), Netlify Functions (`.mts`, Fetch API `Request`/`Response` handlers), Node's built-in `crypto` (scrypt password hashing, HMAC session signing — no new auth library), Zod (already a dependency) for validation, Vitest (new devDependency) for unit tests of pure logic.

**Spec:** `docs/superpowers/specs/2026-08-18-agrotrucks-badora-design.md`

## Global Constraints

- No price field anywhere in the data model, API responses, or UI — carried over unchanged from the current `Truck` schema.
- Public pages never show which partner owns a truck. `ownerName`/`companyName` are stored for Badora's internal use only (admin dashboard) and are never rendered on `/`, `/trucks`, `/trucks/[slug]`, or `/location`.
- No partner self-registration. Only an `admin` account can create a `partner` account (`POST /.netlify/functions/auth?action=create-partner`).
- Changing a truck's `availability` alone never requires re-validation and never changes `listingStatus`.
- Every truck mutation (create, edit, publish, reject, availability change) calls `triggerRebuild()` so public static pages stay in sync. Authenticated dashboards never rely on the static export — they always call the Netlify Functions directly.
- No dynamic Next.js route segments (`[id]`, `[slug]`) may be added for authenticated pages, because `output: "export"` requires every such segment to be enumerable via `generateStaticParams` at build time, which is impossible for content created after deploy. Use `?id=` query-string routes instead.
- Partner truck images are provided as pasted URLs (e.g. a link to a photo already hosted elsewhere). This plan does not build file upload/storage — that is out of scope, matching the spec's "hors scope" section (no mention of upload infra).
- Reuse the existing `whatsappUrl()` helper (`lib/utils.ts`) for every WhatsApp link; do not hand-roll another one.

---

## Task 1: Test tooling + updated `Truck`/`Account` types

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency and `test` script)
- Modify: `types/truck.ts`
- Create: `types/account.ts`
- Create: `types/order.ts` (used by a later plan, defined now alongside the other shared types so `truck.ts`'s `ownerAccountId` has a documented counterpart type)
- Modify: `data/trucks.ts` (found during execution: the demo data used by `lib/truck-directory.ts` when `process.env.URL` is unset still had the old `verified: boolean` shape — each entry's `verified: true/false` was replaced with `ownerAccountId: "demo", listingStatus: "published"` to match the updated `Truck` type; this was not called out as a separate file in the original plan text but is required for `pnpm build`/`tsc` to pass)

**Interfaces:**
- Produces: `Truck` (updated), `TruckListingStatus`, `Account`, `AccountRole`, `Order` — every later task in this plan imports these.

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Add the Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add the `test` script**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 4: Update `types/truck.ts`**

Replace the `Truck` interface (lines 18-42) — remove `verified: boolean`, add `ownerAccountId` and `listingStatus`:

```ts
export type TruckListingStatus = "pending" | "published" | "rejected";

export interface Truck {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  type: TruckType;
  listingMode: ListingMode;
  capacityTons: number;
  location: string;
  serviceAreas: string[];
  acceptedMaterials: string[];
  availability: TruckAvailability;
  availableFrom?: string;
  ownerAccountId: string;
  ownerName: string;
  companyName?: string;
  ownerType: "individual" | "company";
  phone: string;
  whatsapp: string;
  description: string;
  images: string[];
  listingStatus: TruckListingStatus;
  restrictions: string[];
  ratings?: TruckRatings;
}
```

Keep everything else in the file (`TruckAvailability`, `ListingMode`, `TruckType`, `TruckRatings`, the label records) unchanged.

- [ ] **Step 5: Create `types/account.ts`**

```ts
export type AccountRole = "admin" | "partner";

export interface Account {
  id: string;
  phone: string;
  passwordHash: string;
  role: AccountRole;
  displayName: string;
  createdAt: string;
}

export type PublicAccount = Omit<Account, "passwordHash">;
```

- [ ] **Step 6: Create `types/order.ts`**

```ts
export interface Order {
  id: string;
  requestedTruckCount: number;
  truckType: string;
  pickupLocation: string;
  dropoffLocation: string;
  neededFrom: string;
  cargoDescription: string;
  clientName: string;
  clientPhone: string;
  createdAt: string;
}
```

- [ ] **Step 7: Verify the project still type-checks**

Run: `pnpm build 2>&1 | head -n 60` (it will fail — `lib/truck-directory.ts`, `lib/companies.ts`, and every file reading `truck.verified` or `truck.companyName` still reference the old shape. That is expected; those get fixed in later tasks.) Confirm the *only* errors are about `verified` / missing `ownerAccountId` / missing `listingStatus`, not a typo you introduced.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml types/truck.ts types/account.ts types/order.ts
git commit -m "feat: add vitest and update Truck/Account/Order types for the Badora pivot"
```

---

## Task 2: Password hashing & session token helpers

**Files:**
- Create: `netlify/functions/_lib/crypto.ts`
- Test: `netlify/functions/_lib/crypto.test.ts`

**Interfaces:**
- Consumes: `process.env.SESSION_SECRET` (added to `.env.example` in Task 7).
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`, `signSession(payload: SessionPayload): string`, `verifySession(token: string): SessionPayload | null`, `type SessionPayload = { accountId: string; role: "admin" | "partner"; displayName: string }` — consumed by `_lib/session.ts` (Task 3), `auth.mts` (Task 4), `trucks.mts` (Task 6).

- [ ] **Step 1: Write the failing tests**

```ts
// netlify/functions/_lib/crypto.test.ts
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, signSession, verifySession } from "./crypto";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash for the same password each time (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("session tokens", () => {
  const payload = { accountId: "acc-1", role: "admin" as const, displayName: "Badora" };

  it("round-trips a signed session", () => {
    const token = signSession(payload);
    expect(verifySession(token)).toEqual(payload);
  });

  it("rejects a tampered token", () => {
    const token = signSession(payload);
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(verifySession(tampered)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifySession("not-a-real-token")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `./crypto` does not exist yet.

- [ ] **Step 3: Implement `_lib/crypto.ts`**

```ts
// netlify/functions/_lib/crypto.ts
import { randomBytes, scrypt, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHex] = hash.split(":");
  if (!salt || !storedHex) return false;
  const stored = Buffer.from(storedHex, "hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

export interface SessionPayload {
  accountId: string;
  role: "admin" | "partner";
  displayName: string;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return value;
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `SESSION_SECRET=test-secret pnpm test`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/crypto.ts netlify/functions/_lib/crypto.test.ts
git commit -m "feat: add password hashing and session token helpers"
```

---

## Task 3: Session cookie helpers

**Files:**
- Create: `netlify/functions/_lib/session.ts`
- Test: `netlify/functions/_lib/session.test.ts`

**Interfaces:**
- Consumes: `signSession`, `verifySession`, `SessionPayload` from `./crypto` (Task 2).
- Produces: `SESSION_COOKIE_NAME` (`"agrotruck_session"`), `sessionCookieHeader(payload: SessionPayload): string`, `clearSessionCookieHeader(): string`, `getSessionFromRequest(request: Request): SessionPayload | null` — consumed by `auth.mts` (Task 4) and `trucks.mts` (Task 6).

- [ ] **Step 1: Write the failing tests**

```ts
// netlify/functions/_lib/session.test.ts
import { describe, expect, it } from "vitest";
import { sessionCookieHeader, clearSessionCookieHeader, getSessionFromRequest, SESSION_COOKIE_NAME } from "./session";

const payload = { accountId: "acc-1", role: "admin" as const, displayName: "Badora" };

describe("session cookies", () => {
  it("round-trips a session through a Set-Cookie header and a Cookie request header", () => {
    const setCookie = sessionCookieHeader(payload);
    const token = setCookie.split(";")[0].split("=")[1];
    const request = new Request("https://example.com", { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } });
    expect(getSessionFromRequest(request)).toEqual(payload);
  });

  it("returns null when there is no cookie", () => {
    expect(getSessionFromRequest(new Request("https://example.com"))).toBeNull();
  });

  it("returns null for an unrelated cookie", () => {
    const request = new Request("https://example.com", { headers: { Cookie: "other=value" } });
    expect(getSessionFromRequest(request)).toBeNull();
  });

  it("clearSessionCookieHeader expires the cookie immediately", () => {
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `./session` does not exist yet.

- [ ] **Step 3: Implement `_lib/session.ts`**

```ts
// netlify/functions/_lib/session.ts
import { signSession, verifySession, type SessionPayload } from "./crypto";

export const SESSION_COOKIE_NAME = "agrotruck_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieHeader(payload: SessionPayload): string {
  const token = signSession(payload);
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;
  return verifySession(match.slice(SESSION_COOKIE_NAME.length + 1));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `SESSION_SECRET=test-secret pnpm test`
Expected: PASS (all 10 tests across both files)

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_lib/session.ts netlify/functions/_lib/session.test.ts
git commit -m "feat: add session cookie read/write helpers"
```

---

## Task 4: Accounts store + seed script

**Files:**
- Create: `netlify/functions/_lib/accounts.ts`
- Test: `netlify/functions/_lib/accounts.test.ts`
- Create: `scripts/seed-admin.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` from `./crypto` (Task 2); `Account`, `AccountRole` from `types/account.ts` (Task 1); `getStore` from `@netlify/blobs`.
- Produces: `createAccount(input: { phone: string; displayName: string; password: string; role: AccountRole }): Promise<Account>`, `findAccountByPhone(phone: string): Promise<Account | null>`, `findAccountById(id: string): Promise<Account | null>`, `listAccounts(role?: AccountRole): Promise<PublicAccount[]>` — consumed by `auth.mts` (Task 5) and `trucks.mts` (Task 6).

- [ ] **Step 1: Write the failing tests**

The Blobs store needs to be swappable for a test double. `getStore` from `@netlify/blobs` throws outside a Netlify context, so the store module accepts an injected store for tests via a second parameter, defaulting to the real one in production.

```ts
// netlify/functions/_lib/accounts.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { createAccount, findAccountByPhone, findAccountById, listAccounts, type BlobStore } from "./accounts";

function fakeStore(): BlobStore {
  const data = new Map<string, string>();
  return {
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)!) : null; },
    async list({ prefix }: { prefix: string }) { return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}

describe("accounts store", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("creates an account with a hashed password and finds it by phone", async () => {
    const created = await createAccount({ phone: "+245955000200", displayName: "Transportes Djaló", password: "hunter2", role: "partner" }, store);
    expect(created.passwordHash).not.toContain("hunter2");
    const found = await findAccountByPhone("+245955000200", store);
    expect(found?.id).toBe(created.id);
  });

  it("finds an account by id", async () => {
    const created = await createAccount({ phone: "+245955000201", displayName: "Badora", password: "hunter2", role: "admin" }, store);
    const found = await findAccountById(created.id, store);
    expect(found?.displayName).toBe("Badora");
  });

  it("returns null for an unknown phone or id", async () => {
    expect(await findAccountByPhone("+245900000000", store)).toBeNull();
    expect(await findAccountById("missing", store)).toBeNull();
  });

  it("lists accounts without exposing password hashes, optionally filtered by role", async () => {
    await createAccount({ phone: "+245955000202", displayName: "Badora", password: "x", role: "admin" }, store);
    await createAccount({ phone: "+245955000203", displayName: "Parceiro A", password: "x", role: "partner" }, store);
    const partners = await listAccounts("partner", store);
    expect(partners).toHaveLength(1);
    expect(partners[0]).not.toHaveProperty("passwordHash");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `./accounts` does not exist yet.

- [ ] **Step 3: Implement `_lib/accounts.ts`**

```ts
// netlify/functions/_lib/accounts.ts
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
    .map(({ passwordHash: _passwordHash, ...account }) => account);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Write the admin seed script**

```ts
// scripts/seed-admin.ts
import { createAccount, findAccountByPhone } from "../netlify/functions/_lib/accounts";

async function main() {
  const phone = process.argv[2];
  const displayName = process.argv[3];
  const password = process.argv[4];
  if (!phone || !displayName || !password) {
    console.error("Usage: tsx scripts/seed-admin.ts <phone> <displayName> <password>");
    process.exit(1);
  }
  const existing = await findAccountByPhone(phone);
  if (existing) {
    console.error(`Un compte existe déjà pour ${phone} (id: ${existing.id})`);
    process.exit(1);
  }
  const account = await createAccount({ phone, displayName, password, role: "admin" });
  console.log(`Compte admin créé : ${account.displayName} (${account.phone}), id ${account.id}`);
}

main();
```

Add to `package.json` `"scripts"`: `"seed:admin": "tsx scripts/seed-admin.ts"`.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/accounts.ts netlify/functions/_lib/accounts.test.ts scripts/seed-admin.ts package.json
git commit -m "feat: add accounts store and admin seed script"
```

---

## Task 5: `auth.mts` Netlify Function

**Files:**
- Create: `netlify/functions/auth.mts`

**Interfaces:**
- Consumes: `createAccount`, `findAccountByPhone`, `findAccountById`, `listAccounts` from `./_lib/accounts`; `verifyPassword` from `./_lib/crypto`; `sessionCookieHeader`, `clearSessionCookieHeader`, `getSessionFromRequest` from `./_lib/session`.
- Produces: the public HTTP contract used by every page built in Tasks 8-10 — `POST ?action=login` `{phone, password}` → `200 {role, displayName}` + session cookie, or `401`; `POST ?action=logout` → `200` + cleared cookie; `GET ?action=session` → `200 {accountId, role, displayName}` or `401`; `POST ?action=create-partner` (admin session required) `{phone, displayName, password}` → `201 {id, phone, displayName, role}` or `403`; `GET ?action=list-partners` (admin session required) → `200 PublicAccount[]`.

- [ ] **Step 1: Implement `auth.mts`**

```ts
// netlify/functions/auth.mts
import { createAccount, findAccountByPhone, findAccountById, listAccounts } from "./_lib/accounts";
import { verifyPassword } from "./_lib/crypto";
import { sessionCookieHeader, clearSessionCookieHeader, getSessionFromRequest } from "./_lib/session";

const handler = async (request: Request) => {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "GET" && action === "session") return handleSession(request);
  if (request.method === "GET" && action === "list-partners") return handleListPartners(request);
  if (request.method === "POST" && action === "login") return handleLogin(request);
  if (request.method === "POST" && action === "logout") return handleLogout();
  if (request.method === "POST" && action === "create-partner") return handleCreatePartner(request);
  return json({ error: "Action invalide" }, 400);
};

export default handler;

async function handleSession(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const account = await findAccountById(session.accountId);
  if (!account) return json({ error: "Non connecté" }, 401);
  return json({ accountId: account.id, role: account.role, displayName: account.displayName });
}

async function handleLogin(request: Request) {
  const body = (await request.json().catch(() => null)) as { phone?: string; password?: string } | null;
  if (!body?.phone || !body.password) return json({ error: "Téléphone et mot de passe requis" }, 400);
  const account = await findAccountByPhone(body.phone);
  if (!account || !(await verifyPassword(body.password, account.passwordHash))) return json({ error: "Identifiants invalides" }, 401);
  return json(
    { role: account.role, displayName: account.displayName },
    200,
    { "Set-Cookie": sessionCookieHeader({ accountId: account.id, role: account.role, displayName: account.displayName }) },
  );
}

function handleLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
}

async function handleCreatePartner(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  const body = (await request.json().catch(() => null)) as { phone?: string; displayName?: string; password?: string } | null;
  if (!body?.phone || !body.displayName || !body.password) return json({ error: "Champs manquants" }, 400);
  if (await findAccountByPhone(body.phone)) return json({ error: "Ce numéro a déjà un compte" }, 409);
  const account = await createAccount({ phone: body.phone, displayName: body.displayName, password: body.password, role: "partner" });
  return json({ id: account.id, phone: account.phone, displayName: account.displayName, role: account.role }, 201);
}

async function handleListPartners(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  return json(await listAccounts("partner"));
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
```

- [ ] **Step 2: Verify it locally**

Run: `netlify dev` (installs/uses the Netlify CLI already implied by this being a Netlify-deployed project; if `netlify` is not on PATH, run `npx netlify-cli dev`).

With the dev server running and `SESSION_SECRET` set in `.env.local`, seed an admin and log in:

```bash
SESSION_SECRET=dev-secret pnpm seed:admin +245955000100 Badora "un-mot-de-passe-fort"
curl -i -X POST "http://localhost:8888/.netlify/functions/auth?action=login" -H "content-type: application/json" -d '{"phone":"+245955000100","password":"un-mot-de-passe-fort"}'
```

Expected: `200`, a `Set-Cookie: agrotruck_session=…` header, and body `{"role":"admin","displayName":"Badora"}`. Re-run with the wrong password and confirm `401`.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/auth.mts
git commit -m "feat: add auth Netlify Function (login, logout, session, partner creation)"
```

---

## Task 6: Truck store + rebuild trigger

**Files:**
- Create: `netlify/functions/_lib/trucks.ts`
- Test: `netlify/functions/_lib/trucks.test.ts`
- Create: `netlify/functions/_lib/rebuild.ts`

**Interfaces:**
- Consumes: `Truck`, `TruckListingStatus` from `types/truck.ts` (Task 1).
- Produces: `createTruck(input, ownerAccountId, store?): Promise<Truck>`, `updateTruck(id, patch, store?): Promise<Truck | null>`, `setListingStatus(id, status, store?): Promise<Truck | null>`, `findTruckById(id, store?): Promise<Truck | null>`, `listPublishedTrucks(store?): Promise<Truck[]>`, `listTrucksByOwner(ownerAccountId, store?): Promise<Truck[]>`, `listAllTrucks(store?): Promise<Truck[]>` (admin fleet + moderation views), `triggerRebuild(): void` — consumed by `trucks.mts` (Task 7) and every dashboard page (Tasks 9-10, via the function's HTTP contract, not these directly).

- [ ] **Step 1: Write the failing tests**

```ts
// netlify/functions/_lib/trucks.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { createTruck, updateTruck, setListingStatus, findTruckById, listPublishedTrucks, listTrucksByOwner, listAllTrucks } from "./trucks";
import type { BlobStore } from "./accounts";

function fakeStore(): BlobStore {
  const data = new Map<string, string>();
  return {
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)!) : null; },
    async list({ prefix }: { prefix: string }) { return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}

const baseInput = {
  name: "Scania R450 Plateau", brand: "Scania", model: "R450", type: "flatbed" as const, listingMode: "transport" as const,
  capacityTons: 32, location: "Bissau", serviceAreas: ["Bissau"], acceptedMaterials: ["Castanha de caju"],
  availability: "available" as const, ownerName: "Mamadú Baldé", ownerType: "company" as const, phone: "+245955123456",
  whatsapp: "+245955123456", description: "Plataforma de longa distância.", images: ["https://example.com/a.jpg"], restrictions: [],
};

describe("truck store", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("creates a truck as pending, owned by the creator", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    expect(truck.listingStatus).toBe("pending");
    expect(truck.ownerAccountId).toBe("acc-partner-1");
    expect(await findTruckById(truck.id, store)).toEqual(truck);
  });

  it("only published trucks show up in listPublishedTrucks", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    expect(await listPublishedTrucks(store)).toHaveLength(0);
    await setListingStatus(truck.id, "published", store);
    expect(await listPublishedTrucks(store)).toHaveLength(1);
  });

  it("updating availability alone does not change listingStatus", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    await setListingStatus(truck.id, "published", store);
    const updated = await updateTruck(truck.id, { availability: "in_transit" }, store);
    expect(updated?.availability).toBe("in_transit");
    expect(updated?.listingStatus).toBe("published");
  });

  it("updating a core field resets the truck to pending", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    await setListingStatus(truck.id, "published", store);
    const updated = await updateTruck(truck.id, { capacityTons: 40 }, store);
    expect(updated?.listingStatus).toBe("pending");
  });

  it("lists trucks by owner regardless of status", async () => {
    await createTruck(baseInput, "acc-partner-1", store);
    await createTruck(baseInput, "acc-partner-2", store);
    expect(await listTrucksByOwner("acc-partner-1", store)).toHaveLength(1);
  });

  it("listAllTrucks returns every truck for the admin fleet view", async () => {
    await createTruck(baseInput, "acc-partner-1", store);
    await createTruck(baseInput, "acc-partner-2", store);
    expect(await listAllTrucks(store)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `./trucks` does not exist yet.

- [ ] **Step 3: Implement `_lib/trucks.ts`**

```ts
// netlify/functions/_lib/trucks.ts
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import type { Truck, TruckListingStatus } from "../../../types/truck";
import type { BlobStore } from "./accounts";

function defaultStore(): BlobStore {
  return getStore("agrotruck-trucks") as unknown as BlobStore;
}

type TruckInput = Omit<Truck, "id" | "slug" | "ownerAccountId" | "listingStatus">;

const AVAILABILITY_ONLY_FIELDS = new Set(["availability", "availableFrom"]);

export async function createTruck(input: TruckInput, ownerAccountId: string, store: BlobStore = defaultStore()): Promise<Truck> {
  const truck: Truck = { ...input, id: randomUUID(), slug: slugify(input.name), ownerAccountId, listingStatus: "pending" };
  await store.setJSON(`by-id/${truck.id}`, truck);
  return truck;
}

export async function updateTruck(id: string, patch: Partial<TruckInput>, store: BlobStore = defaultStore()): Promise<Truck | null> {
  const existing = await findTruckById(id, store);
  if (!existing) return null;
  const onlyAvailabilityChanged = Object.keys(patch).every((key) => AVAILABILITY_ONLY_FIELDS.has(key));
  const updated: Truck = {
    ...existing,
    ...patch,
    listingStatus: onlyAvailabilityChanged ? existing.listingStatus : ("pending" as TruckListingStatus),
  };
  await store.setJSON(`by-id/${id}`, updated);
  return updated;
}

export async function setListingStatus(id: string, status: TruckListingStatus, store: BlobStore = defaultStore()): Promise<Truck | null> {
  const existing = await findTruckById(id, store);
  if (!existing) return null;
  const updated: Truck = { ...existing, listingStatus: status };
  await store.setJSON(`by-id/${id}`, updated);
  return updated;
}

export async function findTruckById(id: string, store: BlobStore = defaultStore()): Promise<Truck | null> {
  return ((await store.get(`by-id/${id}`)) as Truck | null) ?? null;
}

export async function listAllTrucks(store: BlobStore = defaultStore()): Promise<Truck[]> {
  const { blobs } = await store.list({ prefix: "by-id/" });
  const trucks = await Promise.all(blobs.map(({ key }) => store.get(key) as Promise<Truck>));
  return trucks.filter((truck): truck is Truck => Boolean(truck));
}

export async function listPublishedTrucks(store: BlobStore = defaultStore()): Promise<Truck[]> {
  return (await listAllTrucks(store)).filter((truck) => truck.listingStatus === "published");
}

export async function listTrucksByOwner(ownerAccountId: string, store: BlobStore = defaultStore()): Promise<Truck[]> {
  return (await listAllTrucks(store)).filter((truck) => truck.ownerAccountId === ownerAccountId);
}

function slugify(value: string) {
  const base = value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base}-${randomUUID().slice(0, 6)}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Implement the rebuild trigger**

```ts
// netlify/functions/_lib/rebuild.ts
export function triggerRebuild(): void {
  const hookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!hookUrl) {
    console.warn("NETLIFY_BUILD_HOOK_URL is not set; skipping rebuild trigger");
    return;
  }
  fetch(hookUrl, { method: "POST" }).catch((error) => console.error("Failed to trigger Netlify rebuild", error));
}
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_lib/trucks.ts netlify/functions/_lib/trucks.test.ts netlify/functions/_lib/rebuild.ts
git commit -m "feat: add truck store with pending/published/rejected workflow and rebuild trigger"
```

---

## Task 7: `trucks.mts` Netlify Function

**Files:**
- Create: `netlify/functions/trucks.mts`

**Interfaces:**
- Consumes: everything from `./_lib/trucks` (Task 6), `triggerRebuild` from `./_lib/rebuild` (Task 6), `getSessionFromRequest` from `./_lib/session` (Task 3), `z` from `zod`.
- Produces the HTTP contract used by `lib/truck-directory.ts` (Task 8) and every dashboard (Tasks 9-10):
  - `GET` (no auth) → published trucks, with `ownerAccountId`/`ownerName`/`companyName` stripped from the response (public callers never see who owns a truck). `GET ?slug=` → single published truck, same stripping, or `404`.
  - `GET ?mine=1` (auth required) → the caller's own trucks, any status, full fields.
  - `GET ?scope=fleet` (admin only) → every truck, full fields, for the admin dashboard.
  - `GET ?status=pending` (admin only) → the moderation queue.
  - `POST` (auth required) → create a truck (`listingStatus: "pending"`, no rebuild — it is not public yet).
  - `PATCH?id=` (auth required, must own the truck or be admin) → update; triggers rebuild.
  - `POST ?id=&action=publish` / `?action=reject` (admin only) → triggers rebuild.

- [ ] **Step 1: Implement `trucks.mts`**

```ts
// netlify/functions/trucks.mts
import { z } from "zod";
import {
  createTruck, updateTruck, setListingStatus, findTruckById,
  listPublishedTrucks, listTrucksByOwner, listAllTrucks,
} from "./_lib/trucks";
import { triggerRebuild } from "./_lib/rebuild";
import { getSessionFromRequest } from "./_lib/session";
import type { Truck } from "../../types/truck";

const truckInputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().default(""),
  model: z.string().default(""),
  type: z.enum(["flatbed", "covered", "dump_truck", "cargo", "refrigerated", "tanker", "container", "crane", "pickup", "cargo_tricycle", "road_tractor", "flatbed_trailer", "covered_trailer", "agricultural_tractor", "farm_trailer", "loader", "road_machine", "private_taxi", "shared_taxi", "seven_seater", "toca_toca", "minibus", "candonga", "coach", "suv", "chauffeur_car"]),
  listingMode: z.enum(["transport", "rental", "sale"]).default("transport"),
  capacityTons: z.coerce.number().nonnegative(),
  location: z.string().min(1),
  serviceAreas: z.array(z.string()).default([]),
  acceptedMaterials: z.array(z.string()).default([]),
  availability: z.enum(["available", "in_transit", "maintenance"]).default("available"),
  availableFrom: z.string().optional(),
  ownerName: z.string().min(1),
  companyName: z.string().optional(),
  ownerType: z.enum(["individual", "company"]),
  phone: z.string().min(1),
  whatsapp: z.string().min(1),
  description: z.string().default(""),
  images: z.array(z.string().url()).min(1),
  restrictions: z.array(z.string()).default([]),
});

const handler = async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === "GET") return handleGet(request, url);
  if (request.method === "POST" && url.searchParams.get("id")) return handleModerate(request, url);
  if (request.method === "POST") return handleCreate(request);
  if (request.method === "PATCH") return handleUpdate(request, url);
  return json({ error: "Méthode non autorisée" }, 405);
};

export default handler;

async function handleGet(request: Request, url: URL) {
  const session = getSessionFromRequest(request);

  if (url.searchParams.get("mine")) {
    if (!session) return json({ error: "Non connecté" }, 401);
    return json(await listTrucksByOwner(session.accountId));
  }

  if (url.searchParams.get("scope") === "fleet") {
    if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
    return json(await listAllTrucks());
  }

  if (url.searchParams.get("status") === "pending") {
    if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
    return json((await listAllTrucks()).filter((truck) => truck.listingStatus === "pending"));
  }

  const slug = url.searchParams.get("slug");
  const published = await listPublishedTrucks();
  if (slug) {
    const truck = published.find((candidate) => candidate.slug === slug);
    return truck ? json(stripOwner(truck)) : json({ error: "Camion introuvable" }, 404);
  }
  return json(published.map(stripOwner));
}

async function handleCreate(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const parsed = truckInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  const truck = await createTruck(parsed.data, session.accountId);
  return json(truck, 201);
}

async function handleUpdate(request: Request, url: URL) {
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id requis" }, 400);
  const session = getSessionFromRequest(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const existing = await findTruckById(id);
  if (!existing) return json({ error: "Camion introuvable" }, 404);
  if (existing.ownerAccountId !== session.accountId && session.role !== "admin") return json({ error: "Interdit" }, 403);
  const parsed = truckInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  const updated = await updateTruck(id, parsed.data);
  triggerRebuild();
  return json(updated);
}

async function handleModerate(request: Request, url: URL) {
  const session = getSessionFromRequest(request);
  if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  const id = url.searchParams.get("id")!;
  const action = url.searchParams.get("action");
  if (action !== "publish" && action !== "reject") return json({ error: "Action invalide" }, 400);
  const updated = await setListingStatus(id, action === "publish" ? "published" : "rejected");
  if (!updated) return json({ error: "Camion introuvable" }, 404);
  triggerRebuild();
  return json(updated);
}

function stripOwner(truck: Truck) {
  const { ownerAccountId: _ownerAccountId, ownerName: _ownerName, companyName: _companyName, ...publicTruck } = truck;
  return publicTruck;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
```

- [ ] **Step 2: Verify it locally**

With `netlify dev` running and the admin session cookie from Task 5's verification step:

```bash
curl -s "http://localhost:8888/.netlify/functions/trucks" | jq
curl -s -X POST "http://localhost:8888/.netlify/functions/trucks" -b "agrotruck_session=<token>" -H "content-type: application/json" -d '{"name":"Scania R450","brand":"Scania","model":"R450","type":"flatbed","capacityTons":32,"location":"Bissau","ownerName":"Badora","ownerType":"company","phone":"+245955000100","whatsapp":"+245955000100","images":["https://example.com/a.jpg"]}'
```

Expected: the `GET` returns `[]` (nothing published yet); the `POST` returns `201` with `"listingStatus":"pending"`. Confirm the same `POST` without the cookie returns `401`.

- [ ] **Step 3: Commit**

```bash
git add netlify/functions/trucks.mts
git commit -m "feat: add trucks Netlify Function (public read, authenticated write, admin moderation)"
```

---

## Task 8: Rewire `lib/truck-directory.ts` to the new Function; retire the external API

**Files:**
- Modify: `lib/truck-directory.ts`
- Delete: `lib/companies.ts`, `types/company.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `getSiteUrl()` from `lib/site-url.ts` (unchanged).
- Produces: `listTrucks(): Promise<Truck[]>`, `findTruckBySlug(slug: string): Promise<Truck | undefined>` — same signatures as today, so `app/page.tsx`, `app/trucks/page.tsx`, `app/location/page.tsx`, `app/trucks/[slug]/page.tsx` need no changes in this task. `listCompanies`/`findCompanyBySlug` are removed (their only callers are deleted in Task 11 — until then the build will show unused-import errors, which is expected and resolved by Task 11).

- [ ] **Step 1: Replace `lib/truck-directory.ts`**

```ts
// lib/truck-directory.ts
import "server-only";

import { z } from "zod";
import { trucks as demoTrucks } from "@/data/trucks";
import { getSiteUrl } from "@/lib/site-url";
import type { Truck, TruckAvailability, TruckType } from "@/types/truck";

const truckSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default(""),
  model: z.string().default(""),
  type: z.string(),
  listingMode: z.enum(["transport", "rental", "sale"]).default("transport"),
  capacityTons: z.coerce.number().nonnegative(),
  location: z.string().min(1),
  serviceAreas: z.array(z.string()).default([]),
  acceptedMaterials: z.array(z.string()).default([]),
  availability: z.string(),
  availableFrom: z.string().optional(),
  phone: z.string().min(1),
  whatsapp: z.string().min(1),
  description: z.string().default(""),
  images: z.array(z.string().min(1)).default([]),
  restrictions: z.array(z.string()).default([]),
  ratings: z.object({ overall: z.number(), vehicleQuality: z.number(), professionalism: z.number(), reliability: z.number(), reviewCount: z.number().int().nonnegative() }).optional(),
});

const responseSchema = z.array(truckSchema);

export async function listTrucks(): Promise<Truck[]> {
  if (!process.env.URL) return demoTrucks;

  try {
    const response = await fetch(`${getSiteUrl()}/.netlify/functions/trucks`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Fonction trucks : ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Réponse de la fonction trucks invalide");
    return parsed.data.map(toTruck);
  } catch (error) {
    console.error("Fonction AgroTrucks indisponible au build", error);
    return [];
  }
}

export async function findTruckBySlug(slug: string): Promise<Truck | undefined> {
  return (await listTrucks()).find((truck) => truck.slug === slug);
}

function toTruck(truck: z.infer<typeof truckSchema>): Truck {
  return {
    ...truck,
    type: truck.type as TruckType,
    availability: truck.availability as TruckAvailability,
    ownerAccountId: "",
    ownerName: "AgroTrucks by Badora",
    ownerType: "company",
    listingStatus: "published",
    images: truck.images.length ? truck.images : ["/brand/agrotruck-truck-placeholder.png"],
  };
}
```

Public responses from `trucks.mts` never include `ownerAccountId`/`ownerName`/`companyName` (stripped in Task 7), so `toTruck` fills in a fixed, brand-only `ownerName` rather than trusting per-truck data — this is what makes "no partner identity on public pages" hold even if a future bug in the Function forgot to strip a field.

- [ ] **Step 2: Delete the company grouping module and its type**

```bash
git rm lib/companies.ts types/company.ts
```

- [ ] **Step 3: Update `.env.example`**

Replace the API block:

```env
# Secret used to sign session cookies for partner/admin accounts. Generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=

# Netlify Build Hook URL — triggered after every truck create/update/moderation
# so the public static pages pick up the change. Create one in
# Site configuration → Build & deploy → Build hooks.
NETLIFY_BUILD_HOOK_URL=
```

Keep `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_AGROTRUCK_WHATSAPP` as they are.

- [ ] **Step 4: Update `README.md`**

Replace the "API externe" section with a short description of the new model: trucks are created through `/partner` and `/admin`, stored in Netlify Blobs via `netlify/functions/trucks.mts`, and public pages read them through the same function at build time. Document `pnpm seed:admin`, `pnpm test`, and running `netlify dev` (not `pnpm dev`) for local work that touches Netlify Functions.

- [ ] **Step 5: Verify the build's remaining errors are the expected ones**

Run: `pnpm build 2>&1 | head -n 60`
Expected: errors only in files touched by Task 11 (`app/entreprises/**`, `components/companies/**`, `app/trucks/[slug]/page.tsx`, `components/trucks/truck-card.tsx` — anything importing `lib/companies` or reading `truck.verified`/`truck.companyName`). No errors in `lib/truck-directory.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add lib/truck-directory.ts .env.example README.md
git commit -m "feat: read trucks from the trucks Netlify Function instead of an external API"
```

---

## Task 9: Shared frontend auth (`/login`, session hook, route guard)

**Files:**
- Create: `lib/use-session.ts`
- Create: `components/auth/session-gate.tsx`
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: `GET /.netlify/functions/auth?action=session`, `POST /.netlify/functions/auth?action=login`, `POST /.netlify/functions/auth?action=logout` (Task 5).
- Produces: `useSession(): { status: "loading" | "authenticated" | "unauthenticated"; session: { accountId: string; role: "admin" | "partner"; displayName: string } | null }` and `<SessionGate role="admin" | "partner">` — consumed by every page in Tasks 10-11.

- [ ] **Step 1: Implement `lib/use-session.ts`**

```ts
// lib/use-session.ts
"use client";

import { useEffect, useState } from "react";

export type Role = "admin" | "partner";
export interface Session { accountId: string; role: Role; displayName: string }
type Status = "loading" | "authenticated" | "unauthenticated";

export function useSession() {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/.netlify/functions/auth?action=session")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Session | null) => {
        if (cancelled) return;
        setSession(data);
        setStatus(data ? "authenticated" : "unauthenticated");
      })
      .catch(() => { if (!cancelled) setStatus("unauthenticated"); });
    return () => { cancelled = true; };
  }, []);

  return { status, session };
}
```

- [ ] **Step 2: Implement `components/auth/session-gate.tsx`**

```tsx
// components/auth/session-gate.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, type Role } from "@/lib/use-session";

export function SessionGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const { status, session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.role !== role) router.replace("/login");
  }, [status, session, role, router]);

  if (status !== "authenticated" || session?.role !== role) {
    return <div className="page-shell py-24 text-center text-sm text-muted-foreground">Vérification de la session…</div>;
  }
  return <>{children}</>;
}
```

- [ ] **Step 3: Implement `app/login/page.tsx`**

```tsx
// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/.netlify/functions/auth?action=login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      if (!response.ok) { setError("Numéro ou mot de passe incorrect."); return; }
      const { role } = (await response.json()) as { role: "admin" | "partner" };
      router.push(role === "admin" ? "/admin" : "/partner");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center py-16">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[20px] border border-primary/10 bg-white p-7 shadow-[0_18px_50px_rgba(17,17,17,.06)]">
        <h1 className="font-heading text-2xl font-bold text-foreground">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Espace Badora et partenaires.</p>
        <div className="mt-6 grid gap-4">
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="username" />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run `netlify dev`, visit `http://localhost:8888/login`, log in with the seeded admin. Confirm redirect to `/admin` (which does not exist until Task 10 — a 404 here is expected and fine; what you're checking is that the login call succeeds and the redirect fires).

- [ ] **Step 5: Commit**

```bash
git add lib/use-session.ts components/auth/session-gate.tsx app/login/page.tsx
git commit -m "feat: add session hook, route guard, and login page"
```

---

## Task 10: Partner dashboard + truck create/edit forms

**Files:**
- Create: `app/partner/page.tsx`
- Create: `app/partner/trucks/new/page.tsx`
- Create: `app/partner/trucks/edit/page.tsx`
- Create: `components/partner/truck-form.tsx`

**Interfaces:**
- Consumes: `SessionGate`, `useSession` (Task 9); `GET/POST/PATCH /.netlify/functions/trucks` (Task 7); `truckTypeLabels`, `availabilityLabels` from `types/truck.ts`.
- Produces: `<TruckForm truck={Truck | undefined} onSaved={() => void} />` reused by both the "new" and "edit" pages.

- [ ] **Step 1: Implement `components/partner/truck-form.tsx`**

```tsx
// components/partner/truck-form.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Truck, TruckType } from "@/types/truck";
import { truckTypeLabels } from "@/types/truck";

type FormState = {
  name: string; brand: string; model: string; type: TruckType; capacityTons: string;
  location: string; serviceAreas: string; acceptedMaterials: string; ownerName: string;
  phone: string; whatsapp: string; description: string; images: string; restrictions: string;
};

function toFormState(truck?: Truck): FormState {
  return {
    name: truck?.name ?? "", brand: truck?.brand ?? "", model: truck?.model ?? "",
    type: truck?.type ?? "flatbed", capacityTons: truck ? String(truck.capacityTons) : "",
    location: truck?.location ?? "", serviceAreas: truck?.serviceAreas.join(", ") ?? "",
    acceptedMaterials: truck?.acceptedMaterials.join(", ") ?? "", ownerName: truck?.ownerName ?? "",
    phone: truck?.phone ?? "", whatsapp: truck?.whatsapp ?? "", description: truck?.description ?? "",
    images: truck?.images.join(", ") ?? "", restrictions: truck?.restrictions.join(", ") ?? "",
  };
}

export function TruckForm({ truck, onSaved }: { truck?: Truck; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(() => toFormState(truck));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name, brand: form.brand, model: form.model, type: form.type,
      capacityTons: Number(form.capacityTons), location: form.location,
      serviceAreas: split(form.serviceAreas), acceptedMaterials: split(form.acceptedMaterials),
      ownerName: form.ownerName, ownerType: "individual", phone: form.phone, whatsapp: form.whatsapp,
      description: form.description, images: split(form.images), restrictions: split(form.restrictions),
      availability: truck?.availability ?? "available",
    };
    try {
      const response = await fetch(truck ? `/.netlify/functions/trucks?id=${truck.id}` : "/.netlify/functions/trucks", {
        method: truck ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) { setError("Impossible d'enregistrer ce camion. Vérifiez les champs."); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Nom de l'annonce"><Input value={form.name} onChange={set("name")} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marque"><Input value={form.brand} onChange={set("brand")} /></Field>
        <Field label="Modèle"><Input value={form.model} onChange={set("model")} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de véhicule">
          <select className="focus-ring h-11 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as TruckType }))}>
            {Object.entries(truckTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Capacité (tonnes)"><Input type="number" min="0" value={form.capacityTons} onChange={set("capacityTons")} required /></Field>
      </div>
      <Field label="Localisation"><Input value={form.location} onChange={set("location")} required /></Field>
      <Field label="Zones desservies (séparées par des virgules)"><Input value={form.serviceAreas} onChange={set("serviceAreas")} /></Field>
      <Field label="Marchandises acceptées (séparées par des virgules)"><Input value={form.acceptedMaterials} onChange={set("acceptedMaterials")} /></Field>
      <Field label="Nom du contact"><Input value={form.ownerName} onChange={set("ownerName")} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone"><Input value={form.phone} onChange={set("phone")} required /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={set("whatsapp")} required /></Field>
      </div>
      <Field label="Description"><Textarea value={form.description} onChange={set("description")} rows={4} /></Field>
      <Field label="Photos — liens vers des images déjà en ligne (séparés par des virgules)"><Textarea value={form.images} onChange={set("images")} rows={2} required /></Field>
      <Field label="Restrictions / conditions (séparées par des virgules)"><Input value={form.restrictions} onChange={set("restrictions")} /></Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted-foreground">{truck ? "Modifier ces informations renvoie l'annonce en validation chez Badora." : "Cette annonce sera visible après validation par Badora."}</p>
      <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : truck ? "Enregistrer les modifications" : "Soumettre à validation"}</Button>
    </form>
  );
}

function split(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1.5">{children}</div></div>; }
```

- [ ] **Step 2: Implement `app/partner/page.tsx`**

```tsx
// app/partner/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SessionGate } from "@/components/auth/session-gate";
import { availabilityLabels } from "@/types/truck";
import type { Truck } from "@/types/truck";
import { Button } from "@/components/ui/button";

function PartnerDashboard() {
  const [trucks, setTrucks] = useState<Truck[] | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/trucks?mine=1").then((response) => response.json()).then(setTrucks);
  }, []);

  const availabilityOptions = ["available", "in_transit", "maintenance"] as const;

  const updateAvailability = async (truck: Truck, availability: (typeof availabilityOptions)[number]) => {
    const response = await fetch(`/.netlify/functions/trucks?id=${truck.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ availability }),
    });
    if (response.ok) setTrucks((current) => current?.map((item) => (item.id === truck.id ? { ...item, availability } : item)) ?? null);
  };

  return (
    <div className="page-shell py-12">
      <div className="flex items-center justify-between"><h1 className="font-heading text-3xl font-bold">Mes camions</h1><Button asChild><Link href="/partner/trucks/new">Ajouter un camion</Link></Button></div>
      <div className="mt-8 grid gap-4">
        {trucks?.map((truck) => (
          <div key={truck.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-white p-5">
            <div>
              <p className="font-semibold">{truck.name}</p>
              <p className="text-xs text-muted-foreground">Statut : {statusLabel(truck.listingStatus)}</p>
            </div>
            <div className="flex items-center gap-3">
              <select className="focus-ring h-10 rounded-lg border border-primary/15 px-2 text-sm" value={truck.availability} onChange={(event) => updateAvailability(truck, event.target.value as (typeof availabilityOptions)[number])}>
                {availabilityOptions.map((value) => <option key={value} value={value}>{availabilityLabels[value]}</option>)}
              </select>
              <Button asChild variant="secondary" size="sm"><Link href={`/partner/trucks/edit?id=${truck.id}`}>Modifier</Link></Button>
            </div>
          </div>
        ))}
        {trucks?.length === 0 && <p className="text-sm text-muted-foreground">Aucun camion pour l'instant.</p>}
      </div>
    </div>
  );
}

function statusLabel(status: Truck["listingStatus"]) {
  return { pending: "En attente de validation", published: "Publié", rejected: "Refusé" }[status];
}

export default function Page() { return <SessionGate role="partner"><PartnerDashboard /></SessionGate>; }
```

- [ ] **Step 3: Implement `app/partner/trucks/new/page.tsx`**

```tsx
// app/partner/trucks/new/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { SessionGate } from "@/components/auth/session-gate";
import { TruckForm } from "@/components/partner/truck-form";

export default function NewTruckPage() {
  const router = useRouter();
  return (
    <SessionGate role="partner">
      <div className="page-shell max-w-2xl py-12">
        <h1 className="font-heading text-2xl font-bold">Ajouter un camion</h1>
        <div className="mt-6"><TruckForm onSaved={() => router.push("/partner")} /></div>
      </div>
    </SessionGate>
  );
}
```

- [ ] **Step 4: Implement `app/partner/trucks/edit/page.tsx`**

```tsx
// app/partner/trucks/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionGate } from "@/components/auth/session-gate";
import { TruckForm } from "@/components/partner/truck-form";
import type { Truck } from "@/types/truck";

function EditTruckForm() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [truck, setTruck] = useState<Truck | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch("/.netlify/functions/trucks?mine=1").then((response) => response.json()).then((trucks: Truck[]) => setTruck(trucks.find((item) => item.id === id) ?? null));
  }, [id]);

  if (!truck) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return <TruckForm truck={truck} onSaved={() => router.push("/partner")} />;
}

export default function EditTruckPage() {
  return (
    <SessionGate role="partner">
      <div className="page-shell max-w-2xl py-12">
        <h1 className="font-heading text-2xl font-bold">Modifier le camion</h1>
        <div className="mt-6"><EditTruckForm /></div>
      </div>
    </SessionGate>
  );
}
```

- [ ] **Step 5: Manual verification**

With `netlify dev` running, seed a partner via curl (using the admin session cookie from Task 5), log in as that partner at `/login`, create a truck at `/partner/trucks/new`, confirm it appears at `/partner` with status "En attente de validation", toggle its availability, and confirm the availability updates without the status changing.

- [ ] **Step 6: Commit**

```bash
git add app/partner components/partner
git commit -m "feat: add partner dashboard and truck create/edit forms"
```

---

## Task 11: Admin dashboard (fleet view, moderation queue, partner accounts)

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/queue/page.tsx`
- Create: `app/admin/partners/page.tsx`

**Interfaces:**
- Consumes: `SessionGate` (Task 9); `GET /.netlify/functions/trucks?scope=fleet` and `?status=pending`, `POST /.netlify/functions/trucks?id=&action=` (Task 7); `GET`/`POST /.netlify/functions/auth?action=list-partners` / `create-partner` (Task 5).

- [ ] **Step 1: Implement `app/admin/page.tsx`** (fleet view, sorted by availability)

```tsx
// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SessionGate } from "@/components/auth/session-gate";
import { availabilityLabels } from "@/types/truck";
import type { Truck } from "@/types/truck";

const ORDER: Record<Truck["availability"], number> = { available: 0, in_transit: 1, maintenance: 2 };

function FleetView() {
  const [trucks, setTrucks] = useState<Truck[] | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/trucks?scope=fleet").then((response) => response.json()).then(setTrucks);
  }, []);

  const sorted = [...(trucks ?? [])].sort((a, b) => ORDER[a.availability] - ORDER[b.availability]);

  return (
    <div className="page-shell py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold">Flotte — Badora &amp; partenaires</h1>
        <div className="flex gap-3"><Link href="/admin/queue" className="focus-ring text-sm font-semibold text-primary">File de validation</Link><Link href="/admin/partners" className="focus-ring text-sm font-semibold text-primary">Partenaires</Link></div>
      </div>
      <div className="mt-8 grid gap-3">
        {sorted.map((truck) => (
          <div key={truck.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white p-4">
            <div>
              <p className="font-semibold">{truck.name}</p>
              <p className="text-xs text-muted-foreground">{truck.ownerName}{truck.companyName ? ` · ${truck.companyName}` : ""} · {truck.location}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${truck.availability === "available" ? "bg-primary/10 text-primary" : truck.availability === "in_transit" ? "bg-warning/15 text-[#9b7d00]" : "bg-danger/10 text-danger"}`}>{availabilityLabels[truck.availability]}</span>
          </div>
        ))}
        {trucks?.length === 0 && <p className="text-sm text-muted-foreground">Aucun camion enregistré.</p>}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><FleetView /></SessionGate>; }
```

- [ ] **Step 2: Implement `app/admin/queue/page.tsx`**

```tsx
// app/admin/queue/page.tsx
"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { Button } from "@/components/ui/button";
import type { Truck } from "@/types/truck";

function ModerationQueue() {
  const [trucks, setTrucks] = useState<Truck[]>([]);

  const load = () => { fetch("/.netlify/functions/trucks?status=pending").then((response) => response.json()).then(setTrucks); };
  useEffect(load, []);

  const moderate = async (truck: Truck, action: "publish" | "reject") => {
    await fetch(`/.netlify/functions/trucks?id=${truck.id}&action=${action}`, { method: "POST" });
    setTrucks((current) => current.filter((item) => item.id !== truck.id));
  };

  return (
    <div className="page-shell py-12">
      <h1 className="font-heading text-3xl font-bold">File de validation</h1>
      <div className="mt-8 grid gap-4">
        {trucks.map((truck) => (
          <div key={truck.id} className="rounded-2xl border border-primary/10 bg-white p-5">
            <p className="font-semibold">{truck.name}</p>
            <p className="text-xs text-muted-foreground">{truck.ownerName} · {truck.location} · {truck.capacityTons} tonnes</p>
            <p className="mt-2 text-sm text-foreground/80">{truck.description}</p>
            <div className="mt-4 flex gap-3"><Button size="sm" onClick={() => moderate(truck, "publish")}>Publier</Button><Button size="sm" variant="secondary" onClick={() => moderate(truck, "reject")}>Refuser</Button></div>
          </div>
        ))}
        {trucks.length === 0 && <p className="text-sm text-muted-foreground">Rien en attente.</p>}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><ModerationQueue /></SessionGate>; }
```

- [ ] **Step 3: Implement `app/admin/partners/page.tsx`**

```tsx
// app/admin/partners/page.tsx
"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicAccount } from "@/types/account";

function PartnersAdmin() {
  const [partners, setPartners] = useState<PublicAccount[]>([]);
  const [form, setForm] = useState({ phone: "", displayName: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const load = () => { fetch("/.netlify/functions/auth?action=list-partners").then((response) => response.json()).then(setPartners); };
  useEffect(load, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch("/.netlify/functions/auth?action=create-partner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) { setError("Impossible de créer ce compte (numéro déjà utilisé ?)."); return; }
    setForm({ phone: "", displayName: "", password: "" });
    load();
  };

  return (
    <div className="page-shell py-12">
      <h1 className="font-heading text-3xl font-bold">Partenaires</h1>
      <form onSubmit={submit} className="mt-6 grid max-w-md gap-4 rounded-2xl border border-primary/10 bg-white p-5">
        <div><Label>Nom</Label><Input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required /></div>
        <div><Label>Téléphone</Label><Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required /></div>
        <div><Label>Mot de passe temporaire</Label><Input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit">Créer le compte partenaire</Button>
      </form>
      <div className="mt-8 grid gap-3">
        {partners.map((partner) => (
          <div key={partner.id} className="rounded-xl border border-primary/10 bg-white p-4"><p className="font-semibold">{partner.displayName}</p><p className="text-xs text-muted-foreground">{partner.phone}</p></div>
        ))}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><PartnersAdmin /></SessionGate>; }
```

- [ ] **Step 4: Manual verification**

Log in as admin, create a partner from `/admin/partners`, publish the truck created in Task 10 from `/admin/queue`, confirm it now appears in the `/admin` fleet view sorted correctly (available before in_transit before maintenance), and confirm publishing fired `triggerRebuild()` (check the `netlify dev` console log or, on a real deploy, the Netlify build hook activity).

- [ ] **Step 5: Commit**

```bash
git add app/admin
git commit -m "feat: add admin fleet dashboard, moderation queue, and partner account management"
```

---

## Task 12: Remove entreprises/companies UI, hide owner identity, drop direct per-truck WhatsApp

**Files:**
- Delete: `app/entreprises/page.tsx`, `app/entreprises/[slug]/page.tsx`, `components/companies/companies-browser.tsx`, `components/companies/company-card.tsx`
- Modify: `components/layout/navbar.tsx`
- Modify: `app/trucks/[slug]/page.tsx`
- Modify: `components/trucks/truck-contact-actions.tsx`
- Modify: `components/trucks/truck-card.tsx`
- Modify: `lib/contact.ts`

**Interfaces:**
- Produces: no public page or component reads `truck.ownerName`, `truck.companyName`, `truck.phone`, or `truck.whatsapp` any more (those fields still exist on `Truck` for the admin dashboard, which reads them from `?scope=fleet`, an authenticated endpoint). The "contact" affordance on truck cards and the detail page becomes a link into the order flow instead of a direct WhatsApp/call to the truck's owner. (The order flow itself — the form at `/location` and its Netlify Function — is a separate, later plan; this task only removes the now-inconsistent direct-contact UI and points its call-to-action at `/location`, which already exists as a page.)

- [ ] **Step 1: Delete the entreprises pages and company components**

```bash
git rm -r app/entreprises components/companies
```

- [ ] **Step 2: Update `components/layout/navbar.tsx`**

Remove the `["nav.companies", "/entreprises"]` entry from `links` (line 12) and change the CTA button's destination and label from the truck-registration WhatsApp link to the partner login:

```tsx
const links = [["nav.rental", "/location"], ["nav.sale", "/vente"], ["nav.how", "/comment-ca-marche"], ["nav.about", "/about"]] as const;
```

Replace the `<Button asChild>` line (line 19) — keep the "become a partner" WhatsApp CTA for prospects, and add a small login link for already-invited partners/Badora:

```tsx
<div className="hidden shrink-0 items-center gap-2 lg:flex">
  <HeaderControls />
  <Link href="/login" className="focus-ring text-[13px] font-semibold text-foreground/65 hover:text-primary">Espace partenaire</Link>
  <Button asChild className="whitespace-nowrap"><a href={truckRegistrationWhatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />Devenir partenaire</a></Button>
</div>
```

- [ ] **Step 3: Update `lib/contact.ts`**

```ts
// lib/contact.ts
import { whatsappUrl } from "@/lib/utils";

export const agroTruckWhatsapp = process.env.NEXT_PUBLIC_AGROTRUCK_WHATSAPP ?? "+245955000100";

export const truckRegistrationWhatsappUrl = whatsappUrl(
  agroTruckWhatsapp,
  "Olá, gostaria de me tornar parceiro da AgroTrucks by Badora.",
);
```

- [ ] **Step 4: Update `app/trucks/[slug]/page.tsx`**

Remove the `Building2`, `companySlug` imports and the owner/company block (lines 10, 52) — replace the sidebar identity block with a Badora-branded block and swap `TruckContactActions` for a link to the request flow:

Replace lines 4-11 (imports) — drop `companySlug`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Info, MapPin, Scale, Truck as TruckIcon } from "lucide-react";
import { findTruckBySlug, listTrucks } from "@/lib/truck-directory";
import { truckTypeLabels } from "@/types/truck";
import { TruckGallery } from "@/components/trucks/truck-gallery";
import { TruckStatusBadge } from "@/components/trucks/truck-status-badge";
import { TruckContactActions } from "@/components/trucks/truck-contact-actions";
import { TruckRating } from "@/components/trucks/truck-rating";
```

Replace line 29 (drop the `verified` badge, which no longer exists on `Truck`):

```tsx
<div className="flex flex-wrap items-center gap-3"><TruckStatusBadge status={truck.availability} /></div>
```

Replace the sidebar block (line 52) — no owner/company identity, just the Badora brand:

```tsx
<div className="mt-4 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-full bg-primary/8"><TruckIcon className="text-primary" /></span><div><h2 className="font-heading text-lg font-semibold text-foreground">AgroTrucks by Badora</h2><p className="text-xs text-muted-foreground">Camion vérifié par Badora</p></div></div>
```

Replace lines 54-56 (drop `truck.phone` display, swap contact actions for the request CTA):

```tsx
<p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4 text-primary" />{truck.location}, Guiné-Bissau</p>
<div className="mt-6"><TruckContactActions truck={truck} /></div>
```

- [ ] **Step 5: Update `components/trucks/truck-contact-actions.tsx`**

```tsx
// components/trucks/truck-contact-actions.tsx
import Link from "next/link";
import type { Truck } from "@/types/truck";
import { Button } from "@/components/ui/button";

export function TruckContactActions({ truck }: { truck: Truck }) {
  return (
    <>
      <Button asChild className="w-full"><Link href={`/location?type=${truck.type}`}>Demander ce type de camion</Link></Button>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-primary/10 bg-white/95 p-3 backdrop-blur-xl sm:hidden">
        <Button asChild className="w-full"><Link href={`/location?type=${truck.type}`}>Demander ce type de camion</Link></Button>
      </div>
    </>
  );
}
```

- [ ] **Step 6: Update `components/trucks/truck-card.tsx`**

Read the file first (`Read components/trucks/truck-card.tsx`) and remove any rendering of `truck.companyName`/`truck.verified`/`truck.phone`/`truck.whatsapp`, following the same pattern as Step 4: drop the owner-identity line, drop the `verified` badge (field no longer exists), keep everything else (type, capacity, location, availability badge, rating) unchanged.

- [ ] **Step 7: Verify the build is clean**

Run: `pnpm build`
Expected: succeeds with no type errors and no references to `truck.verified`, `truck.companyName` outside `app/admin/**` (where `companyName` is still legitimately read from the authenticated `?scope=fleet` endpoint), or `lib/companies`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: unify public truck pages under the Badora brand, drop entreprises pages and direct owner contact"
```

---

## Task 13: Rebranding

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/manifest.ts`
- Modify: `components/shared/brand-logo.tsx`

**Interfaces:** none — purely presentational, no new interfaces produced or consumed.

- [ ] **Step 1: Update `app/layout.tsx` metadata**

Replace lines 10-27:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "AgroTrucks by Badora — Location de camions", template: "%s | AgroTrucks by Badora" },
  description: "La logistique de Badora et de son réseau de partenaires, réunie au même endroit. Demandez une location de camions, sans prix affiché — le contact se fait ensuite directement.",
  applicationName: "AgroTrucks by Badora",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/agrotruck-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/agrotruck-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/agrotruck-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "AgroTrucks by Badora", statusBarStyle: "default" },
  openGraph: { title: "AgroTrucks by Badora", description: "La logistique de Badora et de ses partenaires, au même endroit.", images: ["/brand/agrotruck-lockup.png"], type: "website", locale: "pt_GW" },
};
```

(Icon/OG image files themselves are not regenerated in this plan — flag to the user that new brand assets replacing `/public/brand/agrotruck-*` are a design task outside an implementation plan's scope, and the existing files are reused as placeholders.)

- [ ] **Step 2: Update `app/manifest.ts`**

Replace `name`/`short_name`/`description` (lines 7-9):

```ts
name: "AgroTrucks by Badora",
short_name: "AgroTrucks",
description: "La logistique de Badora et de son réseau de partenaires.",
```

- [ ] **Step 3: Update `components/shared/brand-logo.tsx`**

Until new brand asset files exist, keep the existing images (still valid, just repoint the accessible name) and change both `alt` attributes from `"AgroTruck"` to `"AgroTrucks by Badora"` (lines 6-12).

- [ ] **Step 4: Manual verification**

Run `pnpm build && pnpm start`, open the site, confirm the browser tab title reads "AgroTrucks by Badora — Location de camions" and the PWA manifest name updated (DevTools → Application → Manifest).

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/manifest.ts components/shared/brand-logo.tsx
git commit -m "feat: rebrand to AgroTrucks by Badora"
```

---

## Self-Review Notes

- **Spec coverage:** accounts/roles (Tasks 4-5), truck model + moderation state machine (Tasks 1, 6-7), partner publish flow (Task 10), admin dashboard/queue/partner management (Task 11), no-price constraint (never introduced), unified brand / hidden owner identity (Task 12), migration off the external API (Task 8), rebranding (Task 13). The spec's client Order/WhatsApp flow and the admin's order history view are **not** in this plan — per the writing-plans scope check, they form an independently shippable subsystem layered on top of this one (they need this plan's admin auth to exist, but nothing here depends on them). That should be its own plan, written next, titled along the lines of "Demandes clients & tableau de bord logistique."
- **Placeholder scan:** no TBD/TODO left in any step; every code block is complete, runnable code, not a description of code.
- **Type consistency:** `Truck.listingStatus` (Task 1) is used identically in Tasks 6, 7, 10, 11, 12. `SessionPayload` (Task 2) is used identically in Tasks 3, 4, 5, 7. `BlobStore` (Task 4) is reused by Task 6 to keep both stores testable the same way.

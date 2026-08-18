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

import { describe, expect, it, beforeEach } from "vitest";
import {
  createAccount, findAccountByPhone, findAccountById, listAccounts, setAccountDisabled, setAccountPassword, updateProfile, type BlobStore,
} from "./accounts";
import { verifyPassword } from "./crypto";
import { fakeStore } from "./test-store";


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

  it("ignores a stale phone index left by a phone change", async () => {
    const account = await createAccount({ phone: "+245955000204", displayName: "Coop", password: "1234", role: "producer" }, store);
    await updateProfile(account.id, { phone: "+245955000205" }, store);
    expect(await findAccountByPhone("+245955000204", store)).toBeNull();
    expect((await findAccountByPhone("+245955000205", store))?.id).toBe(account.id);
  });
});

describe("updateProfile", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("keeps only the fields allowed for the account's role", async () => {
    const producer = await createAccount({ phone: "+245955000300", displayName: "Coop Pirada", password: "1234", role: "producer" }, store);
    const result = await updateProfile(producer.id, { displayName: "Coop de Pirada", mainZone: "gabu", mainLocation: "Pirada", workZones: ["bissau"], vehicleCategories: ["camion"] }, store);
    expect(result.ok && result.account).toMatchObject({ displayName: "Coop de Pirada", mainZone: "gabu", mainLocation: "Pirada" });
    expect(result.ok && result.account).not.toHaveProperty("workZones");
    expect(result.ok && result.account).not.toHaveProperty("vehicleCategories");

    const partner = await createAccount({ phone: "+245955000301", displayName: "Mamadu", password: "1234", role: "partner" }, store);
    const updated = await updateProfile(partner.id, { companyName: "Transportes Djaló", workZones: ["gabu", "bafata"], vehicleCategories: ["camion"], vehicleCapacityTons: 20, mainZone: "oio" }, store);
    expect(updated.ok && updated.account).toMatchObject({ companyName: "Transportes Djaló", workZones: ["gabu", "bafata"], vehicleCategories: ["camion"], vehicleCapacityTons: 20 });
    expect(updated.ok && updated.account).not.toHaveProperty("mainZone");
    expect(updated.ok && updated.account.updatedAt).toBeTruthy();
  });

  it("refuses a phone number that already belongs to another account", async () => {
    await createAccount({ phone: "+245955000302", displayName: "A", password: "1234", role: "producer" }, store);
    const other = await createAccount({ phone: "+245955000303", displayName: "B", password: "1234", role: "producer" }, store);
    expect(await updateProfile(other.id, { phone: "+245 955 000 302" }, store)).toEqual({ ok: false, status: 409, error: "Ce numéro a déjà un compte" });
  });

  it("returns 404 for an unknown account", async () => {
    expect(await updateProfile("missing", { displayName: "X" }, store)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("account administration", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("blocks and reactivates an account", async () => {
    const account = await createAccount({ phone: "+245955000400", displayName: "X", password: "1234", role: "partner" }, store);
    expect((await setAccountDisabled(account.id, true, store))?.disabled).toBe(true);
    expect((await findAccountById(account.id, store))?.disabled).toBe(true);
    expect((await setAccountDisabled(account.id, false, store))?.disabled).toBe(false);
    expect(await setAccountDisabled("missing", true, store)).toBeNull();
  });

  it("resets the PIN or password", async () => {
    const account = await createAccount({ phone: "+245955000401", displayName: "X", password: "1234", role: "producer" }, store);
    await setAccountPassword(account.id, "987654", store);
    const stored = await findAccountById(account.id, store);
    expect(await verifyPassword("987654", stored!.passwordHash)).toBe(true);
    expect(await verifyPassword("1234", stored!.passwordHash)).toBe(false);
  });
});

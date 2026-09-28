/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type T = ReturnType<typeof convexTest>;

async function signup(t: T, role: "producer" | "transporter", phone: string, extra: Record<string, unknown> = {}) {
  const result = await t.mutation(api.auth.signup, { role, phone, pin: "1234", displayName: `${role} ${phone}`, ...extra });
  if (!result.ok) throw new Error(result.error);
  return result.token;
}

describe("auth", () => {
  it("signs up, opens a session and refuses a duplicate phone", async () => {
    const t = convexTest(schema, modules);
    const token = await signup(t, "producer", "+245955000300");
    expect(await t.query(api.auth.session, { token })).toMatchObject({ role: "producer" });
    expect(await t.mutation(api.auth.signup, { role: "transporter", phone: "+245 955 000 300", pin: "1234" })).toEqual({ ok: false, error: "phone_taken" });
    expect(await t.mutation(api.auth.signup, { role: "producer", phone: "+245955000301", pin: "12" })).toEqual({ ok: false, error: "invalid_pin" });
  });

  it("logs in with the PIN and locks the number after 5 failures", async () => {
    const t = convexTest(schema, modules);
    await signup(t, "producer", "+245955000302");
    expect(await t.mutation(api.auth.login, { phone: "+245955000302", pin: "1234" })).toMatchObject({ ok: true });
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(await t.mutation(api.auth.login, { phone: "+245955000302", pin: "0000" })).toEqual({ ok: false, error: "invalid_credentials" });
    }
    expect(await t.mutation(api.auth.login, { phone: "+245955000302", pin: "1234" })).toEqual({ ok: false, error: "locked" });
  });

  it("logs out and ignores unknown tokens", async () => {
    const t = convexTest(schema, modules);
    const token = await signup(t, "producer", "+245955000303");
    await t.mutation(api.auth.logout, { token });
    expect(await t.query(api.auth.session, { token })).toBeNull();
    expect(await t.query(api.auth.session, { token: "nope" })).toBeNull();
  });
});

describe("admin", () => {
  it("bootstraps a single admin who can block an account, which logs it out", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.bootstrapAdmin, { phone: "+245900000001", pin: "9999", displayName: "Admin" });
    await expect(t.mutation(internal.users.bootstrapAdmin, { phone: "+245900000002", pin: "9999", displayName: "Other" })).rejects.toThrow();
    const admin = await t.mutation(api.auth.login, { phone: "+245900000001", pin: "9999" });
    if (!admin.ok) throw new Error("admin login");
    const token = await signup(t, "transporter", "+245955000400");
    const session = await t.query(api.auth.session, { token });
    await t.mutation(api.users.setDisabled, { token: admin.token, userId: session!.userId, disabled: true });
    expect(await t.query(api.auth.session, { token })).toBeNull();
    expect(await t.mutation(api.auth.login, { phone: "+245955000400", pin: "1234" })).toEqual({ ok: false, error: "disabled" });
    await expect(t.query(api.users.list, { token })).rejects.toThrow();
  });
});

describe("profile", () => {
  it("keeps only the fields of the account's role", async () => {
    const t = convexTest(schema, modules);
    const token = await signup(t, "producer", "+245955000500");
    const profile = await t.mutation(api.users.updateProfile, { token, mainZone: "gabu", workZones: ["bissau"], vehicleCategories: ["camion"] });
    expect(profile.mainZone).toBe("gabu");
    expect(profile.workZones).toEqual([]);
    expect(profile.vehicleCategories).toEqual([]);
  });
});

describe("trucks", () => {
  it("publishes a truck immediately in the catalogue, adds its type to the transporter, and lets the admin hide it", async () => {
    const t = convexTest(schema, modules);
    const token = await signup(t, "transporter", "+245955000600", { companyName: "Transportes Djaló" });
    await t.mutation(api.trucks.create, {
      token, name: "Mercedes Actros", category: "camion", listingMode: "transport", capacityTons: 20, zone: "gabu", location: "Gabú",
      serviceZones: ["gabu", "bafata"], goods: ["Cajou"], availability: "available", description: "Benne", photoIds: [],
    });
    const catalogue = await t.query(api.trucks.list, {});
    expect(catalogue).toHaveLength(1);
    expect(catalogue[0]).toMatchObject({ ownerName: "Transportes Djaló", category: "camion" });
    expect(catalogue[0]).not.toHaveProperty("ownerPhone");
    expect(await t.query(api.trucks.list, { category: "moto_tricycle" })).toHaveLength(0);
    expect(await t.query(api.trucks.list, { zone: "bafata" })).toHaveLength(1);
    const detail = await t.query(api.trucks.bySlug, { slug: catalogue[0].slug });
    expect(detail?.ownerPhone).toBe("+245955000600");
    expect((await t.query(api.users.me, { token })).vehicleCategories).toEqual(["camion"]);
  });

  it("averages ratings from producers, one per producer", async () => {
    const t = convexTest(schema, modules);
    const transporter = await signup(t, "transporter", "+245955000601");
    const truckId = await t.mutation(api.trucks.create, {
      token: transporter, name: "Canter", category: "camionnette", listingMode: "rental", capacityTons: 3, zone: "bissau", location: "Bissau",
      serviceZones: [], goods: [], availability: "available", description: "", photoIds: [],
    });
    const producer = await signup(t, "producer", "+245955000602");
    await t.mutation(api.trucks.rate, { token: producer, truckId, vehicleQuality: 5, professionalism: 3, reliability: 4 });
    const summary = await t.mutation(api.trucks.rate, { token: producer, truckId, vehicleQuality: 4, professionalism: 4, reliability: 4 });
    expect(summary).toEqual({ count: 1, vehicleQuality: 4, professionalism: 4, reliability: 4, overall: 4 });
    await expect(t.mutation(api.trucks.rate, { token: transporter, truckId, vehicleQuality: 5, professionalism: 5, reliability: 5 })).rejects.toThrow();
  });
});

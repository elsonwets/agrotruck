/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type T = ReturnType<typeof convexTest>;

async function signup(t: T, role: "producer" | "transporter", phone: string, extra: Record<string, unknown> = {}) {
  const result = await t.mutation(api.auth.signup, { role, phone, pin: "1234", displayName: `${role} ${phone}`, ...extra });
  if (!result.ok) throw new Error(result.error);
  return result.token;
}

const truckInput = {
  category: "camion" as const, listingMode: "transport" as const, capacityTons: 20, zone: "gabu" as const, location: "Gabú",
  serviceZones: [], goods: [], availability: "available" as const, description: "", photoIds: [],
};

function addTruck(t: T, token: string, name: string, extra: Record<string, unknown> = {}) {
  return t.mutation(api.trucks.create, { token, ...truckInput, name, ...extra });
}

// Transporteur « entreprise » : 2 camions, région Gabú, type camion (il voit les missions de missionInput).
async function fleetSetup(t: T, phone = "+245955000810") {
  const owner = await signup(t, "transporter", phone, { vehicleCategories: ["camion"], workZones: ["gabu"], companyName: "Transportes Gabú" });
  const truckA = await addTruck(t, owner, "Camion A");
  const truckB = await addTruck(t, owner, "Camion B");
  return { owner, truckA, truckB };
}

const missionInput = {
  vehicleCategory: "camion" as const, pickupZone: "gabu" as const, pickupLocation: "Pirada",
  dropoffZone: "bissau" as const, dropoffLocation: "Porto", productType: "cashew" as const, quantitySacks: 200, neededFrom: "2026-10-10",
};

// Mission Gabú → Bissau attribuée au transporteur, avec ce camion (statut « assigned »).
async function assignedMission(t: T, transporter: string, truckId: Id<"trucks">, producerPhone = "+245955000890") {
  const producer = await signup(t, "producer", producerPhone);
  const missionId = await t.mutation(api.missions.create, { token: producer, ...missionInput });
  const offerId = await t.mutation(api.offers.send, { token: transporter, missionId, price: 150_000, truckId });
  await t.mutation(api.offers.choose, { token: producer, offerId });
  return { producer, missionId };
}

const at = (iso: string) => vi.setSystemTime(new Date(iso));

describe("trucks", () => {
  it("stores the licence plate in capitals", async () => {
    const t = convexTest(schema, modules);
    const owner = await signup(t, "transporter", "+245955000800");
    await addTruck(t, owner, "Actros", { plate: " ab-123-cd " });
    const [truck] = await t.query(api.trucks.mine, { token: owner });
    expect(truck.plate).toBe("AB-123-CD");
  });
});

describe("drivers", () => {
  it("is reserved to transporters with at least 2 vehicles", async () => {
    const t = convexTest(schema, modules);
    const owner = await signup(t, "transporter", "+245955000810");
    const truckA = await addTruck(t, owner, "Camion A");
    await expect(t.query(api.drivers.list, { token: owner })).rejects.toThrow(/forbidden/);
    await addTruck(t, owner, "Camion B");
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu Baldé", phone: "+245 955 111 222", truckId: truckA });
    expect(await t.query(api.drivers.list, { token: owner })).toEqual([
      expect.objectContaining({ _id: driverId, name: "Mamadu Baldé", truckId: truckA, truckName: "Camion A", linkExpiresAt: null, disabled: false }),
    ]);
  });

  it("keeps one driver per truck and validates the input", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA } = await fleetSetup(t);
    const first = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const second = await t.mutation(api.drivers.create, { token: owner, name: "Braima", phone: "+245955111333", truckId: truckA });
    const drivers = await t.query(api.drivers.list, { token: owner });
    expect(drivers.find((driver) => driver._id === first)?.truckId).toBeNull();
    expect(drivers.find((driver) => driver._id === second)?.truckId).toBe(truckA);
    const truck = await t.run((ctx) => ctx.db.get("trucks", truckA));
    expect(truck?.driverId).toBe(second);

    const other = await signup(t, "transporter", "+245955000819");
    const foreign = await addTruck(t, other, "Autre");
    await expect(t.mutation(api.drivers.create, { token: owner, name: "Seco", phone: "+245955111444", truckId: foreign })).rejects.toThrow(/invalid_truck/);
    await expect(t.mutation(api.drivers.create, { token: owner, name: "  ", phone: "+245955111444" })).rejects.toThrow(/invalid_name/);
    await expect(t.mutation(api.drivers.create, { token: owner, name: "Seco", phone: "12" })).rejects.toThrow(/invalid_phone/);
  });

  it("lets only the owner edit or disable a driver", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    const { owner: rival } = await fleetSetup(t, "+245955000820");
    const driverId: Id<"drivers"> = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    await expect(t.mutation(api.drivers.update, { token: rival, driverId, name: "Volé", phone: "+245955111222" })).rejects.toThrow(/not_found/);
    await expect(t.mutation(api.drivers.setDisabled, { token: rival, driverId, disabled: true })).rejects.toThrow(/not_found/);

    await t.mutation(api.drivers.update, { token: owner, driverId, name: "Mamadu Baldé", phone: "+245955111222", truckId: truckB });
    const [driver] = await t.query(api.drivers.list, { token: owner });
    expect(driver).toMatchObject({ name: "Mamadu Baldé", truckId: truckB, truckName: "Camion B" });
    expect((await t.run((ctx) => ctx.db.get("trucks", truckA)))?.driverId).toBeUndefined();

    await t.mutation(api.drivers.setDisabled, { token: owner, driverId, disabled: true });
    expect((await t.query(api.drivers.list, { token: owner }))[0].disabled).toBe(true);
  });
});

describe("tracking", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("records a driver's position through the link, at most every 10 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-10-04T08:00:00Z");
    const t = convexTest(schema, modules);
    const { owner, truckA } = await fleetSetup(t);
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu Baldé", phone: "+245955111222", truckId: truckA });
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });
    expect(await t.query(api.tracking.linkInfo, { linkToken })).toEqual({
      active: true, expiresAt: Date.parse("2026-10-11T08:00:00Z"), driverName: "Mamadu", truckName: "Camion A", plate: null,
    });
    expect(await t.query(api.drivers.list, { token: owner })).toEqual([expect.objectContaining({ linkExpiresAt: Date.parse("2026-10-11T08:00:00Z") })]);

    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22, accuracy: 15 })).toEqual({ recorded: true });
    at("2026-10-04T08:00:05Z");
    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.29, lng: -14.23 })).toEqual({ recorded: false });
    at("2026-10-04T08:00:31Z");
    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.29, lng: -14.23, accuracy: 5000 })).toEqual({ recorded: false });
    await expect(t.mutation(api.tracking.reportFromLink, { linkToken, lat: 200, lng: 0 })).rejects.toThrow(/invalid_position/);
    expect(await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.3, lng: -14.3 })).toEqual({ recorded: true });

    const position = await t.run((ctx) => ctx.db.query("positions").withIndex("by_truckId", (q) => q.eq("truckId", truckA)).unique());
    expect(position).toMatchObject({ lat: 12.3, lng: -14.3, source: "link", driverId, at: Date.parse("2026-10-04T08:00:31Z") });
  });

  it("refuses replaced, reassigned, revoked and expired links, then purges them", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-10-04T08:00:00Z");
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const report = (linkToken: string) => t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22 });

    const first = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    const second = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    await expect(report(first)).rejects.toThrow(/link_invalid/);
    expect(await t.query(api.tracking.linkInfo, { linkToken: first })).toMatchObject({ active: false });
    expect(await report(second)).toEqual({ recorded: true });

    // Le camion A est confié à un autre conducteur : le lien de Mamadu ne marche plus.
    await t.mutation(api.drivers.create, { token: owner, name: "Braima", phone: "+245955111333", truckId: truckA });
    await expect(report(second)).rejects.toThrow(/link_invalid/);

    await t.mutation(api.drivers.update, { token: owner, driverId, name: "Mamadu", phone: "+245955111222", truckId: truckB });
    const third = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    await t.mutation(api.tracking.revokeLink, { token: owner, driverId });
    await expect(report(third)).rejects.toThrow(/link_invalid/);

    const fourth = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    at("2026-10-11T08:00:01Z");
    await expect(report(fourth)).rejects.toThrow(/link_invalid/);
    await t.mutation(internal.tracking.purgeExpiredLinks, {});
    expect(await t.query(api.tracking.linkInfo, { linkToken: fourth })).toBeNull();
    await expect(report("not-a-token")).rejects.toThrow(/link_invalid/);
  });

  it("stops the links of a disabled driver, or of an owner left with one vehicle", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });

    await t.mutation(api.drivers.setDisabled, { token: owner, driverId, disabled: true });
    await expect(t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22 })).rejects.toThrow(/link_invalid/);
    await expect(t.mutation(api.tracking.createLink, { token: owner, driverId })).rejects.toThrow(/driver_unavailable/);

    await t.mutation(api.drivers.setDisabled, { token: owner, driverId, disabled: false });
    const again = (await t.mutation(api.tracking.createLink, { token: owner, driverId })).linkToken;
    await t.mutation(api.trucks.remove, { token: owner, truckId: truckB });
    await expect(t.mutation(api.tracking.reportFromLink, { linkToken: again, lat: 12.28, lng: -14.22 })).rejects.toThrow(/link_invalid/);
    expect(await t.query(api.tracking.linkInfo, { linkToken: again })).toMatchObject({ active: false });
  });

  it("lets a solo transporter share from their account only during their own mission", async () => {
    const t = convexTest(schema, modules);
    const solo = await signup(t, "transporter", "+245955000830", { vehicleCategories: ["camion"], workZones: ["gabu"] });
    const truckId = await addTruck(t, solo, "Actros");
    const fix = { lat: 12.28, lng: -14.22, accuracy: 10 };
    await expect(t.mutation(api.tracking.reportFromOwner, { token: solo, truckId, ...fix })).rejects.toThrow(/no_active_mission/);
    await assignedMission(t, solo, truckId);
    expect(await t.mutation(api.tracking.reportFromOwner, { token: solo, truckId, ...fix })).toEqual({ recorded: true });
    const intruder = await signup(t, "transporter", "+245955000831");
    await expect(t.mutation(api.tracking.reportFromOwner, { token: intruder, truckId, ...fix })).rejects.toThrow(/forbidden/);
  });

  it("shows the position only to the producer and the transporter of the ongoing mission", async () => {
    const t = convexTest(schema, modules);
    const solo = await signup(t, "transporter", "+245955000840", { vehicleCategories: ["camion"], workZones: ["gabu"] });
    const truckId = await addTruck(t, solo, "Actros");
    const { producer, missionId } = await assignedMission(t, solo, truckId);
    const stranger = await signup(t, "producer", "+245955000841");

    expect(await t.query(api.tracking.missionPosition, { token: producer, missionId })).toEqual({ position: null, driverName: null, progress: 0 });
    await t.mutation(api.missions.act, { token: solo, missionId, action: "loaded" });
    await t.mutation(api.tracking.reportFromOwner, { token: solo, truckId, lat: 12.0735, lng: -14.9072, accuracy: 10 }); // à mi-chemin

    const seen = await t.query(api.tracking.missionPosition, { token: producer, missionId });
    expect(seen?.position).toMatchObject({ lat: 12.0735, lng: -14.9072, accuracy: 10 });
    expect(seen?.progress).toBeCloseTo(0.5, 1);
    expect(await t.query(api.tracking.missionPosition, { token: solo, missionId })).not.toBeNull();
    expect(await t.query(api.tracking.missionPosition, { token: stranger, missionId })).toBeNull();

    await t.mutation(api.missions.act, { token: solo, missionId, action: "delivered" });
    expect(await t.query(api.tracking.missionPosition, { token: producer, missionId })).toBeNull();
  });
});

describe("fleet views", () => {
  it("opens the fleet tab from 2 vehicles", async () => {
    const t = convexTest(schema, modules);
    const owner = await signup(t, "transporter", "+245955000850");
    const producer = await signup(t, "producer", "+245955000851");
    await addTruck(t, owner, "Camion A");
    expect(await t.query(api.fleet.access, { token: owner })).toEqual({ fleet: false });
    await expect(t.query(api.fleet.overview, { token: owner })).rejects.toThrow(/forbidden/);
    await addTruck(t, owner, "Camion B");
    expect(await t.query(api.fleet.access, { token: owner })).toEqual({ fleet: true });
    expect(await t.query(api.fleet.access, { token: producer })).toEqual({ fleet: false });
    expect(await t.query(api.fleet.access, { token: "unknown" })).toEqual({ fleet: false });
  });

  it("gives the owner statuses, drivers and positions, and the public no coordinates", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA, truckB } = await fleetSetup(t);
    await t.mutation(api.trucks.setAvailability, { token: owner, truckId: truckB, availability: "maintenance" });
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu Baldé", phone: "+245955111222", truckId: truckA });
    await assignedMission(t, owner, truckA);
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });
    await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22, accuracy: 12 });

    const overview = await t.query(api.fleet.overview, { token: owner });
    const a = overview.find((truck) => truck._id === truckA);
    const b = overview.find((truck) => truck._id === truckB);
    expect(a).toMatchObject({ status: "loading", driver: { name: "Mamadu Baldé", phone: "+245955111222" }, position: { lat: 12.28, lng: -14.22 }, progress: 0 });
    expect(a?.mission).toMatchObject({ pickupZone: "gabu", dropoffZone: "bissau" });
    expect(b).toMatchObject({ status: "maintenance", driver: null, position: null, mission: null, progress: null });

    const list = await t.query(api.fleet.publicList, {});
    expect(list.find((truck) => truck._id === truckA)).toMatchObject({ status: "loading", driverName: "Mamadu", route: { pickupZone: "gabu", dropoffZone: "bissau" } });
    expect(JSON.stringify(list)).not.toMatch(/"lat"|"lng"|"accuracy"|"phone"|\+245/);
  });

  it("cleans the position, driver and links of a deleted truck", async () => {
    const t = convexTest(schema, modules);
    const { owner, truckA } = await fleetSetup(t);
    await addTruck(t, owner, "Camion C"); // il reste 2 véhicules après la suppression
    const driverId = await t.mutation(api.drivers.create, { token: owner, name: "Mamadu", phone: "+245955111222", truckId: truckA });
    const { linkToken } = await t.mutation(api.tracking.createLink, { token: owner, driverId });
    await t.mutation(api.tracking.reportFromLink, { linkToken, lat: 12.28, lng: -14.22 });

    await t.mutation(api.trucks.remove, { token: owner, truckId: truckA });
    expect(await t.run((ctx) => ctx.db.query("positions").collect())).toHaveLength(0);
    expect((await t.query(api.drivers.list, { token: owner }))[0]).toMatchObject({ truckId: null, linkExpiresAt: null });
    expect(await t.query(api.tracking.linkInfo, { linkToken })).toBeNull();
  });
});

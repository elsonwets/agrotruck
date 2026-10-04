/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
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

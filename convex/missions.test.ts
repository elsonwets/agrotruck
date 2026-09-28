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

const missionInput = {
  vehicleCategory: "camion" as const, pickupZone: "gabu" as const, pickupLocation: "Pirada",
  dropoffZone: "bissau" as const, dropoffLocation: "Porto", productType: "cashew" as const, quantitySacks: 200, neededFrom: "2026-10-10",
};

async function setup(t: T) {
  const producer = await signup(t, "producer", "+245955000700");
  const good = await signup(t, "transporter", "+245955000701", { vehicleCategories: ["camion"], workZones: ["gabu"], companyName: "Transportes A" });
  const other = await signup(t, "transporter", "+245955000702", { vehicleCategories: ["camion"], workZones: ["gabu"] });
  const wrongType = await signup(t, "transporter", "+245955000703", { vehicleCategories: ["moto_tricycle"], workZones: ["gabu"] });
  const missionId = await t.mutation(api.missions.create, { token: producer, ...missionInput });
  return { producer, good, other, wrongType, missionId };
}

describe("offers", () => {
  it("lets matching transporters offer a price, and hides the producer's phone until an offer is chosen", async () => {
    const t = convexTest(schema, modules);
    const { producer, good, other, wrongType, missionId } = await setup(t);

    expect(await t.query(api.missions.available, { token: wrongType })).toHaveLength(0);
    await expect(t.mutation(api.offers.send, { token: wrongType, missionId, price: 100_000 })).rejects.toThrow(/not_offered/);
    await expect(t.mutation(api.offers.send, { token: good, missionId, price: 0 })).rejects.toThrow(/invalid_price/);

    await t.mutation(api.offers.send, { token: good, missionId, price: 180_000, message: "Disponible demain" });
    await t.mutation(api.offers.send, { token: other, missionId, price: 150_000 });
    await t.mutation(api.offers.send, { token: good, missionId, price: 160_000 }); // mise à jour de sa propre offre

    const [offered] = await t.query(api.missions.available, { token: good });
    expect(offered.producer).toEqual({ name: "producer +245955000700" });
    expect(offered.myOffer).toMatchObject({ price: 160_000, status: "pending" });

    const offers = await t.query(api.offers.forMission, { token: producer, missionId });
    expect(offers.map((offer) => offer.price)).toEqual([150_000, 160_000]);
    expect(offers[1].transporter).toEqual({ name: "Transportes A", phone: "+245955000701" });
    expect((await t.query(api.missions.mine, { token: producer }))[0].pendingOffers).toBe(2);
    await expect(t.query(api.offers.forMission, { token: good, missionId })).rejects.toThrow();
  });

  it("assigns the mission to the chosen offer at the agreed price and declines the others", async () => {
    const t = convexTest(schema, modules);
    const { producer, good, other, missionId } = await setup(t);
    const chosenId = await t.mutation(api.offers.send, { token: good, missionId, price: 160_000 });
    await t.mutation(api.offers.send, { token: other, missionId, price: 150_000 });

    await expect(t.mutation(api.offers.choose, { token: good, offerId: chosenId })).rejects.toThrow();
    const chosen = await t.mutation(api.offers.choose, { token: producer, offerId: chosenId });
    expect(chosen).toMatchObject({ status: "assigned", agreedPrice: 160_000 });
    expect(chosen.transporter).toEqual({ name: "Transportes A", phone: "+245955000701" });

    const seenByWinner = await t.query(api.missions.get, { token: good, missionId });
    expect(seenByWinner?.producer?.phone).toBe("+245955000700");
    expect(seenByWinner?.myOffer?.status).toBe("accepted");
    const seenByLoser = await t.query(api.missions.get, { token: other, missionId });
    expect(seenByLoser?.myOffer?.status).toBe("declined");
    expect(seenByLoser?.producer).toEqual({ name: "producer +245955000700" });
    expect(await t.query(api.missions.available, { token: other })).toHaveLength(0);

    await expect(t.mutation(api.offers.send, { token: other, missionId, price: 100_000 })).rejects.toThrow(/already_taken/);
    const declined = (await t.query(api.offers.forMission, { token: producer, missionId })).find((offer) => offer.status === "declined");
    await expect(t.mutation(api.offers.choose, { token: producer, offerId: declined!._id })).rejects.toThrow(/offer_closed/);
  });

  it("lets a transporter withdraw a pending offer, and declines pending offers when the producer cancels", async () => {
    const t = convexTest(schema, modules);
    const { producer, good, other, missionId } = await setup(t);
    await t.mutation(api.offers.send, { token: good, missionId, price: 160_000 });
    await t.mutation(api.offers.send, { token: other, missionId, price: 150_000 });
    await t.mutation(api.offers.withdraw, { token: good, missionId });
    expect((await t.query(api.offers.forMission, { token: producer, missionId })).map((offer) => offer.price)).toEqual([150_000]);
    await t.mutation(api.missions.act, { token: producer, missionId, action: "cancel" });
    expect((await t.query(api.missions.get, { token: other, missionId }))?.myOffer?.status).toBe("declined");
  });

  it("only accepts the transporter's own visible truck in an offer", async () => {
    const t = convexTest(schema, modules);
    const { good, other, missionId } = await setup(t);
    const truckId = await t.mutation(api.trucks.create, {
      token: other, name: "Actros", category: "camion", listingMode: "transport", capacityTons: 20, zone: "gabu", location: "Gabú",
      serviceZones: [], goods: [], availability: "available", description: "", photoIds: [],
    });
    await expect(t.mutation(api.offers.send, { token: good, missionId, price: 160_000, truckId })).rejects.toThrow(/invalid_truck/);
    expect(await t.mutation(api.offers.send, { token: other, missionId, price: 150_000, truckId })).toBeTruthy();
  });
});

describe("missions", () => {
  it("runs loaded and delivered with the real time of the action, and a double confirmation", async () => {
    const t = convexTest(schema, modules);
    const { producer, good, missionId } = await setup(t);
    const offerId = await t.mutation(api.offers.send, { token: good, missionId, price: 160_000 });
    await t.mutation(api.offers.choose, { token: producer, offerId });
    const at = Date.now() - 60 * 60 * 1000;
    const loaded = await t.mutation(api.missions.act, { token: good, missionId, action: "loaded", at });
    // L'heure fournie ne peut pas précéder la création de la mission : elle est ramenée à maintenant.
    expect(loaded.events.at(-1)?.at).toBeGreaterThan(at);
    await t.mutation(api.missions.act, { token: good, missionId, action: "delivered" });
    const confirmed = await t.mutation(api.missions.act, { token: producer, missionId, action: "delivered" });
    expect(confirmed.events.map((event) => event.type)).toEqual(["created", "assigned", "loaded", "delivered", "delivered"]);
    await expect(t.mutation(api.missions.act, { token: producer, missionId, action: "cancel" })).rejects.toThrow(/cannot_cancel/);
  });

  it("does not duplicate a mission replayed after being published offline", async () => {
    const t = convexTest(schema, modules);
    const producer = await signup(t, "producer", "+245955000720");
    const clientRequestId = "3f6c1a52-8e1b-4c5e-9a57-1d2f0c9b7e41";
    const first = await t.mutation(api.missions.create, { token: producer, clientRequestId, ...missionInput });
    const replay = await t.mutation(api.missions.create, { token: producer, clientRequestId, ...missionInput });
    expect(replay).toBe(first);
    expect(await t.query(api.missions.mine, { token: producer })).toHaveLength(1);
    await expect(t.mutation(api.missions.create, { token: producer, ...missionInput, quantitySacks: undefined })).rejects.toThrow(/quantity_required/);
  });

  it("gives the admin the matching transporters and lets them assign only an active transporter", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.users.bootstrapAdmin, { phone: "+245900000010", pin: "9999", displayName: "Admin" });
    const admin = await t.mutation(api.auth.login, { phone: "+245900000010", pin: "9999" });
    if (!admin.ok) throw new Error("admin login");
    const producer = await signup(t, "producer", "+245955000730");
    const transporter = await signup(t, "transporter", "+245955000731", { vehicleCategories: ["camion"], workZones: ["gabu"] });
    const transporterId = (await t.query(api.auth.session, { token: transporter }))!.userId;
    const producerId = (await t.query(api.auth.session, { token: producer }))!.userId;
    const missionId = await t.mutation(api.missions.create, { token: producer, ...missionInput });
    const [listed] = await t.query(api.missions.adminList, { token: admin.token });
    expect(listed.candidateIds).toEqual([transporterId]);
    await expect(t.mutation(api.missions.act, { token: admin.token, missionId, action: "assign", transporterId: producerId })).rejects.toThrow(/transporter_required/);
    const assigned = await t.mutation(api.missions.act, { token: admin.token, missionId, action: "assign", transporterId });
    expect(assigned.transporterId).toBe(transporterId);
  });
});

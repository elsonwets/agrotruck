import { describe, expect, it } from "vitest";
import { filterOrders, matchesTransporter, orderStatus, transition, transporterCategories } from "./orders";
import type { Account } from "../../../types/account";
import type { Order } from "../../../types/order";
import type { Truck } from "../../../types/truck";

const mission: Order = {
  id: "o1", requestedTruckCount: 1, truckType: "", pickupLocation: "Pirada", dropoffLocation: "Porto de Bissau",
  neededFrom: "2026-10-05", cargoDescription: "", clientName: "Coop Pirada", clientPhone: "+245955000300",
  createdAt: "2026-10-01T08:00:00.000Z", producerAccountId: "prod-1", vehicleCategory: "camion",
  pickupZone: "gabu", dropoffZone: "bissau", productType: "cashew", quantitySacks: 200, quantityKg: 16000,
  status: "pending", events: [{ type: "created", accountId: "prod-1", at: "2026-10-01T08:00:00.000Z" }],
};

const partner: Account = {
  id: "tr-1", phone: "+245955000200", passwordHash: "x", role: "partner", displayName: "Mamadu",
  createdAt: "2026-09-01T00:00:00.000Z", vehicleCategories: ["camion"], workZones: ["gabu", "bafata"],
};

const producerActor = { accountId: "prod-1", role: "producer" as const };
const transporterActor = { accountId: "tr-1", role: "partner" as const };
const adminActor = { accountId: "adm-1", role: "admin" as const };
const at = "2026-10-05T09:30:00.000Z";

function truck(type: Truck["type"], listingStatus: Truck["listingStatus"] = "published"): Truck {
  return { type, listingStatus, ownerAccountId: "tr-1" } as Truck;
}

function applied(result: ReturnType<typeof transition>): Order {
  if (!result.ok) throw new Error(result.error);
  return result.order;
}

describe("orderStatus", () => {
  it("treats orders without a status (anonymous /location requests) as pending", () => {
    expect(orderStatus({ ...mission, status: undefined })).toBe("pending");
  });
});

describe("transporterCategories", () => {
  it("combines profile categories with the categories of the transporter's published trucks", () => {
    const categories = transporterCategories(partner, [truck("pickup"), truck("cargo_tricycle", "pending"), truck("minibus")]);
    expect([...categories].sort()).toEqual(["camion", "camionnette"]);
  });

  it("ignores trucks owned by someone else", () => {
    expect(transporterCategories({ ...partner, vehicleCategories: [] }, [{ ...truck("pickup"), ownerAccountId: "other" }]).size).toBe(0);
  });
});

describe("matchesTransporter", () => {
  it("shows a mission when both the vehicle category and the pickup zone match", () => {
    expect(matchesTransporter(mission, partner, [])).toBe(true);
  });

  it("hides a mission for another vehicle category", () => {
    expect(matchesTransporter({ ...mission, vehicleCategory: "moto_tricycle" }, partner, [])).toBe(false);
  });

  it("matches a category coming from a published truck", () => {
    expect(matchesTransporter({ ...mission, vehicleCategory: "camionnette" }, partner, [truck("pickup")])).toBe(true);
  });

  it("hides a mission loading outside the transporter's zones", () => {
    expect(matchesTransporter({ ...mission, pickupZone: "cacheu" }, partner, [])).toBe(false);
  });

  it("accepts any vehicle when the producer chose « Peu importe »", () => {
    expect(matchesTransporter({ ...mission, vehicleCategory: "any" }, partner, [])).toBe(true);
    expect(matchesTransporter({ ...mission, vehicleCategory: "any" }, { ...partner, vehicleCategories: [] }, [])).toBe(false);
  });

  it("hides missions from blocked transporters, non-partners, and once taken", () => {
    expect(matchesTransporter(mission, { ...partner, disabled: true }, [])).toBe(false);
    expect(matchesTransporter(mission, { ...partner, role: "producer" }, [])).toBe(false);
    expect(matchesTransporter({ ...mission, status: "assigned" }, partner, [])).toBe(false);
  });

  it("never offers anonymous /location requests (no category or zone) to transporters", () => {
    expect(matchesTransporter({ ...mission, vehicleCategory: undefined, pickupZone: undefined }, partner, [])).toBe(false);
  });
});

describe("transition", () => {
  it("runs the full mission: accept → loaded → delivered, with history", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(assigned.status).toBe("assigned");
    expect(assigned.transporterAccountId).toBe("tr-1");
    const loaded = applied(transition(assigned, "loaded", transporterActor, { at }));
    const delivered = applied(transition(loaded, "delivered", transporterActor, { at, comment: "Livré au port" }));
    expect(delivered.status).toBe("delivered");
    expect(delivered.updatedAt).toBe(at);
    expect(delivered.events?.map((event) => event.type)).toEqual(["created", "assigned", "loaded", "delivered"]);
    expect(delivered.events?.at(-1)).toEqual({ type: "delivered", accountId: "tr-1", at, comment: "Livré au port" });
  });

  it("does not mutate the original order", () => {
    transition(mission, "accept", transporterActor, { at });
    expect(mission.status).toBe("pending");
    expect(mission.events).toHaveLength(1);
  });

  it("refuses a mission that is already taken", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(transition(assigned, "accept", { accountId: "tr-2", role: "partner" })).toEqual({ ok: false, status: 409, error: "Mission déjà prise" });
  });

  it("only lets partners accept", () => {
    expect(transition(mission, "accept", producerActor)).toMatchObject({ ok: false, status: 403 });
  });

  it("only lets the assigned transporter, the producer or Badora mark it loaded", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(transition(assigned, "loaded", { accountId: "tr-2", role: "partner" })).toMatchObject({ ok: false, status: 403 });
    expect(transition(assigned, "loaded", producerActor).ok).toBe(true);
    expect(transition(mission, "loaded", transporterActor)).toMatchObject({ ok: false, status: 403 });
  });

  it("allows a second delivery confirmation from the other party, once", () => {
    const loaded = applied(transition(applied(transition(mission, "accept", transporterActor, { at })), "loaded", transporterActor, { at }));
    const delivered = applied(transition(loaded, "delivered", transporterActor, { at }));
    const confirmed = applied(transition(delivered, "delivered", producerActor, { at }));
    expect(confirmed.events?.filter((event) => event.type === "delivered").map((event) => event.accountId)).toEqual(["tr-1", "prod-1"]);
    expect(transition(confirmed, "delivered", producerActor)).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses to deliver a mission that was never loaded", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(transition(assigned, "delivered", transporterActor)).toMatchObject({ ok: false, status: 409 });
  });

  it("lets Badora assign a transporter by hand, and requires one", () => {
    expect(applied(transition(mission, "assign", adminActor, { at, transporterAccountId: "tr-9" })).transporterAccountId).toBe("tr-9");
    expect(transition(mission, "assign", adminActor)).toMatchObject({ ok: false, status: 400 });
    expect(transition(mission, "assign", transporterActor, { transporterAccountId: "tr-1" })).toMatchObject({ ok: false, status: 403 });
  });

  it("lets the producer or Badora cancel before loading only", () => {
    expect(applied(transition(mission, "cancel", producerActor, { at })).status).toBe("cancelled");
    expect(transition(mission, "cancel", { accountId: "prod-2", role: "producer" })).toMatchObject({ ok: false, status: 403 });
    const loaded = applied(transition(applied(transition(mission, "accept", transporterActor, { at })), "loaded", transporterActor, { at }));
    expect(transition(loaded, "cancel", adminActor)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("filterOrders", () => {
  const orders: Order[] = [
    mission,
    { ...mission, id: "o2", createdAt: "2026-09-15T10:00:00.000Z", productType: "rice", pickupZone: "bafata", status: "delivered" },
    { ...mission, id: "o3", createdAt: "2026-10-20T10:00:00.000Z", dropoffZone: "cacheu", status: undefined },
  ];
  const ids = (filters: Parameters<typeof filterOrders>[1]) => filterOrders(orders, filters).map((order) => order.id);

  it("returns everything without filters", () => {
    expect(ids({})).toEqual(["o1", "o2", "o3"]);
  });

  it("filters by date range (inclusive, on the creation day)", () => {
    expect(ids({ from: "2026-10-01", to: "2026-10-01" })).toEqual(["o1"]);
    expect(ids({ from: "2026-10-01" })).toEqual(["o1", "o3"]);
  });

  it("filters by status, product and route", () => {
    expect(ids({ status: "pending" })).toEqual(["o1", "o3"]);
    expect(ids({ productType: "rice" })).toEqual(["o2"]);
    expect(ids({ pickupZone: "gabu", dropoffZone: "bissau" })).toEqual(["o1"]);
  });
});

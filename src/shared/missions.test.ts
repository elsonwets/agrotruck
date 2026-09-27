import { describe, expect, it } from "vitest";
import {
  filterMissions, isFinished, matchesTransporter, missionStats, toCsv, transition, transporterCategories,
  type MissionCore, type MissionFacts, type TransporterProfile,
} from "./missions";

type Mission = MissionCore & MissionFacts & { id: string };

const at = Date.parse("2026-10-05T09:30:00.000Z");
const mission: Mission = {
  id: "m1", status: "pending", producerId: "prod-1", events: [{ type: "created", userId: "prod-1", at: Date.parse("2026-10-01T08:00:00Z") }],
  vehicleCategory: "camion", pickupZone: "gabu", dropoffZone: "bissau", productType: "cashew", quantityKg: 16000,
  createdAt: Date.parse("2026-10-01T08:00:00Z"),
};
const transporter: TransporterProfile = { id: "tr-1", role: "transporter", vehicleCategories: ["camion"], workZones: ["gabu", "bafata"] };
const producerActor = { userId: "prod-1", role: "producer" as const };
const transporterActor = { userId: "tr-1", role: "transporter" as const };
const adminActor = { userId: "adm-1", role: "admin" as const };

function applied(result: ReturnType<typeof transition<Mission>>): Mission {
  if (!result.ok) throw new Error(result.error);
  return result.mission;
}

describe("transporterCategories / matchesTransporter", () => {
  it("combines profile categories with the categories of the transporter's trucks", () => {
    expect([...transporterCategories(transporter, ["camionnette", "camion"])].sort()).toEqual(["camion", "camionnette"]);
  });

  it("shows a mission when both the vehicle type and the pickup region match", () => {
    expect(matchesTransporter(mission, transporter)).toBe(true);
    expect(matchesTransporter({ ...mission, vehicleCategory: "camionnette" }, transporter, ["camionnette"])).toBe(true);
  });

  it("hides it for another vehicle type or another region", () => {
    expect(matchesTransporter({ ...mission, vehicleCategory: "moto_tricycle" }, transporter)).toBe(false);
    expect(matchesTransporter({ ...mission, pickupZone: "cacheu" }, transporter)).toBe(false);
  });

  it("accepts any vehicle when the producer does not mind, if the transporter has at least one", () => {
    expect(matchesTransporter({ ...mission, vehicleCategory: "any" }, transporter)).toBe(true);
    expect(matchesTransporter({ ...mission, vehicleCategory: "any" }, { ...transporter, vehicleCategories: [] })).toBe(false);
  });

  it("hides missions from blocked accounts, non-transporters, and once taken", () => {
    expect(matchesTransporter(mission, { ...transporter, disabled: true })).toBe(false);
    expect(matchesTransporter(mission, { ...transporter, role: "producer" })).toBe(false);
    expect(matchesTransporter({ ...mission, status: "assigned" }, transporter)).toBe(false);
  });
});

describe("transition", () => {
  it("runs accept, loaded, delivered with history", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(assigned.transporterId).toBe("tr-1");
    const loaded = applied(transition(assigned, "loaded", transporterActor, { at }));
    const delivered = applied(transition(loaded, "delivered", transporterActor, { at, comment: "Port" }));
    expect(delivered.status).toBe("delivered");
    expect(delivered.updatedAt).toBe(at);
    expect(delivered.events.map((event) => event.type)).toEqual(["created", "assigned", "loaded", "delivered"]);
    expect(delivered.events.at(-1)).toEqual({ type: "delivered", userId: "tr-1", at, comment: "Port" });
    expect(isFinished(delivered)).toBe(true);
  });

  it("does not mutate the original mission", () => {
    transition(mission, "accept", transporterActor, { at });
    expect(mission.status).toBe("pending");
    expect(mission.events).toHaveLength(1);
  });

  it("refuses a mission already taken, and non-transporters", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(transition(assigned, "accept", { userId: "tr-2", role: "transporter" })).toEqual({ ok: false, status: 409, error: "already_taken" });
    expect(transition(mission, "accept", producerActor)).toMatchObject({ ok: false, status: 403 });
  });

  it("only lets the assigned transporter, the producer or the admin mark it loaded", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(transition(assigned, "loaded", { userId: "tr-2", role: "transporter" })).toMatchObject({ ok: false, status: 403 });
    expect(transition(assigned, "loaded", producerActor).ok).toBe(true);
    expect(transition(mission, "loaded", transporterActor)).toMatchObject({ ok: false, status: 403 });
  });

  it("allows one second delivery confirmation from the other party", () => {
    const loaded = applied(transition(applied(transition(mission, "accept", transporterActor, { at })), "loaded", transporterActor, { at }));
    const delivered = applied(transition(loaded, "delivered", transporterActor, { at }));
    const confirmed = applied(transition(delivered, "delivered", producerActor, { at }));
    expect(confirmed.events.filter((event) => event.type === "delivered").map((event) => event.userId)).toEqual(["tr-1", "prod-1"]);
    expect(transition(confirmed, "delivered", producerActor)).toMatchObject({ ok: false, error: "already_confirmed" });
  });

  it("refuses delivery before loading", () => {
    const assigned = applied(transition(mission, "accept", transporterActor, { at }));
    expect(transition(assigned, "delivered", transporterActor)).toMatchObject({ error: "not_in_transit" });
  });

  it("lets the admin assign by hand, with a transporter", () => {
    expect(applied(transition(mission, "assign", adminActor, { at, transporterId: "tr-9" })).transporterId).toBe("tr-9");
    expect(transition(mission, "assign", adminActor)).toMatchObject({ ok: false, status: 400 });
    expect(transition(mission, "assign", transporterActor, { transporterId: "tr-1" })).toMatchObject({ ok: false, status: 403 });
  });

  it("lets the producer or the admin cancel before loading only", () => {
    expect(applied(transition(mission, "cancel", producerActor, { at })).status).toBe("cancelled");
    expect(transition(mission, "cancel", { userId: "prod-2", role: "producer" })).toMatchObject({ ok: false, status: 403 });
    const loaded = applied(transition(applied(transition(mission, "accept", transporterActor, { at })), "loaded", transporterActor, { at }));
    expect(transition(loaded, "cancel", adminActor)).toMatchObject({ ok: false, error: "cannot_cancel" });
  });
});

describe("filterMissions / missionStats / toCsv", () => {
  const missions: Mission[] = [
    { ...mission, id: "1", status: "delivered", transporterId: "A", createdAt: Date.parse("2026-10-02T08:00:00Z") },
    { ...mission, id: "2", status: "loaded", transporterId: "B", quantityKg: 8000, createdAt: Date.parse("2026-10-03T08:00:00Z") },
    { ...mission, id: "3", status: "delivered", transporterId: "A", pickupZone: "bafata", quantityKg: 4500, productType: "rice", createdAt: Date.parse("2026-10-04T08:00:00Z") },
    { ...mission, id: "4", status: "cancelled", pickupZone: "oio", createdAt: Date.parse("2026-10-05T08:00:00Z") },
    { ...mission, id: "5", status: "delivered", transporterId: "C", quantityKg: 3000, createdAt: Date.parse("2026-09-30T08:00:00Z") },
  ];

  it("filters by dates, status, product and route", () => {
    const ids = (filters: Parameters<typeof filterMissions>[1]) => filterMissions(missions, filters).map((item) => item.id);
    expect(ids({ from: "2026-10-02", to: "2026-10-03" })).toEqual(["1", "2"]);
    expect(ids({ status: "delivered" })).toEqual(["1", "3", "5"]);
    expect(ids({ productType: "rice" })).toEqual(["3"]);
    expect(ids({ pickupZone: "bafata", dropoffZone: "bissau" })).toEqual(["3"]);
  });

  it("computes monthly indicators", () => {
    expect(missionStats(missions, "2026-10")).toEqual({
      missions: 3, delivered: 2, tonnes: 20.5, activeTransporters: 2,
      topRoutes: [{ route: "Gabú → Bissau (SAB)", count: 2 }, { route: "Bafatá → Bissau (SAB)", count: 1 }],
    });
    expect(missionStats(missions, "2025-01")).toEqual({ missions: 0, delivered: 0, tonnes: 0, activeTransporters: 0, topRoutes: [] });
  });

  it("builds an Excel-friendly CSV", () => {
    const csv = toCsv([["Date", "Commentaire"], ["2026-10-02", 'Sacs "80 kg"; secs'], ["x", undefined]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual(["Date;Commentaire", '2026-10-02;"Sacs ""80 kg""; secs"', "x;", ""]);
  });
});

import { describe, expect, it } from "vitest";
import { isFinished, missionQuantity, missionRoute, missionStats, ordersToCsv } from "./missions";
import type { Order } from "../types/order";

const order = { pickupLocation: "Pirada", pickupZone: "gabu", dropoffLocation: "Porto", dropoffZone: "bissau", quantitySacks: 200, quantityKg: 16000 } as Order;

describe("mission formatting", () => {
  it("shows the route with regions", () => {
    expect(missionRoute(order)).toBe("Pirada (Gabú) → Porto (Bissau (SAB))");
    expect(missionRoute({ ...order, pickupZone: undefined, dropoffZone: undefined })).toBe("Pirada → Porto");
  });

  it("shows sacks and weight, in tonnes from 1 000 kg", () => {
    expect(missionQuantity(order)).toBe("200 sacs · 16 t");
    expect(missionQuantity({ ...order, quantitySacks: undefined, quantityKg: 800 })).toBe("800 kg");
    expect(missionQuantity({ ...order, quantitySacks: 1, quantityKg: undefined })).toBe("1 sac");
  });

  it("knows which missions are finished", () => {
    expect(isFinished({ ...order, status: "delivered" })).toBe(true);
    expect(isFinished({ ...order, status: "cancelled" })).toBe(true);
    expect(isFinished({ ...order, status: "loaded" })).toBe(false);
    expect(isFinished({ ...order, status: undefined })).toBe(false);
  });
});


const base = {
  id: "x", requestedTruckCount: 1, truckType: "", pickupLocation: "Pirada", dropoffLocation: "Porto", neededFrom: "2026-10-05",
  cargoDescription: "", clientName: "Coop", clientPhone: "+245955000300", vehicleCategory: "camion", productType: "cashew",
} as Order;

describe("missionStats", () => {
  const orders: Order[] = [
    { ...base, id: "1", createdAt: "2026-10-02T08:00:00Z", pickupZone: "gabu", dropoffZone: "bissau", status: "delivered", quantityKg: 16000, transporterAccountId: "A" },
    { ...base, id: "2", createdAt: "2026-10-03T08:00:00Z", pickupZone: "gabu", dropoffZone: "bissau", status: "loaded", quantityKg: 8000, transporterAccountId: "B" },
    { ...base, id: "3", createdAt: "2026-10-04T08:00:00Z", pickupZone: "bafata", dropoffZone: "bissau", status: "delivered", quantityKg: 4500, transporterAccountId: "A" },
    { ...base, id: "4", createdAt: "2026-10-05T08:00:00Z", pickupZone: "oio", dropoffZone: "bissau", status: "cancelled", quantityKg: 9000 },
    { ...base, id: "5", createdAt: "2026-09-30T08:00:00Z", pickupZone: "gabu", dropoffZone: "bissau", status: "delivered", quantityKg: 3000, transporterAccountId: "C" },
    { ...base, id: "6", createdAt: "2026-10-06T08:00:00Z", vehicleCategory: undefined, pickupZone: undefined, dropoffZone: undefined }, // demande anonyme /location
  ];

  it("counts the month's missions (not cancelled, not anonymous requests)", () => {
    expect(missionStats(orders, "2026-10").missions).toBe(3);
  });

  it("sums delivered tonnes, counts active transporters and ranks routes", () => {
    const stats = missionStats(orders, "2026-10");
    expect(stats.tonnes).toBe(20.5);
    expect(stats.delivered).toBe(2);
    expect(stats.activeTransporters).toBe(2);
    expect(stats.topRoutes).toEqual([{ route: "Gabú → Bissau (SAB)", count: 2 }, { route: "Bafatá → Bissau (SAB)", count: 1 }]);
  });

  it("returns zeros for an empty month", () => {
    expect(missionStats(orders, "2025-01")).toEqual({ missions: 0, delivered: 0, tonnes: 0, activeTransporters: 0, topRoutes: [] });
  });
});

describe("ordersToCsv", () => {
  it("exports one line per mission with a header, ';' separators and escaped quotes", () => {
    const csv = ordersToCsv([{ ...base, createdAt: "2026-10-02T08:00:00Z", pickupZone: "gabu", dropoffZone: "bissau", status: "delivered", quantitySacks: 200, quantityKg: 16000, cargoDescription: 'Sacs "80 kg"; secs' }], { A: "Transportes A" });
    const [header, line] = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(header.split(";")[0]).toBe("Créée le");
    expect(line).toContain("Livré");
    expect(line).toContain("Noix de cajou;200;16000;Gabú;Pirada;Bissau (SAB);Porto");
    expect(line).toContain('"Sacs ""80 kg""; secs"');
    expect(csv.startsWith("﻿")).toBe(true); // Excel ouvre correctement les accents
  });
});

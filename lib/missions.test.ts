import { describe, expect, it } from "vitest";
import { isFinished, missionQuantity, missionRoute } from "./missions";
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

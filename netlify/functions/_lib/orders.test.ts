import { describe, expect, it, beforeEach } from "vitest";
import { createOrder, listOrders } from "./orders";
import type { BlobStore } from "./accounts";
import { fakeStore } from "./test-store";


const baseInput = {
  requestedTruckCount: 3, truckType: "dump_truck", pickupLocation: "Bissau", dropoffLocation: "Bafatá",
  neededFrom: "2026-08-20", cargoDescription: "Sable et gravier", clientName: "Fatumata Camará", clientPhone: "+245955000900",
};

describe("order store", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("creates an order with a generated id and timestamp", async () => {
    const order = await createOrder(baseInput, store);
    expect(order.id).toBeTruthy();
    expect(order.createdAt).toBeTruthy();
    expect(order.requestedTruckCount).toBe(3);
    expect(order.status).toBe("pending");
    expect(order.events).toEqual([{ type: "created", at: order.createdAt }]);
  });

  it("lists orders newest first", async () => {
    const first = await createOrder(baseInput, store);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createOrder({ ...baseInput, clientName: "João Có" }, store);
    expect((await listOrders(store)).map((order) => order.id)).toEqual([second.id, first.id]);
  });

  it("returns an empty list when there are no orders", async () => {
    expect(await listOrders(store)).toEqual([]);
  });
});

import { describe, expect, it, beforeEach } from "vitest";
import { createTruck, updateTruck, setListingStatus, findTruckById, listPublishedTrucks, listTrucksByOwner, listAllTrucks } from "./trucks";
import type { BlobStore } from "./accounts";

function fakeStore(): BlobStore {
  const data = new Map<string, string>();
  return {
    async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
    async get(key) { return data.has(key) ? JSON.parse(data.get(key)!) : null; },
    async list({ prefix }: { prefix: string }) { return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}

const baseInput = {
  name: "Scania R450 Plateau", brand: "Scania", model: "R450", type: "flatbed" as const, listingMode: "transport" as const,
  capacityTons: 32, location: "Bissau", serviceAreas: ["Bissau"], acceptedMaterials: ["Castanha de caju"],
  availability: "available" as const, ownerName: "Mamadú Baldé", ownerType: "company" as const, phone: "+245955123456",
  whatsapp: "+245955123456", description: "Plataforma de longa distância.", images: ["https://example.com/a.jpg"], restrictions: [],
};

describe("truck store", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("creates a truck as pending, owned by the creator", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    expect(truck.listingStatus).toBe("pending");
    expect(truck.ownerAccountId).toBe("acc-partner-1");
    expect(await findTruckById(truck.id, store)).toEqual(truck);
  });

  it("only published trucks show up in listPublishedTrucks", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    expect(await listPublishedTrucks(store)).toHaveLength(0);
    await setListingStatus(truck.id, "published", store);
    expect(await listPublishedTrucks(store)).toHaveLength(1);
  });

  it("updating availability alone does not change listingStatus", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    await setListingStatus(truck.id, "published", store);
    const updated = await updateTruck(truck.id, { availability: "in_transit" }, store);
    expect(updated?.availability).toBe("in_transit");
    expect(updated?.listingStatus).toBe("published");
  });

  it("updating a core field resets the truck to pending", async () => {
    const truck = await createTruck(baseInput, "acc-partner-1", store);
    await setListingStatus(truck.id, "published", store);
    const updated = await updateTruck(truck.id, { capacityTons: 40 }, store);
    expect(updated?.listingStatus).toBe("pending");
  });

  it("lists trucks by owner regardless of status", async () => {
    await createTruck(baseInput, "acc-partner-1", store);
    await createTruck(baseInput, "acc-partner-2", store);
    expect(await listTrucksByOwner("acc-partner-1", store)).toHaveLength(1);
  });

  it("listAllTrucks returns every truck for the admin fleet view", async () => {
    await createTruck(baseInput, "acc-partner-1", store);
    await createTruck(baseInput, "acc-partner-2", store);
    expect(await listAllTrucks(store)).toHaveLength(2);
  });
});

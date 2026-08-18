import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import type { Truck, TruckListingStatus } from "../../../types/truck";
import type { BlobStore } from "./accounts";

function defaultStore(): BlobStore {
  return getStore("agrotruck-trucks") as unknown as BlobStore;
}

type TruckInput = Omit<Truck, "id" | "slug" | "ownerAccountId" | "listingStatus">;

const AVAILABILITY_ONLY_FIELDS = new Set(["availability", "availableFrom"]);

export async function createTruck(input: TruckInput, ownerAccountId: string, store: BlobStore = defaultStore()): Promise<Truck> {
  const truck: Truck = { ...input, id: randomUUID(), slug: slugify(input.name), ownerAccountId, listingStatus: "pending" };
  await store.setJSON(`by-id/${truck.id}`, truck);
  return truck;
}

export async function updateTruck(id: string, patch: Partial<TruckInput>, store: BlobStore = defaultStore()): Promise<Truck | null> {
  const existing = await findTruckById(id, store);
  if (!existing) return null;
  const onlyAvailabilityChanged = Object.keys(patch).every((key) => AVAILABILITY_ONLY_FIELDS.has(key));
  const updated: Truck = {
    ...existing,
    ...patch,
    listingStatus: onlyAvailabilityChanged ? existing.listingStatus : ("pending" as TruckListingStatus),
  };
  await store.setJSON(`by-id/${id}`, updated);
  return updated;
}

export async function setListingStatus(id: string, status: TruckListingStatus, store: BlobStore = defaultStore()): Promise<Truck | null> {
  const existing = await findTruckById(id, store);
  if (!existing) return null;
  const updated: Truck = { ...existing, listingStatus: status };
  await store.setJSON(`by-id/${id}`, updated);
  return updated;
}

export async function findTruckById(id: string, store: BlobStore = defaultStore()): Promise<Truck | null> {
  return ((await store.get(`by-id/${id}`)) as Truck | null) ?? null;
}

export async function listAllTrucks(store: BlobStore = defaultStore()): Promise<Truck[]> {
  const { blobs } = await store.list({ prefix: "by-id/" });
  const trucks = await Promise.all(blobs.map(({ key }) => store.get(key) as Promise<Truck>));
  return trucks.filter((truck): truck is Truck => Boolean(truck));
}

export async function listPublishedTrucks(store: BlobStore = defaultStore()): Promise<Truck[]> {
  return (await listAllTrucks(store)).filter((truck) => truck.listingStatus === "published");
}

export async function listTrucksByOwner(ownerAccountId: string, store: BlobStore = defaultStore()): Promise<Truck[]> {
  return (await listAllTrucks(store)).filter((truck) => truck.ownerAccountId === ownerAccountId);
}

function slugify(value: string) {
  const base = value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base}-${randomUUID().slice(0, 6)}`;
}

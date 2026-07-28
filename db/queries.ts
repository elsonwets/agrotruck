import "server-only";
import { desc, eq } from "drizzle-orm";
import { trucks as demoTrucks } from "@/data/trucks";
import type { Truck, TruckAvailability, TruckType } from "@/types/truck";
import { getDatabase } from "./index";
import { trucks, users } from "./schema";

export async function listTrucks(): Promise<Truck[]> {
  const db = getDatabase();
  if (!db) return demoTrucks;
  const rows = await db.select({ truck: trucks, owner: users }).from(trucks).innerJoin(users, eq(trucks.ownerId, users.id)).orderBy(desc(trucks.createdAt));
  return rows.map(({ truck, owner }) => mapTruck(truck, owner));
}

export async function findTruckBySlug(slug: string): Promise<Truck | undefined> {
  const db = getDatabase();
  if (!db) return demoTrucks.find((truck) => truck.slug === slug);
  const rows = await db.select({ truck: trucks, owner: users }).from(trucks).innerJoin(users, eq(trucks.ownerId, users.id)).where(eq(trucks.slug, slug)).limit(1);
  const row = rows[0];
  return row ? mapTruck(row.truck, row.owner) : undefined;
}

function mapTruck(truck: typeof trucks.$inferSelect, owner: typeof users.$inferSelect): Truck {
  return {
    id: truck.id,
    slug: truck.slug,
    name: truck.name,
    brand: truck.brand,
    model: truck.model,
    type: truck.type as TruckType,
    capacityTons: truck.capacityTons,
    location: truck.location,
    serviceAreas: truck.serviceAreas,
    acceptedMaterials: truck.acceptedMaterials,
    availability: truck.availability as TruckAvailability,
    availableFrom: truck.availableFrom ?? undefined,
    ownerName: owner.name ?? "Proprietário AgroTruck",
    companyName: owner.companyName ?? undefined,
    ownerType: owner.accountType === "company" ? "company" : "individual",
    phone: owner.phone ?? "",
    whatsapp: owner.whatsapp ?? owner.phone ?? "",
    description: truck.description,
    images: truck.images.length ? truck.images : ["/brand/agrotruck-mark.png"],
    verified: truck.verified,
    restrictions: truck.restrictions,
  };
}

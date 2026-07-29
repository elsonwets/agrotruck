import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { trucks as demoTrucks } from "@/data/trucks";
import type { OwnerTruck, Truck, TruckAvailability, TruckPublicationStatus, TruckType } from "@/types/truck";
import type { TransportCompany } from "@/types/company";
import { groupTrucksByCompany } from "@/lib/companies";
import { getDatabase } from "./index";
import { trucks, users } from "./schema";

export async function listTrucks(): Promise<Truck[]> {
  const db = getDatabase();
  if (!db) return demoTrucks;
  const rows = await db.select({ truck: trucks, owner: users }).from(trucks).innerJoin(users, eq(trucks.ownerId, users.id)).where(and(eq(trucks.verified, true), eq(trucks.publicationStatus, "published"), eq(trucks.isOnline, true))).orderBy(desc(trucks.createdAt));
  return rows.map(({ truck, owner }) => mapTruck(truck, owner));
}

export async function findTruckBySlug(slug: string): Promise<Truck | undefined> {
  const db = getDatabase();
  if (!db) return demoTrucks.find((truck) => truck.slug === slug);
  const rows = await db.select({ truck: trucks, owner: users }).from(trucks).innerJoin(users, eq(trucks.ownerId, users.id)).where(and(eq(trucks.slug, slug), eq(trucks.verified, true), eq(trucks.publicationStatus, "published"), eq(trucks.isOnline, true))).limit(1);
  const row = rows[0];
  return row ? mapTruck(row.truck, row.owner) : undefined;
}

export async function listCompanies(): Promise<TransportCompany[]> {
  return groupTrucksByCompany(await listTrucks());
}

export async function findCompanyBySlug(slug: string): Promise<TransportCompany | undefined> {
  return (await listCompanies()).find((company) => company.slug === slug);
}

export async function listOwnerTrucks(ownerId: string): Promise<OwnerTruck[]> {
  const db = getDatabase();
  if (!db) return [];
  const rows = await db.select({ truck: trucks, owner: users }).from(trucks).innerJoin(users, eq(trucks.ownerId, users.id)).where(eq(trucks.ownerId, ownerId)).orderBy(desc(trucks.createdAt));
  return rows.map(({ truck, owner }) => ({
    ...mapTruck(truck, owner),
    registration: truck.registration,
    publicationStatus: truck.publicationStatus as TruckPublicationStatus,
    isOnline: truck.isOnline,
    driverName: truck.driverName ?? undefined,
    driverPhone: truck.driverPhone ?? undefined,
    apprenticeName: truck.apprenticeName ?? undefined,
    apprenticePhone: truck.apprenticePhone ?? undefined,
  }));
}

function mapTruck(truck: typeof trucks.$inferSelect, owner: typeof users.$inferSelect): Truck {
  const uploadedImages = truck.images.filter((image) => image && image !== "/brand/agrotruck-mark.png");
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
    images: uploadedImages.length ? uploadedImages : ["/brand/agrotruck-truck-placeholder.png"],
    verified: truck.verified,
    restrictions: truck.restrictions,
  };
}

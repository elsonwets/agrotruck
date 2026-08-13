import "server-only";

import { z } from "zod";
import { trucks as demoTrucks } from "@/data/trucks";
import { groupTrucksByCompany } from "@/lib/companies";
import type { TransportCompany } from "@/types/company";
import type { Truck, TruckAvailability, TruckType } from "@/types/truck";

const ratingSchema = z.object({
  overall: z.number().min(0).max(5),
  vehicleQuality: z.number().min(0).max(5),
  professionalism: z.number().min(0).max(5),
  reliability: z.number().min(0).max(5),
  reviewCount: z.number().int().nonnegative(),
});

const truckSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  slug: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default(""),
  model: z.string().default(""),
  type: z.enum(["flatbed", "dump_truck", "cargo", "container", "trailer", "canter"]),
  capacityTons: z.coerce.number().nonnegative(),
  location: z.string().min(1),
  serviceAreas: z.array(z.string()).default([]),
  acceptedMaterials: z.array(z.string()).default([]),
  availability: z.enum(["available", "in_transit", "maintenance"]).default("available"),
  availableFrom: z.string().optional(),
  ownerName: z.string().default("Proprietário"),
  companyName: z.string().optional(),
  ownerType: z.enum(["individual", "company"]).default("individual"),
  phone: z.string().min(1),
  whatsapp: z.string().min(1),
  description: z.string().default(""),
  images: z.array(z.string().min(1)).default([]),
  verified: z.boolean().default(false),
  restrictions: z.array(z.string()).default([]),
  ratings: ratingSchema.optional(),
});

const responseSchema = z.union([
  z.array(truckSchema),
  z.object({ data: z.array(truckSchema) }).transform(({ data }) => data),
  z.object({ trucks: z.array(truckSchema) }).transform(({ trucks }) => trucks),
]);

export async function listTrucks(): Promise<Truck[]> {
  const apiUrl = process.env.AGROTRUCK_DIRECTORY_API_URL;
  if (!apiUrl) return demoTrucks;

  try {
    const response = await fetch(apiUrl, {
      headers: process.env.AGROTRUCK_DIRECTORY_API_TOKEN
        ? { Authorization: `Bearer ${process.env.AGROTRUCK_DIRECTORY_API_TOKEN}` }
        : undefined,
      next: { revalidate: Number(process.env.AGROTRUCK_DIRECTORY_REVALIDATE_SECONDS ?? 300) },
    });

    if (!response.ok) throw new Error(`API ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Réponse API invalide");

    return parsed.data.map((truck) => ({
      ...truck,
      type: truck.type as TruckType,
      availability: truck.availability as TruckAvailability,
      images: truck.images.length
        ? truck.images.map((image) => toAbsoluteImageUrl(image, apiUrl))
        : ["/brand/agrotruck-truck-placeholder.png"],
    }));
  } catch (error) {
    console.error("AgroTruck directory API unavailable", error);
    return [];
  }
}

export async function findTruckBySlug(slug: string): Promise<Truck | undefined> {
  return (await listTrucks()).find((truck) => truck.slug === slug);
}

export async function listCompanies(): Promise<TransportCompany[]> {
  return groupTrucksByCompany(await listTrucks());
}

export async function findCompanyBySlug(slug: string): Promise<TransportCompany | undefined> {
  return (await listCompanies()).find((company) => company.slug === slug);
}

function toAbsoluteImageUrl(image: string, apiUrl: string) {
  if (image.startsWith("/brand/")) return image;
  try {
    return new URL(image, apiUrl).toString();
  } catch {
    return "/brand/agrotruck-truck-placeholder.png";
  }
}

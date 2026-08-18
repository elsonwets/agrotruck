import "server-only";

import { z } from "zod";
import { trucks as demoTrucks } from "@/data/trucks";
import { getSiteUrl } from "@/lib/site-url";
import type { Truck, TruckAvailability, TruckType } from "@/types/truck";

const truckSchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default(""),
  model: z.string().default(""),
  type: z.string(),
  listingMode: z.enum(["transport", "rental", "sale"]).default("transport"),
  capacityTons: z.coerce.number().nonnegative(),
  location: z.string().min(1),
  serviceAreas: z.array(z.string()).default([]),
  acceptedMaterials: z.array(z.string()).default([]),
  availability: z.string(),
  availableFrom: z.string().optional(),
  phone: z.string().min(1),
  whatsapp: z.string().min(1),
  description: z.string().default(""),
  images: z.array(z.string().min(1)).default([]),
  restrictions: z.array(z.string()).default([]),
  ratings: z.object({ overall: z.number(), vehicleQuality: z.number(), professionalism: z.number(), reliability: z.number(), reviewCount: z.number().int().nonnegative() }).optional(),
});

const responseSchema = z.array(truckSchema);

export async function listTrucks(): Promise<Truck[]> {
  if (!process.env.URL) return demoTrucks;

  try {
    const response = await fetch(`${getSiteUrl()}/.netlify/functions/trucks`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Fonction trucks : ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Réponse de la fonction trucks invalide");
    return parsed.data.map(toTruck);
  } catch (error) {
    console.error("Fonction AgroTrucks indisponible au build", error);
    return [];
  }
}

export async function findTruckBySlug(slug: string): Promise<Truck | undefined> {
  return (await listTrucks()).find((truck) => truck.slug === slug);
}

function toTruck(truck: z.infer<typeof truckSchema>): Truck {
  return {
    ...truck,
    type: truck.type as TruckType,
    availability: truck.availability as TruckAvailability,
    ownerAccountId: "",
    ownerName: "AgroTrucks by Badora",
    ownerType: "company",
    listingStatus: "published",
    images: truck.images.length ? truck.images : ["/brand/agrotruck-truck-placeholder.png"],
  };
}

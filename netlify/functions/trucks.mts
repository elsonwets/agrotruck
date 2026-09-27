import { z } from "zod";
import {
  createTruck, updateTruck, setListingStatus, findTruckById,
  listPublishedTrucks, listTrucksByOwner, listAllTrucks,
} from "./_lib/trucks";
import { triggerRebuild } from "./_lib/rebuild";
import { getActiveSession } from "./_lib/session";
import type { Truck } from "../../types/truck";

const truckInputSchema = z.object({
  name: z.string().min(1),
  brand: z.string().default(""),
  model: z.string().default(""),
  type: z.enum(["flatbed", "covered", "dump_truck", "cargo", "refrigerated", "tanker", "container", "crane", "pickup", "cargo_tricycle", "road_tractor", "flatbed_trailer", "covered_trailer", "agricultural_tractor", "farm_trailer", "loader", "road_machine", "private_taxi", "shared_taxi", "seven_seater", "toca_toca", "minibus", "candonga", "coach", "suv", "chauffeur_car"]),
  listingMode: z.enum(["transport", "rental", "sale"]).default("transport"),
  capacityTons: z.coerce.number().nonnegative(),
  location: z.string().min(1),
  serviceAreas: z.array(z.string()).default([]),
  acceptedMaterials: z.array(z.string()).default([]),
  availability: z.enum(["available", "in_transit", "maintenance"]).default("available"),
  availableFrom: z.string().optional(),
  ownerName: z.string().min(1),
  companyName: z.string().optional(),
  ownerType: z.enum(["individual", "company"]),
  phone: z.string().min(1),
  whatsapp: z.string().min(1),
  description: z.string().default(""),
  images: z.array(z.string().url()).min(1),
  restrictions: z.array(z.string()).default([]),
});

const handler = async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === "GET") return handleGet(request, url);
  if (request.method === "POST" && url.searchParams.get("id")) return handleModerate(request, url);
  if (request.method === "POST") return handleCreate(request);
  if (request.method === "PATCH") return handleUpdate(request, url);
  return json({ error: "Méthode non autorisée" }, 405);
};

export default handler;

async function handleGet(request: Request, url: URL) {
  const session = await getActiveSession(request);

  if (url.searchParams.get("mine")) {
    if (!session) return json({ error: "Non connecté" }, 401);
    return json(await listTrucksByOwner(session.accountId));
  }

  if (url.searchParams.get("scope") === "fleet") {
    if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
    return json(await listAllTrucks());
  }

  if (url.searchParams.get("status") === "pending") {
    if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
    return json((await listAllTrucks()).filter((truck) => truck.listingStatus === "pending"));
  }

  const slug = url.searchParams.get("slug");
  const published = await listPublishedTrucks();
  if (slug) {
    const truck = published.find((candidate) => candidate.slug === slug);
    return truck ? json(stripOwner(truck)) : json({ error: "Camion introuvable" }, 404);
  }
  return json(published.map(stripOwner));
}

async function handleCreate(request: Request) {
  const session = await getActiveSession(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const parsed = truckInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  const truck = await createTruck(parsed.data, session.accountId);
  return json(truck, 201);
}

async function handleUpdate(request: Request, url: URL) {
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "id requis" }, 400);
  const session = await getActiveSession(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const existing = await findTruckById(id);
  if (!existing) return json({ error: "Camion introuvable" }, 404);
  if (existing.ownerAccountId !== session.accountId && session.role !== "admin") return json({ error: "Interdit" }, 403);
  const parsed = truckInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  const updated = await updateTruck(id, parsed.data);
  triggerRebuild();
  return json(updated);
}

async function handleModerate(request: Request, url: URL) {
  const session = await getActiveSession(request);
  if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  const id = url.searchParams.get("id")!;
  const action = url.searchParams.get("action");
  if (action !== "publish" && action !== "reject") return json({ error: "Action invalide" }, 400);
  const updated = await setListingStatus(id, action === "publish" ? "published" : "rejected");
  if (!updated) return json({ error: "Camion introuvable" }, 404);
  triggerRebuild();
  return json(updated);
}

function stripOwner(truck: Truck) {
  const {
    id, slug, name, brand, model, type, listingMode, capacityTons, location,
    serviceAreas, acceptedMaterials, availability, availableFrom, ownerType,
    phone, whatsapp, description, images, listingStatus, restrictions, ratings,
  } = truck;
  return {
    id, slug, name, brand, model, type, listingMode, capacityTons, location,
    serviceAreas, acceptedMaterials, availability, availableFrom, ownerType,
    phone, whatsapp, description, images, listingStatus, restrictions, ratings,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

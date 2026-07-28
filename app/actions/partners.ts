"use server";

import { randomInt } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireDatabase } from "@/db";
import { trucks, users } from "@/db/schema";
import { auth } from "@/lib/auth";

const truckSchema = z.object({
  accountType: z.enum(["particulier", "company"]),
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(30),
  whatsapp: z.string().min(7).max(30),
  email: z.email(),
  city: z.string().min(1).max(100),
  companyName: z.string().max(160).optional(),
  truckType: z.enum(["flatbed", "dump_truck", "cargo", "container", "trailer", "canter"]),
  brand: z.string().min(2).max(80),
  model: z.string().min(1).max(100),
  capacity: z.number().int().positive().max(200),
  registration: z.string().min(3).max(40),
  acceptedMaterials: z.array(z.string()).min(1).max(30),
  serviceAreas: z.array(z.string()).min(1).max(30),
  availability: z.enum(["available", "in_transit", "occupied", "maintenance"]),
  terms: z.literal(true),
});

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export async function createTruck(rawData: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = truckSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: "Verifique os dados do proprietário e do truck." };
  const data = parsed.data;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Confirme o seu email antes de cadastrar um truck." };
    if (session.user.email.toLowerCase() !== data.email.toLowerCase()) {
      return { success: false, error: "O email do formulário não corresponde à conta autenticada." };
    }
    const db = requireDatabase();
    const [{ value: truckCount }] = await db.select({ value: count() }).from(trucks).where(eq(trucks.ownerId, session.user.id));
    if (data.accountType === "particulier" && truckCount >= 5) {
      return { success: false, error: "O plano Particular permite no máximo 5 trucks. Escolha o plano Empresa para adicionar mais." };
    }
    await db.update(users).set({
      accountType: data.accountType === "company" ? "company" : "individual",
      name: data.name,
      phone: data.phone,
      whatsapp: data.whatsapp,
      city: data.city,
      companyName: data.accountType === "company" ? data.companyName : null,
      updatedAt: new Date(),
    }).where(eq(users.id, session.user.id));
    const slug = `${slugify(`${data.brand}-${data.model}`)}-${randomInt(1000, 10000)}`;
    const inserted = await db.insert(trucks).values({
      ownerId: session.user.id,
      slug,
      name: `${data.brand} ${data.model}`,
      brand: data.brand,
      model: data.model,
      type: data.truckType,
      capacityTons: data.capacity,
      registration: data.registration.toUpperCase(),
      location: data.city,
      serviceAreas: data.serviceAreas,
      acceptedMaterials: data.acceptedMaterials,
      availability: data.availability,
      description: `Truck ${data.brand} ${data.model} de ${data.capacity} toneladas, disponível para contacto direto através da AgroTruck.`,
      images: [],
      restrictions: ["Condições e preço a confirmar diretamente com o proprietário"],
      verified: false,
      publicationStatus: "pending_payment",
    }).returning({ id: trucks.id, slug: trucks.slug });
    revalidatePath("/");
    revalidatePath("/trucks");
    revalidatePath("/entreprises");
    return { success: true, data: inserted[0] };
  } catch (error) {
    if (String(error).toLowerCase().includes("registration")) return { success: false, error: "Já existe um truck com esta matrícula." };
    return { success: false, error: databaseError(error) };
  }
}

export async function updateTruckAvailability(registration: string, rawAvailability: string): Promise<ActionResult> {
  const availability = z.enum(["available", "in_transit", "occupied", "maintenance"]).safeParse(rawAvailability);
  if (!availability.success) return { success: false, error: "Dados de disponibilidade inválidos." };
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "A sua sessão expirou. Confirme novamente o seu email." };
    const db = requireDatabase();
    const updated = await db.update(trucks).set({ availability: availability.data, updatedAt: new Date() }).where(and(eq(trucks.ownerId, session.user.id), eq(trucks.registration, registration.toUpperCase()))).returning({ id: trucks.id });
    if (!updated[0]) return { success: false, error: "Truck não encontrado." };
    revalidatePath("/");
    revalidatePath("/trucks");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: databaseError(error) };
  }
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function databaseError(error: unknown) {
  console.error("AgroTruck database action failed", error);
  return error instanceof Error && error.message.includes("DATABASE_URL")
    ? "A ligação Neon ainda não está configurada. Adicione DATABASE_URL em .env.local."
    : "Não foi possível guardar os dados. Tente novamente.";
}

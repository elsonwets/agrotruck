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
  driverName: z.string().max(120).optional(),
  driverPhone: z.string().max(30).optional(),
  apprenticeName: z.string().max(120).optional(),
  apprenticePhone: z.string().max(30).optional(),
  terms: z.literal(true),
});

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

export async function configureOwnerType(rawType: unknown): Promise<ActionResult<{ accountType: "individual" | "company" }>> {
  const accountType = z.enum(["individual", "company"]).safeParse(rawType);
  if (!accountType.success) return { success: false, error: "Escolha Particular ou Empresa." };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false, error: "Entre na sua conta para continuar." };
  const db = requireDatabase();
  const [current] = await db.select({ configured: users.accountTypeConfigured, accountType: users.accountType }).from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!current) return { success: false, error: "Conta não encontrada." };
  if (current.configured) return { success: true, data: { accountType: current.accountType === "company" ? "company" : "individual" } };
  await db.update(users).set({ accountType: accountType.data, accountTypeConfigured: true, updatedAt: new Date() }).where(eq(users.id, session.user.id));
  revalidatePath("/devenir-partenaire");
  revalidatePath("/dashboard");
  return { success: true, data: { accountType: accountType.data } };
}

export async function createTruck(rawData: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = truckSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: "Verifique os dados do proprietário e do truck." };
  const data = parsed.data;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "Entre na sua conta antes de cadastrar um truck." };
    if (session.user.email.toLowerCase() !== data.email.toLowerCase()) {
      return { success: false, error: "O email do formulário não corresponde à conta autenticada." };
    }
    const db = requireDatabase();
    const [owner] = await db.select({ accountType: users.accountType, configured: users.accountTypeConfigured }).from(users).where(eq(users.id, session.user.id)).limit(1);
    if (!owner?.configured) return { success: false, error: "Escolha primeiro o seu perfil Particular ou Empresa." };
    const isCompany = owner.accountType === "company";
    if (isCompany && [data.driverName, data.driverPhone, data.apprenticeName, data.apprenticePhone].some((value) => !value?.trim())) {
      return { success: false, error: "Indique o motorista, o ajudante e os respetivos telefones." };
    }
    const [{ value: truckCount }] = await db.select({ value: count() }).from(trucks).where(eq(trucks.ownerId, session.user.id));
    if (!isCompany && truckCount >= 5) {
      return { success: false, error: "O perfil Particular permite no máximo 5 trucks." };
    }
    await db.update(users).set({
      name: data.name,
      phone: data.phone,
      whatsapp: data.whatsapp,
      city: data.city,
      companyName: isCompany ? data.companyName : null,
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
      availability: "available",
      description: `Truck ${data.brand} ${data.model} de ${data.capacity} toneladas, disponível para contacto direto através da AgroTruck.`,
      images: [],
      restrictions: ["Condições e preço a confirmar diretamente com o proprietário"],
      verified: false,
      publicationStatus: "pending_payment",
      isOnline: false,
      driverName: isCompany ? data.driverName : null,
      driverPhone: isCompany ? data.driverPhone : null,
      apprenticeName: isCompany ? data.apprenticeName : null,
      apprenticePhone: isCompany ? data.apprenticePhone : null,
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

export async function updateTruckAvailability(truckId: string, rawAvailability: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(truckId);
  const availability = z.enum(["available", "in_transit", "maintenance"]).safeParse(rawAvailability);
  if (!id.success) return { success: false, error: "Truck inválido." };
  if (!availability.success) return { success: false, error: "Dados de disponibilidade inválidos." };
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "A sua sessão expirou. Confirme novamente o seu email." };
    const db = requireDatabase();
    const updated = await db.update(trucks).set({ availability: availability.data, updatedAt: new Date() }).where(and(eq(trucks.ownerId, session.user.id), eq(trucks.id, id.data), eq(trucks.isOnline, true))).returning({ id: trucks.id });
    if (!updated[0]) return { success: false, error: "Truck não encontrado." };
    revalidatePath("/");
    revalidatePath("/trucks");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: databaseError(error) };
  }
}

export async function setTruckOnline(truckId: string): Promise<ActionResult> {
  const id = z.uuid().safeParse(truckId);
  if (!id.success) return { success: false, error: "Truck inválido." };
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "A sua sessão expirou. Entre novamente." };
    const updated = await requireDatabase().update(trucks).set({ isOnline: true, availability: "available", updatedAt: new Date() }).where(and(
      eq(trucks.id, id.data),
      eq(trucks.ownerId, session.user.id),
      eq(trucks.verified, true),
      eq(trucks.publicationStatus, "published"),
    )).returning({ id: trucks.id });
    if (!updated[0]) return { success: false, error: "A AgroTruck deve validar este truck antes de o colocar online." };
    revalidateTruckPages();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: databaseError(error) };
  }
}

const crewSchema = z.object({
  truckId: z.uuid(),
  driverName: z.string().min(2).max(120),
  driverPhone: z.string().min(7).max(30),
  apprenticeName: z.string().min(2).max(120),
  apprenticePhone: z.string().min(7).max(30),
});

export async function updateTruckCrew(rawData: unknown): Promise<ActionResult> {
  const parsed = crewSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: "Verifique os nomes e telefones da equipa." };
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { success: false, error: "A sua sessão expirou. Entre novamente." };
    const updated = await requireDatabase().update(trucks).set({
      driverName: parsed.data.driverName,
      driverPhone: parsed.data.driverPhone,
      apprenticeName: parsed.data.apprenticeName,
      apprenticePhone: parsed.data.apprenticePhone,
      updatedAt: new Date(),
    }).where(and(eq(trucks.id, parsed.data.truckId), eq(trucks.ownerId, session.user.id))).returning({ id: trucks.id });
    if (!updated[0]) return { success: false, error: "Truck não encontrado." };
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: databaseError(error) };
  }
}

function revalidateTruckPages() {
  revalidatePath("/");
  revalidatePath("/trucks");
  revalidatePath("/entreprises");
  revalidatePath("/dashboard");
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

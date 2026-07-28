"use server";

import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDatabase } from "@/db";
import { emailVerificationCodes, trucks, users } from "@/db/schema";

const emailSchema = z.email().transform((email) => email.trim().toLowerCase());
const codeSchema = z.string().regex(/^\d{6}$/);
const truckSchema = z.object({
  accountType: z.enum(["particulier", "independent", "company"]),
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

export async function requestEmailVerification(rawEmail: string): Promise<ActionResult<{ previewCode?: string }>> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { success: false, error: "Introduza um endereço de email válido." };
  try {
    const db = requireDatabase();
    const code = randomInt(100000, 1000000).toString();
    await db.insert(emailVerificationCodes).values({
      email: parsed.data,
      codeHash: hashCode(parsed.data, code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    // À remplacer par Resend/Brevo. Le code n'est renvoyé que pour cette version de démonstration.
    return { success: true, data: { previewCode: code } };
  } catch (error) {
    return { success: false, error: databaseError(error) };
  }
}

export async function confirmEmailVerification(rawEmail: string, rawCode: string): Promise<ActionResult> {
  const email = emailSchema.safeParse(rawEmail);
  const code = codeSchema.safeParse(rawCode);
  if (!email.success || !code.success) return { success: false, error: "Código de confirmação inválido." };
  try {
    const db = requireDatabase();
    const matches = await db.select().from(emailVerificationCodes).where(and(
      eq(emailVerificationCodes.email, email.data),
      eq(emailVerificationCodes.codeHash, hashCode(email.data, code.data)),
      gt(emailVerificationCodes.expiresAt, new Date()),
      isNull(emailVerificationCodes.usedAt),
    )).orderBy(desc(emailVerificationCodes.createdAt)).limit(1);
    if (!matches[0]) return { success: false, error: "O código expirou ou não está correto." };
    await db.update(emailVerificationCodes).set({ usedAt: new Date() }).where(eq(emailVerificationCodes.id, matches[0].id));
    await db.insert(users).values({ email: email.data, emailVerified: true }).onConflictDoUpdate({ target: users.email, set: { emailVerified: true, updatedAt: new Date() } });
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: databaseError(error) };
  }
}

export async function createTruck(rawData: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = truckSchema.safeParse(rawData);
  if (!parsed.success) return { success: false, error: "Verifique os dados do proprietário e do truck." };
  const data = parsed.data;
  const email = data.email.toLowerCase();
  try {
    const db = requireDatabase();
    const existingUsers = await db.select().from(users).where(and(eq(users.email, email), eq(users.emailVerified, true))).limit(1);
    const user = existingUsers[0];
    if (!user) return { success: false, error: "Confirme o seu email antes de cadastrar um truck." };
    await db.update(users).set({
      accountType: data.accountType === "company" ? "company" : "individual",
      name: data.name,
      phone: data.phone,
      whatsapp: data.whatsapp,
      city: data.city,
      companyName: data.accountType === "company" ? data.companyName : null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
    const slug = `${slugify(`${data.brand}-${data.model}`)}-${randomInt(1000, 10000)}`;
    const inserted = await db.insert(trucks).values({
      ownerId: user.id,
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
      images: ["/brand/agrotruck-mark.png"],
      restrictions: ["Condições e preço a confirmar diretamente com o proprietário"],
    }).returning({ id: trucks.id, slug: trucks.slug });
    revalidatePath("/");
    revalidatePath("/trucks");
    return { success: true, data: inserted[0] };
  } catch (error) {
    if (String(error).toLowerCase().includes("registration")) return { success: false, error: "Já existe um truck com esta matrícula." };
    return { success: false, error: databaseError(error) };
  }
}

export async function updateTruckAvailability(rawEmail: string, registration: string, rawAvailability: string): Promise<ActionResult> {
  const email = emailSchema.safeParse(rawEmail);
  const availability = z.enum(["available", "in_transit", "occupied", "maintenance"]).safeParse(rawAvailability);
  if (!email.success || !availability.success) return { success: false, error: "Dados de disponibilidade inválidos." };
  try {
    const db = requireDatabase();
    const owners = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email.data), eq(users.emailVerified, true))).limit(1);
    if (!owners[0]) return { success: false, error: "Utilizador não verificado." };
    const updated = await db.update(trucks).set({ availability: availability.data, updatedAt: new Date() }).where(and(eq(trucks.ownerId, owners[0].id), eq(trucks.registration, registration.toUpperCase()))).returning({ id: trucks.id });
    if (!updated[0]) return { success: false, error: "Truck não encontrado." };
    revalidatePath("/");
    revalidatePath("/trucks");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: databaseError(error) };
  }
}

function hashCode(email: string, code: string) {
  const secret = process.env.VERIFICATION_CODE_SECRET ?? process.env.DATABASE_URL ?? "agrotruck-development";
  return createHash("sha256").update(`${email}:${code}:${secret}`).digest("hex");
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

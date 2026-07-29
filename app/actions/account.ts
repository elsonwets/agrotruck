"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDatabase } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";

const profileSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(30),
  whatsapp: z.string().min(7).max(30),
  city: z.string().min(1).max(100),
  companyName: z.string().max(160).optional(),
});

export async function updateProfile(rawData: unknown) {
  const parsed = profileSchema.safeParse(rawData);
  if (!parsed.success) return { success: false as const, error: "Verifique os seus dados de contacto." };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false as const, error: "A sua sessão expirou. Entre novamente." };
  await requireDatabase().update(users).set({
    name: parsed.data.name,
    phone: parsed.data.phone,
    whatsapp: parsed.data.whatsapp,
    city: parsed.data.city,
    companyName: session.user.accountType === "company" ? parsed.data.companyName : null,
    updatedAt: new Date(),
  }).where(eq(users.id, session.user.id));
  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { success: true as const };
}

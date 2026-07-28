"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireDatabase } from "@/db";
import { trucks } from "@/db/schema";
import { isAdminEmail } from "@/lib/admin";
import { auth } from "@/lib/auth";

const reviewSchema = z.object({ truckId: z.uuid(), decision: z.enum(["publish", "reject"]) });

export async function reviewTruckPublication(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminEmail(session.user.email)) throw new Error("Acesso administrativo recusado.");
  const parsed = reviewSchema.safeParse({ truckId: formData.get("truckId"), decision: formData.get("decision") });
  if (!parsed.success) throw new Error("Pedido de validação inválido.");
  const now = new Date();
  await requireDatabase().update(trucks).set(parsed.data.decision === "publish" ? {
    publicationStatus: "published", verified: true, paymentConfirmedAt: now, approvedAt: now, updatedAt: now,
  } : {
    publicationStatus: "rejected", verified: false, updatedAt: now,
  }).where(eq(trucks.id, parsed.data.truckId));
  revalidatePath("/");
  revalidatePath("/trucks");
  revalidatePath("/entreprises");
  revalidatePath("/admin/trucks");
}

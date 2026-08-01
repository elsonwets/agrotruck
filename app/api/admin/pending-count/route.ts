import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { requireDatabase } from "@/db";
import { trucks } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isAdminUser(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [result] = await requireDatabase().select({ value: count() }).from(trucks).where(eq(trucks.publicationStatus, "pending_payment"));
  return NextResponse.json({ count: result.value }, { headers: { "Cache-Control": "no-store" } });
}

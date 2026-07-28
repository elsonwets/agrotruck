import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDatabase();
  if (!db) return NextResponse.json({ connected: false, error: "DATABASE_URL is not configured" }, { status: 503 });
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ connected: true, provider: "Neon Postgres" });
  } catch {
    return NextResponse.json({ connected: false, error: "Database connection failed" }, { status: 503 });
  }
}

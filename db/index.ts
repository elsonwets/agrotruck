import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | null = null;

function createDatabase(connectionString: string) {
  return drizzle(neon(connectionString), { schema });
}

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  database ??= createDatabase(connectionString);
  return database;
}

export function requireDatabase() {
  const db = getDatabase();
  if (!db) throw new Error("DATABASE_URL não está configurada.");
  return db;
}

export const db = requireDatabase();

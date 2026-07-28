import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não está configurada.");
}

const database = drizzle(neon(process.env.DATABASE_URL));
await migrate(database, { migrationsFolder: "./drizzle" });
console.log("Migrações Neon aplicadas.");

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { trucks as demoTrucks } from "../data/trucks";
import { trucks, users } from "../db/schema";

config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required in .env.local");
  const db = drizzle(neon(connectionString));

  for (const truck of demoTrucks) {
    const email = `${slugify(truck.ownerName)}@demo.agrotruck.gw`;
    const insertedUsers = await db.insert(users).values({
    email,
    emailVerified: true,
    accountType: truck.ownerType,
    name: truck.ownerName,
    phone: truck.phone,
    whatsapp: truck.whatsapp,
    city: truck.location,
    companyName: truck.companyName,
  }).onConflictDoUpdate({
    target: users.email,
    set: { name: truck.ownerName, phone: truck.phone, whatsapp: truck.whatsapp, city: truck.location, companyName: truck.companyName, updatedAt: new Date() },
  }).returning({ id: users.id });
    const owner = insertedUsers[0] ?? (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
    await db.insert(trucks).values({
    ownerId: owner.id,
    slug: truck.slug,
    name: truck.name,
    brand: truck.brand,
    model: truck.model,
    type: truck.type,
    capacityTons: truck.capacityTons,
    registration: `DEMO-${truck.id.toUpperCase()}`,
    location: truck.location,
    serviceAreas: truck.serviceAreas,
    acceptedMaterials: truck.acceptedMaterials,
    availability: truck.availability,
    availableFrom: truck.availableFrom,
    description: truck.description,
    images: truck.images,
    restrictions: truck.restrictions,
    verified: truck.verified,
    }).onConflictDoNothing({ target: trucks.slug });
  }

  console.log(`Seed complete: ${demoTrucks.length} trucks processed.`);
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  accountType: text("account_type").notNull().default("individual"),
  name: text("name"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  city: text("city"),
  companyName: text("company_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("users_email_idx").on(table.email)]);

export const emailVerificationCodes = pgTable("email_verification_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("verification_email_idx").on(table.email, table.createdAt)]);

export const trucks = pgTable("trucks", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  type: text("type").notNull(),
  capacityTons: integer("capacity_tons").notNull(),
  registration: text("registration").notNull(),
  location: text("location").notNull(),
  serviceAreas: jsonb("service_areas").$type<string[]>().notNull().default([]),
  acceptedMaterials: jsonb("accepted_materials").$type<string[]>().notNull().default([]),
  availability: text("availability").notNull().default("available"),
  availableFrom: text("available_from"),
  description: text("description").notNull().default(""),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  restrictions: jsonb("restrictions").$type<string[]>().notNull().default([]),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("trucks_slug_unique").on(table.slug),
  uniqueIndex("trucks_registration_unique").on(table.registration),
  index("trucks_owner_idx").on(table.ownerId),
  index("trucks_location_idx").on(table.location),
  index("trucks_availability_idx").on(table.availability),
]);

export type DatabaseUser = typeof users.$inferSelect;
export type DatabaseTruck = typeof trucks.$inferSelect;

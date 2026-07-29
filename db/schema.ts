import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  accountType: text("account_type").notNull().default("individual"),
  name: text("name").notNull().default(""),
  image: text("image"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  city: text("city"),
  companyName: text("company_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("users_email_idx").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("accounts_user_idx").on(table.userId)]);

export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("verifications_identifier_idx").on(table.identifier)]);

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
  publicationStatus: text("publication_status").notNull().default("pending_payment"),
  isOnline: boolean("is_online").notNull().default(false),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  apprenticeName: text("apprentice_name"),
  apprenticePhone: text("apprentice_phone"),
  paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("trucks_slug_unique").on(table.slug),
  uniqueIndex("trucks_registration_unique").on(table.registration),
  index("trucks_owner_idx").on(table.ownerId),
  index("trucks_location_idx").on(table.location),
  index("trucks_availability_idx").on(table.availability),
  index("trucks_publication_status_idx").on(table.publicationStatus),
  index("trucks_online_idx").on(table.isOnline),
]);

export type DatabaseUser = typeof users.$inferSelect;
export type DatabaseTruck = typeof trucks.$inferSelect;

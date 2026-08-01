ALTER TABLE "users" ADD COLUMN "account_type_configured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "account_type_configured" = true WHERE "company_name" IS NOT NULL OR EXISTS (SELECT 1 FROM "trucks" WHERE "trucks"."owner_id" = "users"."id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_number_unique" ON "users" USING btree ("phone_number");

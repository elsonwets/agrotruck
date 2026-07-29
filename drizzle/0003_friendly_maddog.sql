ALTER TABLE "trucks" ADD COLUMN "is_online" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "driver_name" text;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "driver_phone" text;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "apprentice_name" text;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "apprentice_phone" text;--> statement-breakpoint
UPDATE "trucks" SET "is_online" = true WHERE "verified" = true AND "publication_status" = 'published';--> statement-breakpoint
UPDATE "trucks" SET "availability" = 'maintenance' WHERE "availability" = 'occupied';--> statement-breakpoint
CREATE INDEX "trucks_online_idx" ON "trucks" USING btree ("is_online");

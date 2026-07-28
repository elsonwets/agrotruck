ALTER TABLE "trucks" ADD COLUMN "publication_status" text DEFAULT 'pending_payment' NOT NULL;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "payment_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
UPDATE "trucks" SET "publication_status" = 'published', "payment_confirmed_at" = now(), "approved_at" = now() WHERE "verified" = true;--> statement-breakpoint
CREATE INDEX "trucks_publication_status_idx" ON "trucks" USING btree ("publication_status");

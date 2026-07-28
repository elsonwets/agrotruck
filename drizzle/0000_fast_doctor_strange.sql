CREATE TABLE "email_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"type" text NOT NULL,
	"capacity_tons" integer NOT NULL,
	"registration" text NOT NULL,
	"location" text NOT NULL,
	"service_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"accepted_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"availability" text DEFAULT 'available' NOT NULL,
	"available_from" text,
	"description" text DEFAULT '' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"restrictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"account_type" text DEFAULT 'individual' NOT NULL,
	"name" text,
	"phone" text,
	"whatsapp" text,
	"city" text,
	"company_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_email_idx" ON "email_verification_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "trucks_slug_unique" ON "trucks" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "trucks_registration_unique" ON "trucks" USING btree ("registration");--> statement-breakpoint
CREATE INDEX "trucks_owner_idx" ON "trucks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "trucks_location_idx" ON "trucks" USING btree ("location");--> statement-breakpoint
CREATE INDEX "trucks_availability_idx" ON "trucks" USING btree ("availability");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");
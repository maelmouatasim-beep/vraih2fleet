CREATE SCHEMA "marketing";
--> statement-breakpoint
CREATE TABLE "marketing"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"organization_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text,
	"locale" text NOT NULL,
	"consent_version" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"ip" "inet",
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "marketing"."leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_ip_idx" ON "marketing"."leads" USING btree ("ip");
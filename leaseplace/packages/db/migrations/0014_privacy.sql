CREATE SCHEMA "privacy";
--> statement-breakpoint
CREATE TABLE "privacy"."impersonations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"actor_session_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"target_organization_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "privacy"."requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text DEFAULT 'erasure' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_on" date NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"reject_reason" text,
	"reject_note" text,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "privacy"."retention_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"days" integer NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc"."documents" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "privacy"."impersonations" ADD CONSTRAINT "impersonations_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy"."impersonations" ADD CONSTRAINT "impersonations_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy"."impersonations" ADD CONSTRAINT "impersonations_target_organization_id_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy"."requests" ADD CONSTRAINT "requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy"."requests" ADD CONSTRAINT "requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy"."requests" ADD CONSTRAINT "requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy"."retention_settings" ADD CONSTRAINT "retention_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impersonations_session_idx" ON "privacy"."impersonations" USING btree ("actor_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "impersonations_one_open_idx" ON "privacy"."impersonations" USING btree ("actor_session_id") WHERE ended_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_requests_one_pending_idx" ON "privacy"."requests" USING btree ("organization_id","kind") WHERE status = 'pending';
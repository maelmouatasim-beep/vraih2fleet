CREATE SCHEMA "market";
--> statement-breakpoint
CREATE TABLE "kyc"."consent_recipients" (
	"consent_id" uuid NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	CONSTRAINT "consent_recipients_consent_id_lessor_organization_id_pk" PRIMARY KEY("consent_id","lessor_organization_id")
);
--> statement-breakpoint
CREATE TABLE "credit"."lessor_appetites" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"min_amount_ht" numeric(18, 2) NOT NULL,
	"max_amount_ht" numeric(18, 2) NOT NULL,
	"min_duration_months" integer NOT NULL,
	"max_duration_months" integer NOT NULL,
	"sectors" text[] DEFAULT '{}'::text[] NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"min_grade" char(1) DEFAULT 'C' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market"."offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"financed_amount_ht" numeric(18, 2) NOT NULL,
	"duration_months" integer NOT NULL,
	"periodicity" text NOT NULL,
	"timing" text NOT NULL,
	"annual_rate" numeric(9, 6) NOT NULL,
	"first_rent_ht" numeric(18, 2) NOT NULL,
	"rent_ht" numeric(18, 2) NOT NULL,
	"residual_value_ht" numeric(18, 2) NOT NULL,
	"file_fees_ht" numeric(18, 2) NOT NULL,
	"insurance_per_period_ht" numeric(18, 2) NOT NULL,
	"insurance_required" boolean NOT NULL,
	"vat_rate" numeric(5, 4) NOT NULL,
	"financing_cost_ht" numeric(18, 2) NOT NULL,
	"paid_ttc" numeric(18, 2) NOT NULL,
	"effective_rate" numeric(9, 6) NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"conditions" text DEFAULT '' NOT NULL,
	"submitted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit"."routing_decisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"grade" char(1) NOT NULL,
	"max_targets" integer NOT NULL,
	"profile" jsonb NOT NULL,
	"appetites" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit"."routing_targets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"decision_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	"status" text NOT NULL,
	"exclusions" jsonb NOT NULL,
	"rank" integer,
	"proposed" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"sla_due_at" timestamp with time zone,
	"first_viewed_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit"."target_declines" (
	"target_id" uuid PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"declined_by" uuid NOT NULL,
	"declined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc"."consent_recipients" ADD CONSTRAINT "consent_recipients_consent_id_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "kyc"."consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."consent_recipients" ADD CONSTRAINT "consent_recipients_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."lessor_appetites" ADD CONSTRAINT "lessor_appetites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."lessor_appetites" ADD CONSTRAINT "lessor_appetites_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."offers" ADD CONSTRAINT "offers_target_id_routing_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "credit"."routing_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."offers" ADD CONSTRAINT "offers_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."offers" ADD CONSTRAINT "offers_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."offers" ADD CONSTRAINT "offers_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."routing_decisions" ADD CONSTRAINT "routing_decisions_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."routing_decisions" ADD CONSTRAINT "routing_decisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."routing_targets" ADD CONSTRAINT "routing_targets_decision_id_routing_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "credit"."routing_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."routing_targets" ADD CONSTRAINT "routing_targets_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."routing_targets" ADD CONSTRAINT "routing_targets_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."target_declines" ADD CONSTRAINT "target_declines_target_id_routing_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "credit"."routing_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."target_declines" ADD CONSTRAINT "target_declines_declined_by_users_id_fk" FOREIGN KEY ("declined_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offers_request_idx" ON "market"."offers" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_one_live_per_target_idx" ON "market"."offers" USING btree ("target_id") WHERE status = 'submitted';--> statement-breakpoint
CREATE INDEX "routing_decisions_request_idx" ON "credit"."routing_decisions" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_targets_decision_lessor_idx" ON "credit"."routing_targets" USING btree ("decision_id","lessor_organization_id");--> statement-breakpoint
CREATE INDEX "routing_targets_lessor_idx" ON "credit"."routing_targets" USING btree ("lessor_organization_id","status");--> statement-breakpoint
CREATE INDEX "routing_targets_request_idx" ON "credit"."routing_targets" USING btree ("request_id");
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE TABLE "billing"."commissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	"mandate_id" uuid NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"financed_amount_ht" numeric(18, 2) NOT NULL,
	"grid" jsonb NOT NULL,
	"amount_ht" numeric(18, 2) NOT NULL,
	"vat_rate" numeric(5, 4) NOT NULL,
	"vat" numeric(18, 2) NOT NULL,
	"amount_ttc" numeric(18, 2) NOT NULL,
	"activated_on" date NOT NULL,
	"invoice_id" uuid,
	"paid_on" date,
	"payment_reference" text,
	"cancel_reason" text,
	"cancel_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_deal_id_unique" UNIQUE("deal_id")
);
--> statement-breakpoint
CREATE TABLE "billing"."invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	"issued_on" date NOT NULL,
	"due_on" date NOT NULL,
	"amount_ht" numeric(18, 2) NOT NULL,
	"vat_rate" numeric(5, 4) NOT NULL,
	"vat" numeric(18, 2) NOT NULL,
	"amount_ttc" numeric(18, 2) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "billing"."mandates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"contract_version" text DEFAULT '' NOT NULL,
	"signed_on" date,
	"grid" jsonb NOT NULL,
	"anti_circumvention" boolean DEFAULT true NOT NULL,
	"anti_circumvention_months" integer DEFAULT 24 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"activated_at" timestamp with time zone,
	"terminated_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing"."commissions" ADD CONSTRAINT "commissions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "market"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."commissions" ADD CONSTRAINT "commissions_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."commissions" ADD CONSTRAINT "commissions_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."commissions" ADD CONSTRAINT "commissions_mandate_id_mandates_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "billing"."mandates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."commissions" ADD CONSTRAINT "commissions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "billing"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoices" ADD CONSTRAINT "invoices_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."mandates" ADD CONSTRAINT "mandates_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."mandates" ADD CONSTRAINT "mandates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commissions_lessor_idx" ON "billing"."commissions" USING btree ("lessor_organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mandates_one_active_idx" ON "billing"."mandates" USING btree ("lessor_organization_id") WHERE status = 'active';
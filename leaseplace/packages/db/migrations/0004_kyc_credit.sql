CREATE SCHEMA "kyc";
--> statement-breakpoint
CREATE SCHEMA "credit";
--> statement-breakpoint
CREATE TABLE "kyc"."companies" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"ice" text NOT NULL,
	"rc_number" text,
	"rc_court" text,
	"tax_id" text,
	"cnss_number" text,
	"legal_form" text NOT NULL,
	"incorporation_date" date,
	"sector" text NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"revenue_band" text,
	"headcount_band" text,
	"kyc_status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "companies_ice_unique" UNIQUE("ice")
);
--> statement-breakpoint
CREATE TABLE "kyc"."consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid,
	"purpose" text NOT NULL,
	"legal_text_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid
);
--> statement-breakpoint
CREATE TABLE "kyc"."documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"issued_on" date,
	"scan_result" text,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "kyc"."legal_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"locale" text NOT NULL,
	"body" text NOT NULL,
	"body_sha256" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit"."financing_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"product_type" text DEFAULT 'lease' NOT NULL,
	"currency" text DEFAULT 'MAD' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"equipment_category" text,
	"equipment_description" text,
	"condition" text,
	"equipment_year" integer,
	"supplier_name" text,
	"amount_ht" numeric(18, 2),
	"vat_rate" numeric(5, 4) DEFAULT 0.2 NOT NULL,
	"first_rent_pct" numeric(5, 2),
	"duration_months" integer,
	"residual_pct" numeric(5, 2),
	"periodicity" text,
	"submitted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "financing_requests_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "credit"."request_documents" (
	"request_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"attached_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_documents_request_id_document_id_pk" PRIMARY KEY("request_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "credit"."request_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit"."request_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_user_id" uuid,
	"visible_to_client" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc"."companies" ADD CONSTRAINT "companies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."consents" ADD CONSTRAINT "consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."consents" ADD CONSTRAINT "consents_legal_text_id_legal_texts_id_fk" FOREIGN KEY ("legal_text_id") REFERENCES "kyc"."legal_texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."consents" ADD CONSTRAINT "consents_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."consents" ADD CONSTRAINT "consents_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."financing_requests" ADD CONSTRAINT "financing_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."financing_requests" ADD CONSTRAINT "financing_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."request_documents" ADD CONSTRAINT "request_documents_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."request_documents" ADD CONSTRAINT "request_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "kyc"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."request_events" ADD CONSTRAINT "request_events_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consents_org_idx" ON "kyc"."consents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "consents_request_idx" ON "kyc"."consents" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "documents_org_idx" ON "kyc"."documents" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_org_sha_live_idx" ON "kyc"."documents" USING btree ("organization_id","sha256") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "legal_texts_kind_version_locale_idx" ON "kyc"."legal_texts" USING btree ("kind","version","locale");--> statement-breakpoint
CREATE INDEX "requests_org_idx" ON "credit"."financing_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "credit"."financing_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "request_events_request_idx" ON "credit"."request_events" USING btree ("request_id");
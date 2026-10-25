CREATE TABLE "credit"."ai_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid,
	"document_id" uuid,
	"input_sha256" text NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"output" jsonb,
	"issues" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit"."credit_memos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"ai_run_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"content" jsonb NOT NULL,
	"source_map" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "kyc"."document_extractions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"document_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"ai_run_id" uuid,
	"prompt_version" text NOT NULL,
	"readable" boolean NOT NULL,
	"fields" jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc"."kyc_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" text NOT NULL,
	"document_ids" jsonb NOT NULL,
	"expected" jsonb,
	"found" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit"."risk_assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"model_version" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"ratios" jsonb NOT NULL,
	"factors" jsonb NOT NULL,
	"flags" jsonb NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"grade" char(1) NOT NULL,
	"uncapped_grade" char(1) NOT NULL,
	"check_run_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit"."risk_overrides" (
	"id" uuid PRIMARY KEY NOT NULL,
	"assessment_id" uuid NOT NULL,
	"grade" char(1) NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc"."documents" ADD COLUMN "review_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc"."documents" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "credit"."ai_runs" ADD CONSTRAINT "ai_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."ai_runs" ADD CONSTRAINT "ai_runs_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."ai_runs" ADD CONSTRAINT "ai_runs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "kyc"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."ai_runs" ADD CONSTRAINT "ai_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."credit_memos" ADD CONSTRAINT "credit_memos_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."credit_memos" ADD CONSTRAINT "credit_memos_assessment_id_risk_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "credit"."risk_assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."credit_memos" ADD CONSTRAINT "credit_memos_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "credit"."ai_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."credit_memos" ADD CONSTRAINT "credit_memos_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."credit_memos" ADD CONSTRAINT "credit_memos_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."document_extractions" ADD CONSTRAINT "document_extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "kyc"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."document_extractions" ADD CONSTRAINT "document_extractions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."document_extractions" ADD CONSTRAINT "document_extractions_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "credit"."ai_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."kyc_checks" ADD CONSTRAINT "kyc_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc"."kyc_checks" ADD CONSTRAINT "kyc_checks_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."risk_assessments" ADD CONSTRAINT "risk_assessments_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."risk_assessments" ADD CONSTRAINT "risk_assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."risk_assessments" ADD CONSTRAINT "risk_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."risk_overrides" ADD CONSTRAINT "risk_overrides_assessment_id_risk_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "credit"."risk_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit"."risk_overrides" ADD CONSTRAINT "risk_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_request_idx" ON "credit"."ai_runs" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ai_runs_document_idx" ON "credit"."ai_runs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "credit_memos_request_idx" ON "credit"."credit_memos" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_memos_one_draft_idx" ON "credit"."credit_memos" USING btree ("request_id") WHERE status = 'draft';--> statement-breakpoint
CREATE INDEX "document_extractions_document_idx" ON "kyc"."document_extractions" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "kyc_checks_request_idx" ON "kyc"."kyc_checks" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "risk_assessments_request_idx" ON "credit"."risk_assessments" USING btree ("request_id","created_at");
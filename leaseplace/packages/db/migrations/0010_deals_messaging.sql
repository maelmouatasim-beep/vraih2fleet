CREATE TABLE "market"."deal_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"occurred_on" date,
	"actor_user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market"."deals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"offer_id" uuid NOT NULL,
	"company_organization_id" uuid NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	"status" text DEFAULT 'accepted' NOT NULL,
	"product" text DEFAULT 'lease' NOT NULL,
	"currency" text DEFAULT 'MAD' NOT NULL,
	"financed_amount_ht" numeric(18, 2) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_by" uuid NOT NULL,
	"signed_on" date,
	"delivered_on" date,
	"activated_on" date,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancel_side" text,
	"cancel_reason" text,
	"cancel_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_offer_id_unique" UNIQUE("offer_id")
);
--> statement-breakpoint
CREATE TABLE "market"."messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"author_organization_id" uuid NOT NULL,
	"body" text NOT NULL,
	"contact_flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market"."thread_reads" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "thread_reads_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "market"."threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"lessor_organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "identity"."notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"sms" boolean DEFAULT false NOT NULL,
	"whatsapp" boolean DEFAULT false NOT NULL,
	"phone" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"kind" text NOT NULL,
	"params" jsonb NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dev"."outbox" ADD COLUMN "channel" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "market"."deal_events" ADD CONSTRAINT "deal_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "market"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."deal_events" ADD CONSTRAINT "deal_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."deals" ADD CONSTRAINT "deals_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."deals" ADD CONSTRAINT "deals_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "market"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."deals" ADD CONSTRAINT "deals_company_organization_id_organizations_id_fk" FOREIGN KEY ("company_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."deals" ADD CONSTRAINT "deals_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."deals" ADD CONSTRAINT "deals_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."deals" ADD CONSTRAINT "deals_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "market"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."messages" ADD CONSTRAINT "messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."messages" ADD CONSTRAINT "messages_author_organization_id_organizations_id_fk" FOREIGN KEY ("author_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."thread_reads" ADD CONSTRAINT "thread_reads_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "market"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."thread_reads" ADD CONSTRAINT "thread_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."threads" ADD CONSTRAINT "threads_request_id_financing_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "credit"."financing_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market"."threads" ADD CONSTRAINT "threads_lessor_organization_id_organizations_id_fk" FOREIGN KEY ("lessor_organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity"."notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "identity"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_events_deal_idx" ON "market"."deal_events" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_one_live_per_request_idx" ON "market"."deals" USING btree ("request_id") WHERE status <> 'cancelled';--> statement-breakpoint
CREATE INDEX "deals_lessor_idx" ON "market"."deals" USING btree ("lessor_organization_id");--> statement-breakpoint
CREATE INDEX "deals_company_idx" ON "market"."deals" USING btree ("company_organization_id");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "market"."messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_request_lessor_idx" ON "market"."threads" USING btree ("request_id","lessor_organization_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "identity"."notifications" USING btree ("user_id","created_at");
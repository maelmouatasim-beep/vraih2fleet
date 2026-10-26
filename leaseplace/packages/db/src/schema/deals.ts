/**
 * Phase 7 : opérations nées d'une offre acceptée (étapes datées par le
 * bailleur, historique immuable) et messagerie entre l'entreprise et chaque
 * bailleur destinataire d'une demande.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  date,
  index,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { financingRequests } from "./credit";
import { organizations, users } from "./identity";
import { market, offers } from "./routing";

const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: "number" });

export const deals = market.table(
  "deals",
  {
    id: uuid("id").primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id),
    offerId: uuid("offer_id")
      .notNull()
      .unique()
      .references(() => offers.id),
    companyOrganizationId: uuid("company_organization_id")
      .notNull()
      .references(() => organizations.id),
    lessorOrganizationId: uuid("lessor_organization_id")
      .notNull()
      .references(() => organizations.id),
    status: text("status").notNull().default("accepted"),
    /** Produit (extension : « ijara ») et devise (extension : zones franches). */
    product: text("product").notNull().default("lease"),
    currency: text("currency").notNull().default("MAD"),
    /** Montant de l'offre, puis montant définitif constaté à la mise en loyer. */
    financedAmountHt: money("financed_amount_ht").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedBy: uuid("accepted_by")
      .notNull()
      .references(() => users.id),
    signedOn: date("signed_on", { mode: "date" }),
    deliveredOn: date("delivered_on", { mode: "date" }),
    activatedOn: date("activated_on", { mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelSide: text("cancel_side"),
    cancelReason: text("cancel_reason"),
    cancelNote: text("cancel_note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("deals_one_live_per_request_idx")
      .on(t.requestId)
      .where(sql`status <> 'cancelled'`),
    index("deals_lessor_idx").on(t.lessorOrganizationId),
    index("deals_company_idx").on(t.companyOrganizationId),
  ],
);

export const dealEvents = market.table(
  "deal_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    occurredOn: date("occurred_on", { mode: "date" }),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deal_events_deal_idx").on(t.dealId)],
);

export const threads = market.table(
  "threads",
  {
    id: uuid("id").primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id),
    lessorOrganizationId: uuid("lessor_organization_id")
      .notNull()
      .references(() => organizations.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("threads_request_lessor_idx").on(t.requestId, t.lessorOrganizationId)],
);

export const messages = market.table(
  "messages",
  {
    id: uuid("id").primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    authorOrganizationId: uuid("author_organization_id")
      .notNull()
      .references(() => organizations.id),
    body: text("body").notNull(),
    /** Coordonnées repérées avant l'acceptation (signalement anti-contournement). */
    contactFlags: text("contact_flags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const threadReads = market.table(
  "thread_reads",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] })],
);

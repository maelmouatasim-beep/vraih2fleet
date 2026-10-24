/**
 * Schéma `credit` : demandes de financement, pièces jointes, historique des
 * statuts (alimenté par trigger, jamais écrit par l'application).
 */
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./identity";
import { documents } from "./kyc";

export const credit = pgSchema("credit");

/** numeric → number côté TypeScript (montants arrondis au centime en base). */
const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: "number" });
const pct = (name: string) => numeric(name, { precision: 5, scale: 2, mode: "number" });

export const financingRequests = credit.table(
  "financing_requests",
  {
    id: uuid("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    productType: text("product_type").notNull().default("lease"),
    currency: text("currency").notNull().default("MAD"),
    status: text("status").notNull().default("draft"),
    equipmentCategory: text("equipment_category"),
    equipmentDescription: text("equipment_description"),
    condition: text("condition"),
    equipmentYear: integer("equipment_year"),
    supplierName: text("supplier_name"),
    amountHt: money("amount_ht"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 4, mode: "number" }).notNull().default(0.2),
    firstRentPct: pct("first_rent_pct"),
    durationMonths: integer("duration_months"),
    residualPct: pct("residual_pct"),
    periodicity: text("periodicity"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    index("requests_org_idx").on(t.organizationId),
    index("requests_status_idx").on(t.status),
  ],
);

export const requestDocuments = credit.table(
  "request_documents",
  {
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.documentId] })],
);

export const requestEvents = credit.table(
  "request_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorUserId: uuid("actor_user_id"),
    visibleToClient: boolean("visible_to_client").notNull().default(true),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_events_request_idx").on(t.requestId)],
);

/**
 * Orientation vers les bailleurs (phase 6) : appétit déclaré par chaque
 * bailleur, décision d'orientation calculée (immuable, motivée), cibles par
 * bailleur et leur statut, refus motivés, destinataires nommés du
 * consentement de transmission. Les offres vivent dans le schéma `market`.
 */
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { credit, financingRequests } from "./credit";
import { organizations, users } from "./identity";
import { consents, kyc } from "./kyc";

const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: "number" });

export const lessorAppetites = credit.table("lessor_appetites", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  minAmountHt: money("min_amount_ht").notNull(),
  maxAmountHt: money("max_amount_ht").notNull(),
  minDurationMonths: integer("min_duration_months").notNull(),
  maxDurationMonths: integer("max_duration_months").notNull(),
  sectors: text("sectors")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  categories: text("categories")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  minGrade: char("min_grade", { length: 1 }).notNull().default("C"),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

export const routingDecisions = credit.table(
  "routing_decisions",
  {
    id: uuid("id").primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    grade: char("grade", { length: 1 }).notNull(),
    maxTargets: integer("max_targets").notNull(),
    /** Profil et appétits au moment du calcul : la décision se rejoue. */
    profile: jsonb("profile").notNull(),
    appetites: jsonb("appetites").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routing_decisions_request_idx").on(t.requestId, t.createdAt)],
);

export const routingTargets = credit.table(
  "routing_targets",
  {
    id: uuid("id").primaryKey(),
    decisionId: uuid("decision_id")
      .notNull()
      .references(() => routingDecisions.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    lessorOrganizationId: uuid("lessor_organization_id")
      .notNull()
      .references(() => organizations.id),
    status: text("status").notNull(),
    exclusions: jsonb("exclusions").notNull(),
    rank: integer("rank"),
    proposed: boolean("proposed").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("routing_targets_decision_lessor_idx").on(t.decisionId, t.lessorOrganizationId),
    index("routing_targets_lessor_idx").on(t.lessorOrganizationId, t.status),
    index("routing_targets_request_idx").on(t.requestId),
  ],
);

export const targetDeclines = credit.table("target_declines", {
  targetId: uuid("target_id")
    .primaryKey()
    .references(() => routingTargets.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  note: text("note"),
  declinedBy: uuid("declined_by")
    .notNull()
    .references(() => users.id),
  declinedAt: timestamp("declined_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Bailleurs nommés par un consentement de transmission (finalité « routing »). */
export const consentRecipients = kyc.table(
  "consent_recipients",
  {
    consentId: uuid("consent_id")
      .notNull()
      .references(() => consents.id, { onDelete: "cascade" }),
    lessorOrganizationId: uuid("lessor_organization_id")
      .notNull()
      .references(() => organizations.id),
  },
  (t) => [primaryKey({ columns: [t.consentId, t.lessorOrganizationId] })],
);

export const market = pgSchema("market");

export const offers = market.table(
  "offers",
  {
    id: uuid("id").primaryKey(),
    targetId: uuid("target_id")
      .notNull()
      .references(() => routingTargets.id),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    lessorOrganizationId: uuid("lessor_organization_id")
      .notNull()
      .references(() => organizations.id),
    status: text("status").notNull().default("submitted"),
    financedAmountHt: money("financed_amount_ht").notNull(),
    durationMonths: integer("duration_months").notNull(),
    periodicity: text("periodicity").notNull(),
    timing: text("timing").notNull(),
    annualRate: numeric("annual_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
    firstRentHt: money("first_rent_ht").notNull(),
    rentHt: money("rent_ht").notNull(),
    residualValueHt: money("residual_value_ht").notNull(),
    fileFeesHt: money("file_fees_ht").notNull(),
    insurancePerPeriodHt: money("insurance_per_period_ht").notNull(),
    insuranceRequired: boolean("insurance_required").notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 4, mode: "number" }).notNull(),
    /** Calculés par le moteur, jamais saisis. */
    financingCostHt: money("financing_cost_ht").notNull(),
    paidTtc: money("paid_ttc").notNull(),
    effectiveRate: numeric("effective_rate", { precision: 9, scale: 6, mode: "number" }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    conditions: text("conditions").notNull().default(""),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    index("offers_request_idx").on(t.requestId),
    uniqueIndex("offers_one_live_per_target_idx")
      .on(t.targetId)
      .where(sql`status = 'submitted'`),
  ],
);

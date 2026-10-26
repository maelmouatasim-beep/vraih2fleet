/**
 * Phase 8 : mandats des bailleurs (grille de commission versionnée, clause
 * anti-contournement), commissions dues à la mise en loyer, factures.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { financingRequests } from "./credit";
import { deals } from "./deals";
import { organizations, users } from "./identity";

export const billing = pgSchema("billing");

const money = (name: string) => numeric(name, { precision: 18, scale: 2, mode: "number" });

export const mandates = billing.table(
  "mandates",
  {
    id: uuid("id").primaryKey(),
    lessorOrganizationId: uuid("lessor_organization_id")
      .notNull()
      .references(() => organizations.id),
    status: text("status").notNull().default("draft"),
    /** Version du contrat de mandat signé (référence du modèle juridique). */
    contractVersion: text("contract_version").notNull().default(""),
    signedOn: date("signed_on", { mode: "date" }),
    /** Grille marginale : [{ from, rate }], taux en fraction. */
    grid: jsonb("grid").notNull(),
    antiCircumvention: boolean("anti_circumvention").notNull().default(true),
    antiCircumventionMonths: integer("anti_circumvention_months").notNull().default(24),
    note: text("note").notNull().default(""),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mandates_one_active_idx")
      .on(t.lessorOrganizationId)
      .where(sql`status = 'active'`),
  ],
);

export const invoices = billing.table("invoices", {
  id: uuid("id").primaryKey(),
  number: text("number").notNull().unique(),
  lessorOrganizationId: uuid("lessor_organization_id")
    .notNull()
    .references(() => organizations.id),
  issuedOn: date("issued_on", { mode: "date" }).notNull(),
  dueOn: date("due_on", { mode: "date" }).notNull(),
  amountHt: money("amount_ht").notNull(),
  vatRate: numeric("vat_rate", { precision: 5, scale: 4, mode: "number" }).notNull(),
  vat: money("vat").notNull(),
  amountTtc: money("amount_ttc").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commissions = billing.table(
  "commissions",
  {
    id: uuid("id").primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .unique()
      .references(() => deals.id),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id),
    lessorOrganizationId: uuid("lessor_organization_id")
      .notNull()
      .references(() => organizations.id),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => mandates.id),
    status: text("status").notNull().default("due"),
    financedAmountHt: money("financed_amount_ht").notNull(),
    /** Grille appliquée, figée au calcul. */
    grid: jsonb("grid").notNull(),
    amountHt: money("amount_ht").notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 4, mode: "number" }).notNull(),
    vat: money("vat").notNull(),
    amountTtc: money("amount_ttc").notNull(),
    activatedOn: date("activated_on", { mode: "date" }).notNull(),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    paidOn: date("paid_on", { mode: "date" }),
    paymentReference: text("payment_reference"),
    cancelReason: text("cancel_reason"),
    cancelNote: text("cancel_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("commissions_lessor_idx").on(t.lessorOrganizationId, t.status)],
);

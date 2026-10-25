/**
 * Revue des dossiers par la plateforme (phase 5) : traces des appels IA,
 * extractions, contrôles de cohérence, indices d'orientation et leurs
 * corrections, notes de synthèse. Tables réservées à la plateforme (RLS) ;
 * aucun bailleur ni aucune entreprise ne les lit à ce stade.
 * Les tables vivent dans les schémas `kyc` et `credit` (schéma cible).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { financingRequests, credit } from "./credit";
import { organizations, users } from "./identity";
import { documents, kyc } from "./kyc";

export const aiRuns = credit.table(
  "ai_runs",
  {
    id: uuid("id").primaryKey(),
    purpose: text("purpose").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => financingRequests.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id),
    /** Empreinte de l'entrée (document ou faits), jamais l'entrée elle-même. */
    inputSha256: text("input_sha256").notNull(),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    /** Sortie structurée brute du modèle, telle que validée (ou rejetée). */
    output: jsonb("output"),
    issues: jsonb("issues"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_runs_request_idx").on(t.requestId),
    index("ai_runs_document_idx").on(t.documentId),
  ],
);

export const documentExtractions = kyc.table(
  "document_extractions",
  {
    id: uuid("id").primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id),
    promptVersion: text("prompt_version").notNull(),
    readable: boolean("readable").notNull(),
    fields: jsonb("fields").notNull(),
    sources: jsonb("sources").notNull(),
    warnings: jsonb("warnings").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("document_extractions_document_idx").on(t.documentId, t.createdAt)],
);

export const kycChecks = kyc.table(
  "kyc_checks",
  {
    id: uuid("id").primaryKey(),
    /** Un passage de contrôles = un même `run_id`. */
    runId: uuid("run_id").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    status: text("status").notNull(),
    documentIds: jsonb("document_ids").notNull(),
    expected: jsonb("expected"),
    found: jsonb("found").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kyc_checks_request_idx").on(t.requestId, t.createdAt)],
);

export const riskAssessments = credit.table(
  "risk_assessments",
  {
    id: uuid("id").primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    modelVersion: text("model_version").notNull(),
    inputs: jsonb("inputs").notNull(),
    ratios: jsonb("ratios").notNull(),
    factors: jsonb("factors").notNull(),
    flags: jsonb("flags").notNull(),
    score: numeric("score", { precision: 5, scale: 2, mode: "number" }).notNull(),
    grade: char("grade", { length: 1 }).notNull(),
    uncappedGrade: char("uncapped_grade", { length: 1 }).notNull(),
    checkRunId: uuid("check_run_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("risk_assessments_request_idx").on(t.requestId, t.createdAt)],
);

export const riskOverrides = credit.table("risk_overrides", {
  id: uuid("id").primaryKey(),
  assessmentId: uuid("assessment_id")
    .notNull()
    .references(() => riskAssessments.id, { onDelete: "cascade" }),
  grade: char("grade", { length: 1 }).notNull(),
  reason: text("reason").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditMemos = credit.table(
  "credit_memos",
  {
    id: uuid("id").primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => financingRequests.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => riskAssessments.id),
    aiRunId: uuid("ai_run_id").references(() => aiRuns.id),
    status: text("status").notNull().default("draft"),
    content: jsonb("content").notNull(),
    /** Identifiants courts (D1…) → documents cités. */
    sourceMap: jsonb("source_map").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    index("credit_memos_request_idx").on(t.requestId, t.createdAt),
    uniqueIndex("credit_memos_one_draft_idx")
      .on(t.requestId)
      .where(sql`status = 'draft'`),
  ],
);

import { defineMachine } from "../common/state-machine";
import { MONTHS_PER_PERIOD, type Periodicity } from "../finance/periodicity";

/** Demandes de financement : catégories, statuts, brouillon, règles de soumission. */

export const EQUIPMENT_CATEGORIES = [
  "light_vehicle",
  "truck",
  "trailer",
  "construction_machine",
  "industrial_machine",
  "medical",
  "it",
  "agricultural",
  "other",
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const EQUIPMENT_CONDITIONS = ["new", "used"] as const;
export type EquipmentCondition = (typeof EQUIPMENT_CONDITIONS)[number];

/**
 * Cycle de vie d'une demande. Phase 5 : revue de la plateforme (vérification
 * du dossier, indice d'orientation, note de synthèse) avant tout envoi aux
 * bailleurs. « qualified » signifie « dossier vérifié, prêt à être orienté »,
 * jamais un accord de crédit : la décision appartient au bailleur.
 */
export const REQUEST_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "needs_info",
  "qualified",
  "routed",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_EVENTS = [
  "submit",
  "start_review",
  "request_info",
  "qualify",
  "route",
  "cancel",
] as const;
export type RequestEvent = (typeof REQUEST_EVENTS)[number];

export const requestMachine = defineMachine<RequestStatus, RequestEvent>({
  draft: { submit: "submitted", cancel: "cancelled" },
  submitted: { start_review: "in_review", cancel: "cancelled" },
  in_review: { request_info: "needs_info", qualify: "qualified", cancel: "cancelled" },
  needs_info: { submit: "submitted", cancel: "cancelled" },
  qualified: { route: "routed", cancel: "cancelled" },
  routed: { cancel: "cancelled" },
  cancelled: {},
});

/** Statuts où l'entreprise peut encore modifier sa demande. */
export const EDITABLE_REQUEST_STATUSES: readonly RequestStatus[] = ["draft", "needs_info"];

export function isEditableRequestStatus(status: string): boolean {
  return (EDITABLE_REQUEST_STATUSES as readonly string[]).includes(status);
}

export const WIZARD_STEPS = ["equipment", "financing", "documents", "consent", "review"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Bornes de la plateforme (politique produit, modifiables). */
export const REQUEST_LIMITS = {
  amountHt: { min: 50_000, max: 50_000_000 },
  durationMonths: { min: 12, max: 84 },
  firstRentPct: { min: 0, max: 30 },
  residualPct: { min: 0, max: 20 },
  descriptionLength: { min: 10, max: 1000 },
  equipmentYear: { min: 1990 },
} as const;

/** Contenu du brouillon, enregistré automatiquement à chaque modification. */
export interface RequestDraft {
  equipmentCategory?: EquipmentCategory | null;
  equipmentDescription?: string | null;
  condition?: EquipmentCondition | null;
  equipmentYear?: number | null;
  supplierName?: string | null;
  amountHt?: number | null;
  firstRentPct?: number | null;
  durationMonths?: number | null;
  residualPct?: number | null;
  periodicity?: Periodicity | null;
}

export const SUBMISSION_ISSUES = [
  "equipment_category_missing",
  "description_invalid",
  "condition_missing",
  "year_invalid",
  "amount_invalid",
  "duration_invalid",
  "first_rent_invalid",
  "residual_invalid",
  "periodicity_missing",
  "quote_missing",
  "kyc_incomplete",
  "consent_missing",
] as const;
export type SubmissionIssue = (typeof SUBMISSION_ISSUES)[number];

export const ISSUE_STEP: Readonly<Record<SubmissionIssue, WizardStep>> = {
  equipment_category_missing: "equipment",
  description_invalid: "equipment",
  condition_missing: "equipment",
  year_invalid: "equipment",
  amount_invalid: "financing",
  duration_invalid: "financing",
  first_rent_invalid: "financing",
  residual_invalid: "financing",
  periodicity_missing: "financing",
  quote_missing: "documents",
  kyc_incomplete: "documents",
  consent_missing: "consent",
};

const within = (v: number | null | undefined, { min, max }: { min: number; max: number }) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

export function draftIssues(draft: RequestDraft, now: Date): SubmissionIssue[] {
  const L = REQUEST_LIMITS;
  const issues: SubmissionIssue[] = [];
  if (!draft.equipmentCategory) issues.push("equipment_category_missing");
  const description = draft.equipmentDescription?.trim() ?? "";
  if (
    description.length < L.descriptionLength.min ||
    description.length > L.descriptionLength.max
  ) {
    issues.push("description_invalid");
  }
  if (!draft.condition) issues.push("condition_missing");
  if (
    draft.condition === "used" &&
    !within(draft.equipmentYear, { min: L.equipmentYear.min, max: now.getUTCFullYear() + 1 })
  ) {
    issues.push("year_invalid");
  }
  if (!within(draft.amountHt, L.amountHt)) issues.push("amount_invalid");
  if (!draft.periodicity) issues.push("periodicity_missing");
  const months = draft.durationMonths;
  const durationOk =
    typeof months === "number" &&
    within(months, L.durationMonths) &&
    Number.isInteger(months) &&
    (!draft.periodicity || months % MONTHS_PER_PERIOD[draft.periodicity] === 0);
  if (!durationOk) issues.push("duration_invalid");
  if (!within(draft.firstRentPct, L.firstRentPct)) issues.push("first_rent_invalid");
  if (!within(draft.residualPct, L.residualPct)) issues.push("residual_invalid");
  return issues;
}

export interface SubmissionContext {
  hasQuote: boolean;
  kycComplete: boolean;
  consentGiven: boolean;
  now: Date;
}

/** Tous les motifs de refus, dans l'ordre des étapes ; vide = soumission possible. */
export function submissionIssues(draft: RequestDraft, ctx: SubmissionContext): SubmissionIssue[] {
  const issues = draftIssues(draft, ctx.now);
  if (!ctx.hasQuote) issues.push("quote_missing");
  if (!ctx.kycComplete) issues.push("kyc_incomplete");
  if (!ctx.consentGiven) issues.push("consent_missing");
  return issues;
}

/** Première étape à compléter (reprise du brouillon). */
export function resumeStep(issues: readonly SubmissionIssue[]): WizardStep {
  return WIZARD_STEPS.find((step) => issues.some((i) => ISSUE_STEP[i] === step)) ?? "review";
}

/** Référence lisible : LP-2026-000123. */
export function formatRequestReference(year: number, sequence: number): string {
  return `LP-${String(year)}-${String(sequence).padStart(6, "0")}`;
}

import { defineMachine } from "../common/state-machine";
import { roundCents } from "../finance/money";
import { DEFAULT_VAT_RATE } from "../finance/vat";

/**
 * Mandats et commissions (phase 8). La plateforme agit sous mandat écrit de
 * chaque bailleur (loi 103-12) ; la commission est due au succès, à la mise
 * en loyer, selon la grille dégressive du mandat (de 1,5 % à 0,4 % du
 * montant financé). Grille MARGINALE : chaque tranche du montant est payée
 * à son taux (pas d'effet de seuil).
 */
export interface GridTier {
  /** Début de la tranche, en DH HT (la première commence à 0). */
  from: number;
  /** Taux de la tranche, en fraction (0,015 = 1,5 %). */
  rate: number;
}
export type CommissionGrid = readonly GridTier[];

/** Grille par défaut (hypothèse à valider, cf. docs/questions-ouvertes.md). */
export const DEFAULT_COMMISSION_GRID: CommissionGrid = [
  { from: 0, rate: 0.015 },
  { from: 500_000, rate: 0.012 },
  { from: 1_000_000, rate: 0.009 },
  { from: 2_000_000, rate: 0.006 },
  { from: 5_000_000, rate: 0.004 },
];

export const GRID_LIMITS = { minRate: 0.001, maxRate: 0.05, maxTiers: 10 } as const;

export const GRID_ISSUES = [
  "empty",
  "too_many_tiers",
  "first_not_zero",
  "not_ascending",
  "rate_out_of_range",
  "not_degressive",
] as const;
export type GridIssue = (typeof GRID_ISSUES)[number];

/** Une grille valide part de 0, monte strictement, et ses taux ne croissent jamais. */
export function gridIssues(grid: CommissionGrid): GridIssue[] {
  const issues = new Set<GridIssue>();
  if (grid.length === 0) return ["empty"];
  if (grid.length > GRID_LIMITS.maxTiers) issues.add("too_many_tiers");
  if (grid[0]?.from !== 0) issues.add("first_not_zero");
  grid.forEach((t, i) => {
    if (!Number.isFinite(t.rate) || t.rate < GRID_LIMITS.minRate || t.rate > GRID_LIMITS.maxRate)
      issues.add("rate_out_of_range");
    const prev = grid[i - 1];
    if (prev) {
      if (!Number.isFinite(t.from) || t.from <= prev.from) issues.add("not_ascending");
      if (t.rate > prev.rate) issues.add("not_degressive");
    }
  });
  return [...issues];
}

export interface CommissionLine {
  from: number;
  to: number | null;
  rate: number;
  base: number;
  amount: number;
}

export interface Commission {
  financedAmountHt: number;
  lines: CommissionLine[];
  amountHt: number;
  /** Taux moyen effectif : commission / montant financé. */
  effectiveRate: number;
  vatRate: number;
  vat: number;
  amountTtc: number;
}

/**
 * Commission sur un montant financé, tranche par tranche ; arrondi au
 * centime à la fin seulement (même règle que la base, vérifiée par test).
 */
export function computeCommission(
  financedAmountHt: number,
  grid: CommissionGrid,
  vatRate: number = DEFAULT_VAT_RATE,
): Commission {
  if (!Number.isFinite(financedAmountHt) || financedAmountHt <= 0)
    throw new RangeError("montant financé : valeur strictement positive attendue");
  if (gridIssues(grid).length > 0) throw new RangeError("grille de commission invalide");
  const lines = grid.map((t, i) => {
    const to = grid[i + 1]?.from ?? null;
    const base = Math.max(0, Math.min(financedAmountHt, to ?? Number.POSITIVE_INFINITY) - t.from);
    return { from: t.from, to, rate: t.rate, base, amount: base * t.rate };
  });
  const amountHt = roundCents(lines.reduce((s, l) => s + l.amount, 0));
  const vat = roundCents(amountHt * vatRate);
  return {
    financedAmountHt,
    lines: lines.filter((l) => l.base > 0).map((l) => ({ ...l, amount: roundCents(l.amount) })),
    amountHt,
    effectiveRate: amountHt / financedAmountHt,
    vatRate,
    vat,
    amountTtc: roundCents(amountHt + vat),
  };
}

// ── Mandats ─────────────────────────────────────────────────────────────────

export const MANDATE_STATUSES = ["draft", "active", "suspended", "terminated"] as const;
export type MandateStatus = (typeof MANDATE_STATUSES)[number];
export const MANDATE_EVENTS = ["activate", "suspend", "resume", "terminate"] as const;
export type MandateEvent = (typeof MANDATE_EVENTS)[number];

export const mandateMachine = defineMachine<MandateStatus, MandateEvent>({
  draft: { activate: "active", terminate: "terminated" },
  active: { suspend: "suspended", terminate: "terminated" },
  suspended: { resume: "active", terminate: "terminated" },
  terminated: {},
});

/** Durée minimale de la clause anti-contournement (mois), hypothèse produit. */
export const ANTI_CIRCUMVENTION_MONTHS = { min: 6, max: 36, default: 24 } as const;

export const MANDATE_ISSUES = [
  "version_missing",
  "signed_on_missing",
  "signed_in_future",
  "anti_circumvention_missing",
  "anti_circumvention_out_of_range",
  "grid_invalid",
] as const;
export type MandateIssue = (typeof MANDATE_ISSUES)[number];

/** Un mandat n'entre en vigueur que signé, versionné, avec grille et clause anti-contournement. */
export function mandateActivationIssues(
  m: {
    contractVersion: string;
    signedOn: Date | null;
    antiCircumvention: boolean;
    antiCircumventionMonths: number;
    grid: CommissionGrid;
  },
  now: Date,
): MandateIssue[] {
  const issues: MandateIssue[] = [];
  if (m.contractVersion.trim() === "") issues.push("version_missing");
  if (!m.signedOn) issues.push("signed_on_missing");
  else if (m.signedOn.getTime() > now.getTime()) issues.push("signed_in_future");
  if (!m.antiCircumvention) issues.push("anti_circumvention_missing");
  else if (
    !Number.isInteger(m.antiCircumventionMonths) ||
    m.antiCircumventionMonths < ANTI_CIRCUMVENTION_MONTHS.min ||
    m.antiCircumventionMonths > ANTI_CIRCUMVENTION_MONTHS.max
  )
    issues.push("anti_circumvention_out_of_range");
  if (gridIssues(m.grid).length > 0) issues.push("grid_invalid");
  return issues;
}

// ── Commissions et factures ─────────────────────────────────────────────────

/** Due à la mise en loyer, facturée, payée ; annulée par avoir motivé. */
export const COMMISSION_STATUSES = ["due", "invoiced", "paid", "cancelled"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];
export const COMMISSION_EVENTS = ["invoice", "pay", "cancel"] as const;
export type CommissionEvent = (typeof COMMISSION_EVENTS)[number];

export const commissionMachine = defineMachine<CommissionStatus, CommissionEvent>({
  due: { invoice: "invoiced", cancel: "cancelled" },
  invoiced: { pay: "paid", cancel: "cancelled" },
  paid: {},
  cancelled: {},
});

/** Délai de paiement d'une facture (jours), hypothèse produit. */
export const INVOICE_PAYMENT_DAYS = 30;

export function invoiceDueOn(issuedOn: Date, days: number = INVOICE_PAYMENT_DAYS): Date {
  return new Date(issuedOn.getTime() + days * 86_400_000);
}

/** Facture émise, non payée, dont l'échéance est dépassée (au jour près). */
export function isInvoiceOverdue(status: string, dueOn: Date | null, today: Date): boolean {
  if (status !== "invoiced" || !dueOn) return false;
  return Math.floor(today.getTime() / 86_400_000) > Math.floor(dueOn.getTime() / 86_400_000);
}

export const COMMISSION_CANCEL_REASONS = [
  "deal_unwound",
  "billing_error",
  "commercial_gesture",
  "other",
] as const;
export type CommissionCancelReason = (typeof COMMISSION_CANCEL_REASONS)[number];

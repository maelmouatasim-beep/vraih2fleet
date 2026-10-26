import { defineMachine } from "../common/state-machine";

/**
 * Opération née d'une offre acceptée (`deals`). Le bailleur constate chaque
 * étape à sa date : signature du contrat, livraison du matériel, mise en
 * loyer. La plateforme ne prend aucune décision de crédit : le bailleur
 * peut encore annuler (refus de crédit définitif, pièce manquante…).
 */
export const DEAL_STATUSES = ["accepted", "signed", "delivered", "active", "cancelled"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];
export const DEAL_EVENTS = ["sign", "deliver", "activate", "cancel"] as const;
export type DealEvent = (typeof DEAL_EVENTS)[number];

export const dealMachine = defineMachine<DealStatus, DealEvent>({
  accepted: { sign: "signed", cancel: "cancelled" },
  signed: { deliver: "delivered", cancel: "cancelled" },
  delivered: { activate: "active", cancel: "cancelled" },
  active: {},
  cancelled: {},
});

/** Opération en cours (bloque une seconde acceptation sur la même demande). */
export function isLiveDeal(status: string): boolean {
  return status !== "cancelled";
}

export type DealStep = Exclude<DealEvent, "cancel">;
export const DEAL_STEPS: readonly DealStep[] = ["sign", "deliver", "activate"];

/** Prochaine étape à constater, ou null (mise en loyer faite, ou annulée). */
export function nextDealStep(status: DealStatus): DealStep | null {
  return DEAL_STEPS.find((step) => dealMachine.can(status, step)) ?? null;
}

export interface DealDates {
  acceptedAt: Date;
  signedOn: Date | null;
  deliveredOn: Date | null;
}

export const DEAL_STEP_ISSUES = [
  "transition_invalid",
  "date_in_future",
  "date_before_previous",
  "amount_invalid",
] as const;
export type DealStepIssue = (typeof DEAL_STEP_ISSUES)[number];

const DAY = 86_400_000;
const dayOf = (d: Date) => Math.floor(d.getTime() / DAY);

/**
 * Une étape se constate à une date passée (au jour près), jamais avant
 * l'étape précédente. À la mise en loyer, le montant financé définitif peut
 * différer de l'offre (facture finale) : strictement positif.
 */
export function dealStepIssues(
  input: {
    status: DealStatus;
    step: DealStep;
    on: Date;
    dates: DealDates;
    financedAmountHt?: number;
  },
  today: Date,
): DealStepIssue[] {
  const issues: DealStepIssue[] = [];
  if (!dealMachine.can(input.status, input.step)) issues.push("transition_invalid");
  if (dayOf(input.on) > dayOf(today)) issues.push("date_in_future");
  const previous =
    input.step === "sign"
      ? input.dates.acceptedAt
      : input.step === "deliver"
        ? input.dates.signedOn
        : input.dates.deliveredOn;
  if (previous && dayOf(input.on) < dayOf(previous)) issues.push("date_before_previous");
  if (
    input.step === "activate" &&
    input.financedAmountHt !== undefined &&
    !(Number.isFinite(input.financedAmountHt) && input.financedAmountHt > 0)
  )
    issues.push("amount_invalid");
  return issues;
}

/** Motifs d'annulation, selon la partie qui annule. */
export const LESSOR_CANCEL_REASONS = [
  "credit_refused",
  "documents_incomplete",
  "supplier_issue",
  "other",
] as const;
export const COMPANY_CANCEL_REASONS = ["project_abandoned", "financed_elsewhere", "other"] as const;
export const DEAL_CANCEL_REASONS = [
  ...new Set([...LESSOR_CANCEL_REASONS, ...COMPANY_CANCEL_REASONS]),
] as readonly string[];
export type DealSide = "lessor" | "company";

export const DEAL_CANCEL_ISSUES = [
  "transition_invalid",
  "reason_invalid",
  "note_required",
] as const;
export type DealCancelIssue = (typeof DEAL_CANCEL_ISSUES)[number];

/**
 * L'entreprise ne peut annuler qu'avant la signature du contrat ; ensuite,
 * seul le bailleur annule. « Autre » exige une précision (10 caractères).
 */
export function dealCancelIssues(input: {
  status: DealStatus;
  side: DealSide;
  reason: string;
  note: string;
}): DealCancelIssue[] {
  const issues: DealCancelIssue[] = [];
  const allowed =
    dealMachine.can(input.status, "cancel") &&
    (input.side === "lessor" || input.status === "accepted");
  if (!allowed) issues.push("transition_invalid");
  const reasons: readonly string[] =
    input.side === "lessor" ? LESSOR_CANCEL_REASONS : COMPANY_CANCEL_REASONS;
  if (!reasons.includes(input.reason)) issues.push("reason_invalid");
  else if (input.reason === "other" && input.note.trim().length < 10) issues.push("note_required");
  return issues;
}

/**
 * Suivi « type colis » de la demande, du dépôt à la mise en loyer. Chaque
 * étape est faite, en cours ou à venir ; l'étape en cours peut demander une
 * action de l'entreprise (compléments, choix des bailleurs, choix d'une offre).
 */
export const TRACKER_STEPS = [
  "submitted",
  "verified",
  "routed",
  "offers",
  "accepted",
  "signed",
  "delivered",
  "active",
] as const;
export type TrackerStep = (typeof TRACKER_STEPS)[number];
export type TrackerState = "done" | "current" | "upcoming";

export interface TrackerInput {
  requestStatus: string;
  offerCount: number;
  dealStatus: DealStatus | null;
}

function reachedIndex({ requestStatus, offerCount, dealStatus }: TrackerInput): number {
  switch (requestStatus) {
    case "submitted":
    case "in_review":
    case "needs_info":
      return 0;
    case "qualified":
      return 1;
    case "routed":
      return offerCount > 0 ? 3 : 2;
    case "accepted":
      return dealStatus === "delivered" ? 6 : dealStatus === "signed" ? 5 : 4;
    case "financed":
      return 7;
    default:
      return -1;
  }
}

/** Étapes et leur état ; vide pour un brouillon ou une demande annulée. */
export function requestTracker(input: TrackerInput): { step: TrackerStep; state: TrackerState }[] {
  const reached = reachedIndex(input);
  if (reached < 0) return [];
  return TRACKER_STEPS.map((step, i) => ({
    step,
    state: i <= reached ? "done" : i === reached + 1 ? "current" : "upcoming",
  }));
}

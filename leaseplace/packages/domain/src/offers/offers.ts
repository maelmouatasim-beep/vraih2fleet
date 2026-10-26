import { defineMachine } from "../common/state-machine";
import { normalizeOffer, type NormalizedOffer } from "../finance/offer";
import { MONTHS_PER_PERIOD, type PaymentTiming, type Periodicity } from "../finance/periodicity";
import { priceLease } from "../finance/pricing";
import { DEFAULT_VAT_RATE } from "../finance/vat";

/**
 * Offre d'un bailleur. Il saisit ses conditions (montant financé, taux
 * nominal, durée, premier loyer, valeur résiduelle, frais, assurance) ; le
 * loyer, le coût total et le TEG implicite sont TOUJOURS recalculés par le
 * moteur côté serveur, jamais saisis.
 */
export interface OfferInput {
  financedAmountHt: number;
  durationMonths: number;
  periodicity: Periodicity;
  timing: PaymentTiming;
  /** Taux nominal annuel, en fraction (0,085 = 8,5 %). */
  annualRate: number;
  /** Premier loyer majoré HT ; 0 = premier loyer égal aux suivants. */
  firstRentHt: number;
  residualValueHt: number;
  fileFeesHt: number;
  insurancePerPeriodHt: number;
  insuranceRequired: boolean;
  validUntil: Date;
  conditions: string;
}

export const OFFER_LIMITS = {
  annualRate: { min: 0.001, max: 0.3 },
  durationMonths: { min: 12, max: 120 },
  /** Validité de l'offre : 1 à 90 jours. */
  validityDays: { min: 1, max: 90 },
  conditionsLength: 2000,
  /** Montant financé : au plus 120 % du montant demandé. */
  maxAmountRatio: 1.2,
} as const;

export const OFFER_ISSUES = [
  "amount_invalid",
  "duration_invalid",
  "rate_invalid",
  "first_rent_invalid",
  "residual_invalid",
  "fees_invalid",
  "validity_invalid",
  "conditions_too_long",
] as const;
export type OfferIssue = (typeof OFFER_ISSUES)[number];

const finite = (v: number) => Number.isFinite(v);

export function offerIssues(o: OfferInput, requestedAmountHt: number, now: Date): OfferIssue[] {
  const L = OFFER_LIMITS;
  const issues: OfferIssue[] = [];
  if (
    !finite(o.financedAmountHt) ||
    o.financedAmountHt <= 0 ||
    o.financedAmountHt > requestedAmountHt * L.maxAmountRatio
  )
    issues.push("amount_invalid");
  if (
    !Number.isInteger(o.durationMonths) ||
    o.durationMonths < L.durationMonths.min ||
    o.durationMonths > L.durationMonths.max ||
    o.durationMonths % MONTHS_PER_PERIOD[o.periodicity] !== 0
  )
    issues.push("duration_invalid");
  if (!finite(o.annualRate) || o.annualRate < L.annualRate.min || o.annualRate > L.annualRate.max)
    issues.push("rate_invalid");
  if (!finite(o.firstRentHt) || o.firstRentHt < 0 || o.firstRentHt >= o.financedAmountHt * 0.5)
    issues.push("first_rent_invalid");
  if (
    !finite(o.residualValueHt) ||
    o.residualValueHt < 0 ||
    o.residualValueHt >= o.financedAmountHt * 0.5
  )
    issues.push("residual_invalid");
  if (
    !finite(o.fileFeesHt) ||
    !finite(o.insurancePerPeriodHt) ||
    o.fileFeesHt < 0 ||
    o.insurancePerPeriodHt < 0
  )
    issues.push("fees_invalid");
  const days = (o.validUntil.getTime() - now.getTime()) / 86_400_000;
  if (!finite(days) || days < L.validityDays.min - 1 || days > L.validityDays.max)
    issues.push("validity_invalid");
  if (o.conditions.length > L.conditionsLength) issues.push("conditions_too_long");
  return issues;
}

export interface PricedOffer {
  rentHt: number;
  firstRentHt: number;
  normalized: NormalizedOffer;
}

/** Loyer au taux nominal, puis échéancier normalisé, coût total et TEG implicite. */
export function priceOffer(o: OfferInput, vatRate = DEFAULT_VAT_RATE): PricedOffer {
  const pricing = priceLease({
    financedAmountHt: o.financedAmountHt,
    durationMonths: o.durationMonths,
    periodicity: o.periodicity,
    timing: o.timing,
    annualRate: o.annualRate,
    firstRentHt: o.firstRentHt > 0 ? o.firstRentHt : undefined,
    residualValueHt: o.residualValueHt,
  });
  const normalized = normalizeOffer({
    financedAmountHt: o.financedAmountHt,
    durationMonths: o.durationMonths,
    periodicity: o.periodicity,
    timing: o.timing,
    firstRentHt: pricing.firstRentHt,
    rentHt: pricing.rentHt,
    residualValueHt: o.residualValueHt,
    fileFeesHt: o.fileFeesHt,
    insurancePerPeriodHt: o.insurancePerPeriodHt,
    insuranceRequired: o.insuranceRequired,
    vatRate,
  });
  return { rentHt: pricing.rentHt, firstRentHt: pricing.firstRentHt, normalized };
}

/**
 * Cycle de vie d'une offre. « not_retained » : une autre offre a été acceptée ;
 * elle redevient disponible si l'opération acceptée est annulée.
 */
export const OFFER_STATUSES = ["submitted", "withdrawn", "accepted", "not_retained"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export const OFFER_EVENTS = ["withdraw", "accept", "set_aside", "reopen"] as const;
export type OfferEvent = (typeof OFFER_EVENTS)[number];

export const offerMachine = defineMachine<OfferStatus, OfferEvent>({
  submitted: { withdraw: "withdrawn", accept: "accepted", set_aside: "not_retained" },
  not_retained: { reopen: "submitted" },
  withdrawn: {},
  accepted: {},
});

/** Une offre est caduque après la fin de son jour de validité. */
export function isOfferExpired(validUntil: Date, now: Date): boolean {
  return now.getTime() > validUntil.getTime();
}

export const ACCEPTANCE_ISSUES = [
  "offer_unavailable",
  "offer_expired",
  "request_not_open",
  "deal_exists",
] as const;
export type AcceptanceIssue = (typeof ACCEPTANCE_ISSUES)[number];

/** Conditions d'acceptation d'une offre par l'entreprise (vérifiées aussi en base). */
export function acceptanceIssues(
  input: {
    offerStatus: string;
    validUntil: Date;
    requestStatus: string;
    hasLiveDeal: boolean;
  },
  now: Date,
): AcceptanceIssue[] {
  const issues: AcceptanceIssue[] = [];
  if (input.offerStatus !== "submitted") issues.push("offer_unavailable");
  if (isOfferExpired(input.validUntil, now)) issues.push("offer_expired");
  if (input.requestStatus !== "routed") issues.push("request_not_open");
  if (input.hasLiveDeal) issues.push("deal_exists");
  return issues;
}

/**
 * Simulation pour l'entreprise : même taux, mêmes frais et même valeur
 * résiduelle que l'offre, avec un autre premier loyer (apport) ou une autre
 * durée. Une estimation, jamais une offre : null si la variante sort des
 * bornes (durée non multiple de la période, apport trop élevé…).
 */
export function simulateOffer(
  offer: OfferInput,
  change: { firstRentHt?: number; durationMonths?: number },
  requestedAmountHt: number,
  now: Date,
): PricedOffer | null {
  const variant: OfferInput = {
    ...offer,
    firstRentHt: change.firstRentHt ?? offer.firstRentHt,
    durationMonths: change.durationMonths ?? offer.durationMonths,
  };
  const issues = offerIssues(variant, requestedAmountHt, now).filter(
    (i) => i !== "validity_invalid",
  );
  return issues.length === 0 ? priceOffer(variant) : null;
}

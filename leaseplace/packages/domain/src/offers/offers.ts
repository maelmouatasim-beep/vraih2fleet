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

export const OFFER_STATUSES = ["submitted", "withdrawn"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

import { assertFinite, assertNonNegative, assertPositive, roundCents } from "./money";
import {
  paymentMonth,
  periodCount,
  periodsPerYear,
  type PaymentTiming,
  type Periodicity,
} from "./periodicity";

/**
 * Loyer constant d'un crédit-bail à partir d'un taux nominal annuel
 * (convention proportionnelle : taux périodique = taux annuel / nombre de
 * périodes par an). Sert au simulateur et au formulaire d'offre du bailleur.
 *
 * Valeur actuelle au taux périodique i :
 *   montant financé = L1·v^t1 + R·Σ_{k=2..n} v^tk + VR·v^n,   v = 1/(1+i)
 * où L1 est le premier loyer (majoré ou non), tk l'échéance du loyer k
 * (en périodes : k−1 à échoir, k échu) et VR la valeur résiduelle payée à la
 * fin du contrat. Sans majoration, L1 = R.
 */
export interface LeasePricingInput {
  financedAmountHt: number;
  durationMonths: number;
  periodicity: Periodicity;
  timing: PaymentTiming;
  /** Taux nominal annuel du bailleur, en fraction (0,08 = 8 %). */
  annualRate: number;
  /** Premier loyer majoré HT ; absent = premier loyer égal aux suivants. */
  firstRentHt?: number;
  residualValueHt: number;
}

export interface LeasePricing {
  periods: number;
  periodicRate: number;
  firstRentHt: number;
  rentHt: number;
}

export const MAX_ANNUAL_RATE = 1;

export function priceLease(input: LeasePricingInput): LeasePricing {
  const {
    financedAmountHt,
    durationMonths,
    periodicity,
    timing,
    annualRate,
    firstRentHt,
    residualValueHt,
  } = input;
  assertPositive(financedAmountHt, "montant financé");
  assertFinite(annualRate, "taux annuel");
  if (annualRate < 0 || annualRate > MAX_ANNUAL_RATE)
    throw new RangeError("taux annuel : entre 0 et 100 %");
  assertNonNegative(residualValueHt, "valeur résiduelle");
  if (residualValueHt >= financedAmountHt)
    throw new RangeError("valeur résiduelle : inférieure au montant financé");
  if (firstRentHt !== undefined) assertNonNegative(firstRentHt, "premier loyer");

  const n = periodCount(durationMonths, periodicity);
  const i = annualRate / periodsPerYear(periodicity);
  const months = durationMonths / n;
  // Facteur d'actualisation à l'échéance du loyer k, exprimée en périodes.
  const v = (k: number) => (1 + i) ** -(paymentMonth(k, periodicity, timing) / months);
  const residualPv = residualValueHt * (1 + i) ** -n;

  let rent: number;
  if (firstRentHt === undefined) {
    let annuity = 0;
    for (let k = 1; k <= n; k++) annuity += v(k);
    rent = (financedAmountHt - residualPv) / annuity;
  } else {
    if (n === 1) throw new RangeError("premier loyer majoré : au moins deux loyers");
    let annuity = 0;
    for (let k = 2; k <= n; k++) annuity += v(k);
    rent = (financedAmountHt - firstRentHt * v(1) - residualPv) / annuity;
    if (rent <= 0)
      throw new RangeError("premier loyer et valeur résiduelle couvrent déjà le financement");
  }
  const rentHt = roundCents(rent);
  return {
    periods: n,
    periodicRate: i,
    rentHt,
    firstRentHt: firstRentHt === undefined ? rentHt : roundCents(firstRentHt),
  };
}

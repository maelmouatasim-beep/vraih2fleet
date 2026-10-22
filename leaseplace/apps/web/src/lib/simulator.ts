/**
 * Modèle du simulateur public : bornes, défauts et calcul par le moteur de
 * packages/domain (aucun chiffre calculé ailleurs). Importé côté navigateur :
 * pas de Zod ici ; la lecture de l'URL est dans simulator-params.ts (serveur).
 */
import {
  compareFinancing,
  DEFAULT_VAT_RATE,
  normalizeOffer,
  priceLease,
  roundCents,
  type Comparison,
  type LeasePricing,
  type NormalizedOffer,
} from "@leaseplace/domain";

export const SIMULATOR_PERIODICITIES = ["monthly", "quarterly", "semiannual"] as const;

export interface SimulatorParams {
  amount: number;
  months: number;
  periodicity: (typeof SIMULATOR_PERIODICITIES)[number];
  timing: "advance" | "arrears";
  firstRentPct: number;
  residualPct: number;
  ratePct: number;
  feesHt: number;
  taxPct: number;
  discountPct: number;
  usefulLifeYears: number;
}

/** Hypothèses par défaut : modifiables à l'écran, jamais présentées comme des taux de marché. */
export const DEFAULTS = {
  amount: 1_000_000,
  months: 60,
  periodicity: "monthly",
  timing: "advance",
  firstRentPct: 10,
  residualPct: 1,
  ratePct: 8,
  feesHt: 0,
  taxPct: 20,
  discountPct: 8,
  usefulLifeYears: 5,
} as const;

export const LIMITS = {
  amount: { min: 50_000, max: 50_000_000 },
  months: { min: 12, max: 84, step: 6 },
  firstRentPct: { min: 0, max: 30 },
  residualPct: { min: 0, max: 20 },
  ratePct: { min: 0, max: 25 },
  feesHt: { min: 0, max: 100_000 },
  taxPct: { min: 0, max: 40 },
  discountPct: { min: 0, max: 25 },
  usefulLifeYears: { min: 1, max: 20 },
} as const;

/** Paramètres différents des défauts seulement : URL courte. */
export function toSearchParams(params: SimulatorParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (DEFAULTS[k as keyof typeof DEFAULTS] !== v) out.set(k, String(v));
  }
  return out;
}

export type SimulationResult =
  | {
      ok: true;
      pricing: LeasePricing;
      offer: NormalizedOffer;
      comparison: Comparison;
      firstRentHt: number;
      residualHt: number;
    }
  | { ok: false; reason: "inconsistent" };

export function simulate(p: SimulatorParams): SimulationResult {
  const firstRentHt = roundCents((p.amount * p.firstRentPct) / 100);
  const residualHt = roundCents((p.amount * p.residualPct) / 100);
  try {
    const pricing = priceLease({
      financedAmountHt: p.amount,
      durationMonths: p.months,
      periodicity: p.periodicity,
      timing: p.timing,
      annualRate: p.ratePct / 100,
      residualValueHt: residualHt,
      ...(p.firstRentPct > 0 ? { firstRentHt } : {}),
    });
    const offer = normalizeOffer({
      financedAmountHt: p.amount,
      durationMonths: p.months,
      periodicity: p.periodicity,
      timing: p.timing,
      firstRentHt: pricing.firstRentHt,
      rentHt: pricing.rentHt,
      residualValueHt: residualHt,
      fileFeesHt: p.feesHt,
      insurancePerPeriodHt: 0,
      insuranceRequired: false,
      vatRate: DEFAULT_VAT_RATE,
    });
    const comparison = compareFinancing(offer, {
      priceHt: p.amount,
      durationMonths: p.months,
      loanAnnualRate: p.ratePct / 100,
      loanDownPaymentHt: p.firstRentPct > 0 ? firstRentHt : 0,
      discountAnnualRate: p.discountPct / 100,
      corporateTaxRate: p.taxPct / 100,
      usefulLifeYears: p.usefulLifeYears,
    });
    return { ok: true, pricing, offer, comparison, firstRentHt: pricing.firstRentHt, residualHt };
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, reason: "inconsistent" };
    throw error;
  }
}

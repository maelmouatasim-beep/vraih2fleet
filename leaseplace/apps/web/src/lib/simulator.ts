/**
 * Modèle du simulateur public : paramètres bornés (lus depuis l'URL pour
 * qu'une simulation soit partageable) et calcul par le moteur de
 * packages/domain. Aucun chiffre n'est calculé ailleurs.
 */
import { z } from "zod";
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

const num = (min: number, max: number, fallback: number) =>
  z.coerce.number().min(min).max(max).catch(fallback);

export const simulatorSchema = z.object({
  amount: num(LIMITS.amount.min, LIMITS.amount.max, DEFAULTS.amount),
  months: z.coerce
    .number()
    .int()
    .min(LIMITS.months.min)
    .max(LIMITS.months.max)
    .refine((m) => m % LIMITS.months.step === 0)
    .catch(DEFAULTS.months),
  periodicity: z.enum(SIMULATOR_PERIODICITIES).catch(DEFAULTS.periodicity),
  timing: z.enum(["advance", "arrears"]).catch(DEFAULTS.timing),
  firstRentPct: num(LIMITS.firstRentPct.min, LIMITS.firstRentPct.max, DEFAULTS.firstRentPct),
  residualPct: num(LIMITS.residualPct.min, LIMITS.residualPct.max, DEFAULTS.residualPct),
  ratePct: num(LIMITS.ratePct.min, LIMITS.ratePct.max, DEFAULTS.ratePct),
  feesHt: num(LIMITS.feesHt.min, LIMITS.feesHt.max, DEFAULTS.feesHt),
  taxPct: num(LIMITS.taxPct.min, LIMITS.taxPct.max, DEFAULTS.taxPct),
  discountPct: num(LIMITS.discountPct.min, LIMITS.discountPct.max, DEFAULTS.discountPct),
  usefulLifeYears: num(
    LIMITS.usefulLifeYears.min,
    LIMITS.usefulLifeYears.max,
    DEFAULTS.usefulLifeYears,
  ),
});

export type SimulatorParams = z.infer<typeof simulatorSchema>;

/** Valeurs absentes ou hors bornes → défaut (jamais d'erreur pour un lien partagé). */
export function parseSimulatorParams(
  search: Record<string, string | string[] | undefined>,
): SimulatorParams {
  const flat = Object.fromEntries(
    Object.entries(search).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return simulatorSchema.parse(flat);
}

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

/**
 * Lecture des paramètres du simulateur depuis l'URL (côté serveur) : valeurs
 * absentes ou hors bornes → défaut, jamais d'erreur pour un lien partagé.
 */
import { DEFAULTS, LIMITS, SIMULATOR_PERIODICITIES, type SimulatorParams } from "./simulator";
import { z } from "./zod";

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

/** Valeurs absentes ou hors bornes → défaut (jamais d'erreur pour un lien partagé). */
export function parseSimulatorParams(
  search: Record<string, string | string[] | undefined>,
): SimulatorParams {
  const flat = Object.fromEntries(
    Object.entries(search).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  return simulatorSchema.parse(flat);
}

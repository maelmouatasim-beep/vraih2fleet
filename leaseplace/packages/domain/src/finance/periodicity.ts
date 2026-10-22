/** Périodicité des loyers et moment du paiement dans la période. */

export const PERIODICITIES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type Periodicity = (typeof PERIODICITIES)[number];

export const MONTHS_PER_PERIOD: Readonly<Record<Periodicity, number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** « advance » = terme à échoir (début de période) ; « arrears » = terme échu (fin). */
export const PAYMENT_TIMINGS = ["advance", "arrears"] as const;
export type PaymentTiming = (typeof PAYMENT_TIMINGS)[number];

export const MAX_DURATION_MONTHS = 120;

export function periodsPerYear(periodicity: Periodicity): number {
  return 12 / MONTHS_PER_PERIOD[periodicity];
}

/** Nombre de loyers ; la durée doit être un multiple entier de la période. */
export function periodCount(durationMonths: number, periodicity: Periodicity): number {
  if (
    !Number.isInteger(durationMonths) ||
    durationMonths < 1 ||
    durationMonths > MAX_DURATION_MONTHS
  ) {
    throw new RangeError(`durée : entier de 1 à ${String(MAX_DURATION_MONTHS)} mois`);
  }
  const months = MONTHS_PER_PERIOD[periodicity];
  if (durationMonths % months !== 0) {
    throw new RangeError("durée : multiple entier de la périodicité attendu");
  }
  return durationMonths / months;
}

/** Mois (depuis la mise en loyer) du paiement du loyer n° k (1-indexé). */
export function paymentMonth(k: number, periodicity: Periodicity, timing: PaymentTiming): number {
  const months = MONTHS_PER_PERIOD[periodicity];
  return (timing === "advance" ? k - 1 : k) * months;
}

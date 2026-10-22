import { assertFinite, roundCents } from "./money";

/** TVA marocaine : 20 % par défaut, paramétrable. */
export const DEFAULT_VAT_RATE = 0.2;

export function assertVatRate(rate: number): void {
  assertFinite(rate, "taux de TVA");
  if (rate < 0 || rate > 1) throw new RangeError("taux de TVA : entre 0 et 1");
}

export function vatOf(amountHt: number, rate = DEFAULT_VAT_RATE): number {
  assertVatRate(rate);
  return roundCents(amountHt * rate);
}

export function toTtc(amountHt: number, rate = DEFAULT_VAT_RATE): number {
  return roundCents(roundCents(amountHt) + vatOf(amountHt, rate));
}

export function toHt(amountTtc: number, rate = DEFAULT_VAT_RATE): number {
  assertVatRate(rate);
  return roundCents(amountTtc / (1 + rate));
}

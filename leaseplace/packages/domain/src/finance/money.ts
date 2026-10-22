/**
 * Arithmétique monétaire. Les calculs internes se font en nombres flottants
 * double précision (erreur relative ~1e-16, soit moins de 1e-6 DH sur un
 * milliard) ; tout montant PAYÉ ou AFFICHÉ est arrondi au centime, au plus
 * proche, la moitié s'éloignant de zéro (ADR 0009).
 */

export function roundCents(value: number): number {
  assertFinite(value, "montant");
  const sign = value < 0 ? -1 : 1;
  // Le petit décalage absorbe l'erreur de représentation (1,005 → 1,01).
  return (sign * Math.round(Math.abs(value) * 100 + 1e-7)) / 100 || 0;
}

export function sumCents(values: readonly number[]): number {
  return roundCents(values.reduce((acc, v) => acc + v, 0));
}

export function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} : nombre fini attendu`);
}

export function assertNonNegative(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) throw new RangeError(`${label} : valeur positive ou nulle attendue`);
}

export function assertPositive(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) throw new RangeError(`${label} : valeur strictement positive attendue`);
}

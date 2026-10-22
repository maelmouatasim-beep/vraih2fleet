/**
 * Taux de rendement interne d'un flux (taux par unité de temps du flux).
 * Newton-Raphson depuis une estimation, repli par bissection si Newton
 * diverge, sort du domaine ou stagne.
 */

export interface CashFlow {
  /** Instant, en unités de temps (mois pour le moteur). */
  t: number;
  /** + reçu par le client, − payé par le client. */
  amount: number;
}

const MIN_RATE = -0.99;
const TOLERANCE = 1e-12;

export function npv(rate: number, flows: readonly CashFlow[]): number {
  return flows.reduce((acc, f) => acc + f.amount / (1 + rate) ** f.t, 0);
}

function dNpv(rate: number, flows: readonly CashFlow[]): number {
  return flows.reduce((acc, f) => acc - (f.t * f.amount) / (1 + rate) ** (f.t + 1), 0);
}

export class IrrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IrrError";
  }
}

function newton(flows: readonly CashFlow[], guess: number, maxIterations: number): number | null {
  let rate = guess;
  for (let i = 0; i < maxIterations; i++) {
    const value = npv(rate, flows);
    const slope = dNpv(rate, flows);
    if (slope === 0 || !Number.isFinite(slope)) return null;
    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= MIN_RATE) return null;
    if (Math.abs(next - rate) < TOLERANCE) return next;
    rate = next;
  }
  return null;
}

/** Méthode de repli, exposée pour le contrôle croisé. */
export function bisectionIrr(flows: readonly CashFlow[]): number {
  let low = MIN_RATE;
  let high = 1;
  // Élargit la borne haute jusqu'à encadrer la racine.
  while (Math.sign(npv(low, flows)) === Math.sign(npv(high, flows))) {
    high *= 2;
    if (high > 1e6) throw new IrrError("aucun taux ne s'annule sur [-99 %, +∞[");
  }
  for (let i = 0; i < 300; i++) {
    const mid = (low + high) / 2;
    if (Math.sign(npv(mid, flows)) === Math.sign(npv(low, flows))) low = mid;
    else high = mid;
    if (high - low < TOLERANCE) break;
  }
  return (low + high) / 2;
}

/**
 * Taux périodique annulant la VAN. Exige au moins un flux de chaque signe.
 * Si Newton ne converge pas en `maxIterations` pas, la bissection prend le relais.
 */
export function irr(flows: readonly CashFlow[], guess = 0.01, maxIterations = 60): number {
  const hasIn = flows.some((f) => f.amount > 0);
  const hasOut = flows.some((f) => f.amount < 0);
  if (!hasIn || !hasOut) throw new IrrError("flux d'un seul signe : taux indéfini");
  return newton(flows, guess, maxIterations) ?? bisectionIrr(flows);
}

/** Taux actuariel annuel équivalent à un taux mensuel. */
export function annualizeMonthly(monthlyRate: number): number {
  return (1 + monthlyRate) ** 12 - 1;
}

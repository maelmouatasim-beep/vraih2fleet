import { annualizeMonthly, irr, type CashFlow } from "./irr";
import { assertNonNegative, assertPositive, roundCents, sumCents } from "./money";
import {
  paymentMonth,
  periodCount,
  periodsPerYear,
  type PaymentTiming,
  type Periodicity,
} from "./periodicity";
import { assertVatRate, vatOf } from "./vat";

/**
 * Conditions d'une offre telles que saisies par le bailleur. Le coût total
 * et le TEG ne sont JAMAIS saisis : ils sont calculés ici.
 */
export interface OfferTerms {
  financedAmountHt: number;
  durationMonths: number;
  periodicity: Periodicity;
  timing: PaymentTiming;
  firstRentHt: number;
  rentHt: number;
  residualValueHt: number;
  /** Frais de dossier, payés à la mise en loyer. */
  fileFeesHt: number;
  /** Assurance par période (hors TVA : taxe sur les contrats d'assurance non modélisée). */
  insurancePerPeriodHt: number;
  /** Assurance exigée par le bailleur : entre dans le coût et le TEG. */
  insuranceRequired: boolean;
  vatRate: number;
}

export interface ScheduleLine {
  /** Mois depuis la mise en loyer (0 = signature). */
  month: number;
  /** Numéro du loyer réglé à cette date, ou null (frais seuls, valeur résiduelle). */
  rentNumber: number | null;
  rentHt: number;
  feesHt: number;
  insuranceHt: number;
  residualHt: number;
  totalHt: number;
  vat: number;
  totalTtc: number;
}

export interface NormalizedOffer {
  /** Échéancier standard sur grille mensuelle, toutes périodicités confondues. */
  schedule: ScheduleLine[];
  totals: {
    rentsHt: number;
    feesHt: number;
    insuranceHt: number;
    residualHt: number;
    paidHt: number;
    vat: number;
    paidTtc: number;
    /** Coût du financement : paiements obligatoires HT − montant financé. Critère de classement. */
    financingCostHt: number;
  };
  rates: {
    monthlyRate: number;
    /** TEG implicite actuariel annuel : (1 + taux mensuel)^12 − 1. */
    annualEffectiveRate: number;
    /** Taux nominal proportionnel équivalent : taux mensuel × 12. */
    annualNominalRate: number;
  };
}

function validate(t: OfferTerms) {
  assertPositive(t.financedAmountHt, "montant financé");
  assertPositive(t.rentHt, "loyer");
  assertNonNegative(t.firstRentHt, "premier loyer");
  assertNonNegative(t.residualValueHt, "valeur résiduelle");
  assertNonNegative(t.fileFeesHt, "frais de dossier");
  assertNonNegative(t.insurancePerPeriodHt, "assurance");
  assertVatRate(t.vatRate);
}

export function normalizeOffer(terms: OfferTerms): NormalizedOffer {
  validate(terms);
  const n = periodCount(terms.durationMonths, terms.periodicity);
  const lines = new Map<
    number,
    { rentNumber: number | null; rent: number; fees: number; insurance: number; residual: number }
  >();
  const at = (month: number) => {
    let line = lines.get(month);
    if (!line) {
      line = { rentNumber: null, rent: 0, fees: 0, insurance: 0, residual: 0 };
      lines.set(month, line);
    }
    return line;
  };

  at(0).fees += terms.fileFeesHt;
  for (let k = 1; k <= n; k++) {
    const line = at(paymentMonth(k, terms.periodicity, terms.timing));
    line.rentNumber = k;
    line.rent += k === 1 ? terms.firstRentHt : terms.rentHt;
    line.insurance += terms.insurancePerPeriodHt;
  }
  at(terms.durationMonths).residual += terms.residualValueHt;

  const schedule: ScheduleLine[] = [...lines.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, l]) => l.rent + l.fees + l.insurance + l.residual > 0)
    .map(([month, l]) => {
      const rentHt = roundCents(l.rent);
      const feesHt = roundCents(l.fees);
      const insuranceHt = roundCents(l.insurance);
      const residualHt = roundCents(l.residual);
      const totalHt = sumCents([rentHt, feesHt, insuranceHt, residualHt]);
      const vat = vatOf(rentHt + feesHt + residualHt, terms.vatRate);
      return {
        month,
        rentNumber: l.rentNumber,
        rentHt,
        feesHt,
        insuranceHt,
        residualHt,
        totalHt,
        vat,
        totalTtc: sumCents([totalHt, vat]),
      };
    });

  const total = (pick: (l: ScheduleLine) => number) => sumCents(schedule.map(pick));
  const rentsHt = total((l) => l.rentHt);
  const feesHt = total((l) => l.feesHt);
  const insuranceHt = total((l) => l.insuranceHt);
  const residualHt = total((l) => l.residualHt);
  const mandatoryInsurance = terms.insuranceRequired ? insuranceHt : 0;
  const financingCostHt = sumCents([
    rentsHt,
    feesHt,
    mandatoryInsurance,
    residualHt,
    -terms.financedAmountHt,
  ]);

  // Flux du point de vue du client : il reçoit le bien (montant financé) en 0.
  const flows: CashFlow[] = [{ t: 0, amount: terms.financedAmountHt }];
  for (const l of schedule) {
    const paid = l.rentHt + l.feesHt + l.residualHt + (terms.insuranceRequired ? l.insuranceHt : 0);
    if (paid > 0) flows.push({ t: l.month, amount: -paid });
  }
  const monthlyRate = irr(flows);

  return {
    schedule,
    totals: {
      rentsHt,
      feesHt,
      insuranceHt,
      residualHt,
      paidHt: total((l) => l.totalHt),
      vat: total((l) => l.vat),
      paidTtc: total((l) => l.totalTtc),
      financingCostHt,
    },
    rates: {
      monthlyRate,
      annualEffectiveRate: annualizeMonthly(monthlyRate),
      annualNominalRate: monthlyRate * 12,
    },
  };
}

/** Taux nominal annuel proportionnel d'une offre dans sa propre périodicité (information). */
export function nominalRateForPeriodicity(monthlyRate: number, periodicity: Periodicity): number {
  const perYear = periodsPerYear(periodicity);
  return ((1 + monthlyRate) ** (12 / perYear) - 1) * perYear;
}

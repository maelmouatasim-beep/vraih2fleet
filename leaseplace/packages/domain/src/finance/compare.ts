import { npv, type CashFlow } from "./irr";
import { assertFinite, assertNonNegative, assertPositive, roundCents, sumCents } from "./money";
import type { NormalizedOffer } from "./offer";

/**
 * Comparaison crédit-bail / crédit classique / achat comptant, en HT
 * (entreprise assujettie : TVA récupérable dans les trois cas), sur l'horizon
 * du contrat, avec la propriété du bien à la fin dans les trois cas (levée
 * de l'option d'achat pour le crédit-bail).
 *
 * Effet fiscal (simplifié, à valider par l'expert-comptable du client) :
 * loyers et frais déductibles (crédit-bail) ; intérêts et dotations aux
 * amortissements linéaires déductibles (crédit, comptant). L'économie d'IS
 * est comptée au mois de la charge. Les dotations postérieures à l'horizon
 * sont ignorées dans les trois options, comme l'amortissement de la valeur
 * résiduelle rachetée.
 */
export interface ComparisonAssumptions {
  /** Prix HT du bien (= montant financé en crédit-bail). */
  priceHt: number;
  durationMonths: number;
  /** Taux nominal annuel du crédit classique. */
  loanAnnualRate: number;
  /** Apport du crédit classique, HT. */
  loanDownPaymentHt: number;
  /** Taux annuel d'actualisation (coût d'opportunité de la trésorerie). */
  discountAnnualRate: number;
  /** Taux d'impôt sur les sociétés appliqué aux charges déductibles. */
  corporateTaxRate: number;
  /** Durée d'amortissement fiscal du bien, en années. */
  usefulLifeYears: number;
}

export interface OptionResult {
  /** Sorties de trésorerie cumulées, HT, sur l'horizon. */
  totalOutflowHt: number;
  /** Valeur actuelle des sorties (avant impôt). */
  presentCostHt: number;
  /** Économies d'IS cumulées (non actualisées). */
  taxSavings: number;
  /** Valeur actuelle des sorties nettes des économies d'IS. */
  presentCostAfterTax: number;
}

export interface Comparison {
  lease: OptionResult;
  loan: OptionResult & { monthlyInstallment: number; totalInterest: number };
  cash: OptionResult;
}

interface Flow extends CashFlow {
  deductible: number;
}

function validate(a: ComparisonAssumptions) {
  assertPositive(a.priceHt, "prix");
  if (!Number.isInteger(a.durationMonths) || a.durationMonths < 1)
    throw new RangeError("durée : entier positif");
  for (const [v, label] of [
    [a.loanAnnualRate, "taux du crédit"],
    [a.discountAnnualRate, "taux d'actualisation"],
    [a.corporateTaxRate, "taux d'IS"],
  ] as const) {
    assertFinite(v, label);
    if (v < 0 || v > 1) throw new RangeError(`${label} : entre 0 et 100 %`);
  }
  assertNonNegative(a.loanDownPaymentHt, "apport");
  if (a.loanDownPaymentHt > a.priceHt) throw new RangeError("apport : au plus le prix");
  assertPositive(a.usefulLifeYears, "durée d'amortissement");
}

function evaluate(flows: readonly Flow[], a: ComparisonAssumptions): OptionResult {
  const monthlyDiscount = (1 + a.discountAnnualRate) ** (1 / 12) - 1;
  const outflows = flows.map((f) => ({ t: f.t, amount: f.amount }));
  const savings = flows.map((f) => ({ t: f.t, amount: f.deductible * a.corporateTaxRate }));
  const presentCostHt = roundCents(npv(monthlyDiscount, outflows));
  const presentSavings = npv(monthlyDiscount, savings);
  return {
    totalOutflowHt: sumCents(outflows.map((f) => f.amount)),
    presentCostHt,
    taxSavings: sumCents(savings.map((f) => f.amount)),
    presentCostAfterTax: roundCents(npv(monthlyDiscount, outflows) - presentSavings),
  };
}

function depreciation(a: ComparisonAssumptions): Flow[] {
  const perMonth = a.priceHt / (a.usefulLifeYears * 12);
  const months = Math.min(a.durationMonths, a.usefulLifeYears * 12);
  return Array.from({ length: Math.floor(months) }, (_, m) => ({
    t: m + 1,
    amount: 0,
    deductible: perMonth,
  }));
}

/** Mensualité constante d'un prêt amortissable (taux proportionnel mensuel). */
export function loanInstallment(principal: number, annualRate: number, months: number): number {
  if (principal === 0) return 0;
  const i = annualRate / 12;
  return i === 0 ? principal / months : (principal * i) / (1 - (1 + i) ** -months);
}

export function compareFinancing(offer: NormalizedOffer, a: ComparisonAssumptions): Comparison {
  validate(a);

  // Crédit-bail : chaque paiement de l'échéancier ; loyers, frais et assurance
  // déductibles, valeur résiduelle non déductible sur l'horizon.
  const leaseFlows: Flow[] = offer.schedule.map((l) => ({
    t: l.month,
    amount: l.totalHt,
    deductible: l.rentHt + l.feesHt + l.insuranceHt,
  }));

  // Crédit classique : apport en 0, mensualités constantes, intérêts déductibles.
  const principal = a.priceHt - a.loanDownPaymentHt;
  const installment = loanInstallment(principal, a.loanAnnualRate, a.durationMonths);
  const loanFlows: Flow[] = [{ t: 0, amount: a.loanDownPaymentHt, deductible: 0 }];
  let balance = principal;
  let totalInterest = 0;
  for (let m = 1; m <= a.durationMonths; m++) {
    const interest = balance * (a.loanAnnualRate / 12);
    balance -= installment - interest;
    totalInterest += interest;
    loanFlows.push({ t: m, amount: installment, deductible: interest });
  }
  loanFlows.push(...depreciation(a));

  // Comptant : prix en 0, amortissement déductible.
  const cashFlows: Flow[] = [{ t: 0, amount: a.priceHt, deductible: 0 }, ...depreciation(a)];

  return {
    lease: evaluate(leaseFlows, a),
    loan: {
      ...evaluate(loanFlows, a),
      monthlyInstallment: roundCents(installment),
      totalInterest: roundCents(totalInterest),
    },
    cash: evaluate(cashFlows, a),
  };
}

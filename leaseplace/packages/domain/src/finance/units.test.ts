import { describe, expect, it } from "vitest";
import { compareFinancing, loanInstallment, type ComparisonAssumptions } from "./compare";
import { annualizeMonthly, bisectionIrr, irr, IrrError, npv } from "./irr";
import { assertNonNegative, assertPositive, roundCents, sumCents } from "./money";
import { nominalRateForPeriodicity, normalizeOffer, type OfferTerms } from "./offer";
import { paymentMonth, periodCount, periodsPerYear } from "./periodicity";
import { priceLease } from "./pricing";
import { bestTotalCost, rankOffers, type RankableOffer } from "./ranking";
import { toHt, toTtc, vatOf } from "./vat";

describe("argent", () => {
  it("arrondi au centime, moitié loin de zéro", () => {
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(-1.005)).toBe(-1.01);
    expect(roundCents(2.674999)).toBe(2.67);
    expect(Object.is(roundCents(-0.001), 0)).toBe(true);
    expect(sumCents([0.1, 0.2])).toBe(0.3);
  });
  it("refuse les valeurs non finies ou hors domaine", () => {
    expect(() => roundCents(Number.NaN)).toThrow(RangeError);
    expect(() => {
      assertNonNegative(-1, "x");
    }).toThrow(/positive ou nulle/);
    expect(() => {
      assertPositive(0, "x");
    }).toThrow(/strictement positive/);
  });
});

describe("TVA", () => {
  it("20 % par défaut, paramétrable", () => {
    expect(vatOf(1000)).toBe(200);
    expect(toTtc(1_250_000)).toBe(1_500_000);
    expect(toHt(1_500_000)).toBe(1_250_000);
    expect(toTtc(100, 0.1)).toBe(110);
    expect(() => vatOf(100, 1.5)).toThrow(RangeError);
  });
});

describe("périodicité", () => {
  it("nombre de loyers et échéances", () => {
    expect(periodCount(60, "monthly")).toBe(60);
    expect(periodCount(48, "quarterly")).toBe(16);
    expect(periodsPerYear("semiannual")).toBe(2);
    expect(paymentMonth(1, "quarterly", "advance")).toBe(0);
    expect(paymentMonth(1, "quarterly", "arrears")).toBe(3);
  });
  it("refuse une durée invalide", () => {
    expect(() => periodCount(0, "monthly")).toThrow(RangeError);
    expect(() => periodCount(121, "monthly")).toThrow(RangeError);
    expect(() => periodCount(12.5, "monthly")).toThrow(RangeError);
    expect(() => periodCount(40, "quarterly")).toThrow(/multiple/);
  });
});

describe("TRI", () => {
  it("Newton sur un prêt classique", () => {
    const flows = [
      { t: 0, amount: 1000 },
      ...Array.from({ length: 12 }, (_, k) => ({ t: k + 1, amount: -88.85 })),
    ];
    expect(irr(flows)).toBeCloseTo(0.01, 4);
    expect(npv(irr(flows), flows)).toBeCloseTo(0, 6);
  });
  it("repli par bissection quand Newton sort du domaine", () => {
    expect(
      irr([
        { t: 0, amount: 100 },
        { t: 1, amount: -2 },
      ]),
    ).toBeCloseTo(-0.98, 8);
    expect(
      irr(
        [
          { t: 0, amount: 100 },
          { t: 1, amount: -110 },
        ],
        -1,
      ),
    ).toBeCloseTo(0.1, 8);
  });
  it("repli par bissection quand Newton ne converge pas assez vite", () => {
    const flows = [
      { t: 0, amount: 1000 },
      ...Array.from({ length: 12 }, (_, k) => ({ t: k + 1, amount: -88.85 })),
    ];
    expect(irr(flows, 0.01, 1)).toBeCloseTo(irr(flows), 9);
  });
  it("bissection : élargit la borne haute", () => {
    expect(
      bisectionIrr([
        { t: 0, amount: 100 },
        { t: 1, amount: -300 },
      ]),
    ).toBeCloseTo(2, 8);
  });
  it("taux indéfini : flux d'un seul signe ou sans racine", () => {
    expect(() => irr([{ t: 0, amount: 100 }])).toThrow(IrrError);
    expect(() =>
      irr([
        { t: 0, amount: -1 },
        { t: 1, amount: 2 },
        { t: 2, amount: -2 },
      ]),
    ).toThrow(/aucun taux/);
    expect(() =>
      irr([
        { t: 0, amount: -1 },
        { t: 0, amount: 2 },
      ]),
    ).toThrow(IrrError);
  });
  it("annualisation actuarielle", () => {
    expect(annualizeMonthly(0.01)).toBeCloseTo(0.126825, 6);
  });
});

describe("tarification", () => {
  const base = {
    financedAmountHt: 100_000,
    durationMonths: 12,
    periodicity: "monthly",
    timing: "arrears",
    annualRate: 0.12,
    residualValueHt: 0,
  } as const;
  it("loyer constant d'un prêt à 12 %", () => {
    expect(priceLease(base).rentHt).toBe(8884.88);
  });
  it("refuse des paramètres incohérents", () => {
    expect(() => priceLease({ ...base, annualRate: 1.5 })).toThrow(/taux annuel/);
    expect(() => priceLease({ ...base, annualRate: -0.01 })).toThrow(/taux annuel/);
    expect(() => priceLease({ ...base, residualValueHt: 100_000 })).toThrow(/valeur résiduelle/);
    expect(() => priceLease({ ...base, durationMonths: 1, firstRentHt: 10 })).toThrow(
      /deux loyers/,
    );
    expect(() => priceLease({ ...base, firstRentHt: 110_000 })).toThrow(/couvrent déjà/);
    expect(() => priceLease({ ...base, financedAmountHt: 0 })).toThrow(RangeError);
  });
  it("un premier loyer majoré baisse les loyers suivants", () => {
    const majore = priceLease({ ...base, firstRentHt: 20_000 });
    expect(majore.firstRentHt).toBe(20_000);
    expect(majore.rentHt).toBeLessThan(priceLease(base).rentHt);
  });
});

const terms: OfferTerms = {
  financedAmountHt: 120_000,
  durationMonths: 12,
  periodicity: "monthly",
  timing: "arrears",
  firstRentHt: 10_000,
  rentHt: 10_000,
  residualValueHt: 0,
  fileFeesHt: 0,
  insurancePerPeriodHt: 0,
  insuranceRequired: false,
  vatRate: 0.2,
};

describe("normalisation d'une offre", () => {
  it("taux nul : coût nul, TEG nul, 12 lignes", () => {
    const o = normalizeOffer(terms);
    expect(o.schedule).toHaveLength(12);
    expect(o.schedule[0]?.month).toBe(1);
    expect(o.totals.financingCostHt).toBe(0);
    expect(Math.abs(o.rates.annualEffectiveRate)).toBeLessThan(1e-9);
  });
  it("frais et assurance obligatoire renchérissent le coût et le TEG ; l'assurance facultative non", () => {
    const withFees = normalizeOffer({ ...terms, fileFeesHt: 1200, insurancePerPeriodHt: 50 });
    expect(withFees.schedule[0]).toMatchObject({ month: 0, feesHt: 1200, rentNumber: null });
    expect(withFees.totals.financingCostHt).toBe(1200);
    expect(withFees.totals.insuranceHt).toBe(600);
    const required = normalizeOffer({
      ...terms,
      fileFeesHt: 1200,
      insurancePerPeriodHt: 50,
      insuranceRequired: true,
    });
    expect(required.totals.financingCostHt).toBe(1800);
    expect(required.rates.annualEffectiveRate).toBeGreaterThan(withFees.rates.annualEffectiveRate);
  });
  it("à échoir : premier loyer à la signature, valeur résiduelle en fin de contrat", () => {
    const o = normalizeOffer({
      ...terms,
      timing: "advance",
      firstRentHt: 30_000,
      rentHt: 8_000,
      residualValueHt: 1_000,
    });
    expect(o.schedule[0]).toMatchObject({ month: 0, rentNumber: 1, rentHt: 30_000 });
    expect(o.schedule.at(-1)).toMatchObject({ month: 12, rentNumber: null, residualHt: 1_000 });
  });
  it("une échéance sans paiement obligatoire n'entre pas dans le TEG", () => {
    const o = normalizeOffer({
      ...terms,
      timing: "advance",
      firstRentHt: 0,
      rentHt: 120_000 / 11,
      insurancePerPeriodHt: 10,
    });
    expect(o.schedule[0]).toMatchObject({ month: 0, rentHt: 0, insuranceHt: 10 });
    expect(Number.isFinite(o.rates.annualEffectiveRate)).toBe(true);
  });
  it("refuse des conditions invalides", () => {
    expect(() => normalizeOffer({ ...terms, rentHt: 0 })).toThrow(RangeError);
    expect(() => normalizeOffer({ ...terms, vatRate: -0.1 })).toThrow(RangeError);
  });
  it("taux nominal dans la périodicité de l'offre", () => {
    expect(nominalRateForPeriodicity(0.01, "monthly")).toBeCloseTo(0.12, 10);
    expect(nominalRateForPeriodicity(0.01, "annual")).toBeCloseTo(0.126825, 6);
  });
});

describe("classement neutre", () => {
  const offer = (
    id: string,
    cost: number,
    rate: number,
    rent = 100,
    first = 100,
  ): RankableOffer => ({
    id,
    terms: { rentHt: rent, firstRentHt: first },
    normalized: {
      totals: {
        rentsHt: 0,
        feesHt: 0,
        insuranceHt: 0,
        residualHt: 0,
        paidHt: 0,
        vat: 0,
        paidTtc: 0,
        financingCostHt: cost,
      },
      rates: { monthlyRate: 0, annualEffectiveRate: rate, annualNominalRate: 0 },
    },
  });
  const a = offer("a", 5000, 0.09, 300, 100);
  const b = offer("b", 4000, 0.1, 200, 300);
  const c = offer("c", 4000, 0.08, 250, 200);
  const d = offer("d", 4000, 0.08, 250, 200);

  it("par coût total par défaut, égalités par TEG puis identifiant", () => {
    expect(rankOffers([a, b, d, c]).map((o) => o.id)).toEqual(["c", "d", "b", "a"]);
    expect(bestTotalCost([a, b])?.id).toBe("b");
    expect(bestTotalCost([])).toBeNull();
    const twins = ["z", "y", "x"].map((id) => ({ ...c, id }));
    expect(rankOffers(twins).map((o) => o.id)).toEqual(["x", "y", "z"]);
    expect(rankOffers([...twins].reverse()).map((o) => o.id)).toEqual(["x", "y", "z"]);
    expect(rankOffers([c, { ...c }]).map((o) => o.id)).toEqual(["c", "c"]);
  });
  it("autres tris au choix du client", () => {
    expect(rankOffers([a, b, c], "effectiveRate").map((o) => o.id)).toEqual(["c", "a", "b"]);
    expect(rankOffers([a, b, c], "rent").map((o) => o.id)).toEqual(["b", "c", "a"]);
    expect(rankOffers([a, b, c], "firstRent").map((o) => o.id)).toEqual(["a", "c", "b"]);
  });
});

describe("comparaison crédit-bail / crédit / comptant", () => {
  const assumptions: ComparisonAssumptions = {
    priceHt: 120_000,
    durationMonths: 12,
    loanAnnualRate: 0,
    loanDownPaymentHt: 0,
    discountAnnualRate: 0,
    corporateTaxRate: 0.2,
    usefulLifeYears: 1,
  };
  it("à taux nuls, les trois options coûtent le prix et économisent le même IS", () => {
    const r = compareFinancing(normalizeOffer(terms), assumptions);
    for (const option of [r.lease, r.loan, r.cash]) {
      expect(option.totalOutflowHt).toBe(120_000);
      expect(option.presentCostHt).toBe(120_000);
      expect(option.taxSavings).toBe(24_000);
      expect(option.presentCostAfterTax).toBe(96_000);
    }
    expect(r.loan.monthlyInstallment).toBe(10_000);
    expect(r.loan.totalInterest).toBe(0);
  });
  it("crédit à 12 % : mensualité, intérêts, actualisation", () => {
    const r = compareFinancing(normalizeOffer(terms), {
      ...assumptions,
      loanAnnualRate: 0.12,
      loanDownPaymentHt: 20_000,
      discountAnnualRate: 0.08,
      usefulLifeYears: 5,
    });
    expect(r.loan.monthlyInstallment).toBe(8884.88);
    expect(r.loan.totalInterest).toBeCloseTo(8884.88 * 12 - 100_000, 0);
    expect(r.loan.totalOutflowHt).toBeCloseTo(20_000 + 8884.88 * 12, 0);
    expect(r.cash.presentCostHt).toBe(120_000);
    expect(r.lease.presentCostHt).toBeLessThan(120_000);
    expect(r.cash.taxSavings).toBe(4_800);
  });
  it("prêt sans capital emprunté", () => {
    expect(loanInstallment(0, 0.1, 12)).toBe(0);
    const r = compareFinancing(normalizeOffer(terms), {
      ...assumptions,
      loanDownPaymentHt: 120_000,
    });
    expect(r.loan.monthlyInstallment).toBe(0);
  });
  it("refuse des hypothèses invalides", () => {
    const n = normalizeOffer(terms);
    expect(() => compareFinancing(n, { ...assumptions, durationMonths: 0 })).toThrow(/durée/);
    expect(() => compareFinancing(n, { ...assumptions, corporateTaxRate: 2 })).toThrow(/IS/);
    expect(() => compareFinancing(n, { ...assumptions, loanDownPaymentHt: 200_000 })).toThrow(
      /apport/,
    );
    expect(() => compareFinancing(n, { ...assumptions, usefulLifeYears: 0 })).toThrow(
      /amortissement/,
    );
  });
});

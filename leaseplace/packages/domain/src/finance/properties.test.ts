import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeOffer, type OfferTerms } from "./offer";
import {
  MONTHS_PER_PERIOD,
  PAYMENT_TIMINGS,
  PERIODICITIES,
  periodsPerYear,
  type PaymentTiming,
  type Periodicity,
} from "./periodicity";
import { priceLease } from "./pricing";
import { rankOffers } from "./ranking";

interface Lease {
  amount: number;
  periodicity: Periodicity;
  periodsCount: number;
  timing: PaymentTiming;
  rateBp: number;
  rvPct: number;
}

const leaseArb: fc.Arbitrary<Lease> = fc
  .record({
    amount: fc.integer({ min: 10_000, max: 50_000_000 }),
    periodicity: fc.constantFrom(...PERIODICITIES),
    periodsCount: fc.integer({ min: 2, max: 10 }),
    timing: fc.constantFrom(...PAYMENT_TIMINGS),
    rateBp: fc.integer({ min: 0, max: 2_500 }),
    rvPct: fc.integer({ min: 0, max: 30 }),
  })
  .filter((x) => x.periodsCount * MONTHS_PER_PERIOD[x.periodicity] <= 120);

function terms(x: Lease): OfferTerms {
  const durationMonths = x.periodsCount * MONTHS_PER_PERIOD[x.periodicity];
  const residualValueHt = Math.round((x.amount * x.rvPct) / 100);
  const pricing = priceLease({
    financedAmountHt: x.amount,
    durationMonths,
    periodicity: x.periodicity,
    timing: x.timing,
    annualRate: x.rateBp / 10_000,
    residualValueHt,
  });
  return {
    financedAmountHt: x.amount,
    durationMonths,
    periodicity: x.periodicity,
    timing: x.timing,
    firstRentHt: pricing.firstRentHt,
    rentHt: pricing.rentHt,
    residualValueHt,
    fileFeesHt: 0,
    insurancePerPeriodHt: 0,
    insuranceRequired: false,
    vatRate: 0.2,
  };
}

describe("propriétés du moteur", () => {
  it("le TEG retrouve le taux du loyer (taux proportionnel → actuariel)", () => {
    fc.assert(
      fc.property(leaseArb, (x) => {
        const offer = normalizeOffer(terms(x));
        const periodic = x.rateBp / 10_000 / periodsPerYear(x.periodicity);
        const expected = (1 + periodic) ** periodsPerYear(x.periodicity) - 1;
        // Arrondi du loyer au centime : écart de taux négligeable.
        expect(Math.abs(offer.rates.annualEffectiveRate - expected)).toBeLessThan(2e-5);
      }),
    );
  });

  it("coût du financement ≥ 0 si le taux est positif, et croissant avec le taux", () => {
    fc.assert(
      fc.property(leaseArb, (x) => {
        const low = normalizeOffer(terms(x)).totals.financingCostHt;
        const high = normalizeOffer(terms({ ...x, rateBp: x.rateBp + 100 })).totals.financingCostHt;
        expect(low).toBeGreaterThanOrEqual(-0.01 * x.periodsCount);
        expect(high).toBeGreaterThan(low);
      }),
    );
  });

  it("TTC = HT + TVA, ligne par ligne et au total", () => {
    fc.assert(
      fc.property(leaseArb, (x) => {
        const offer = normalizeOffer(terms(x));
        for (const l of offer.schedule) expect(l.totalTtc).toBeCloseTo(l.totalHt + l.vat, 2);
        expect(offer.totals.paidTtc).toBeCloseTo(offer.totals.paidHt + offer.totals.vat, 2);
      }),
    );
  });

  it("le classement ne dépend pas de l'ordre de présentation", () => {
    fc.assert(
      fc.property(fc.array(leaseArb, { minLength: 1, maxLength: 6 }), (xs) => {
        const offers = xs.map((x, i) => ({
          id: `o${String(i)}`,
          terms: terms(x),
          normalized: normalizeOffer(terms(x)),
        }));
        const ids = rankOffers(offers).map((o) => o.id);
        expect(rankOffers([...offers].reverse()).map((o) => o.id)).toEqual(ids);
      }),
    );
  });
});

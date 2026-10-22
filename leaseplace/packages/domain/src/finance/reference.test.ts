import { describe, expect, it } from "vitest";
import cases from "./__fixtures__/reference-cases.json";
import { normalizeOffer } from "./offer";
import type { PaymentTiming, Periodicity } from "./periodicity";
import { priceLease } from "./pricing";
import { DEFAULT_VAT_RATE } from "./vat";

// Cas recalculés par une implémentation indépendante (scripts/finance/reference.py,
// Decimal + bissection) : tolérance ±0,01 DH, ±0,0001 point de TEG.
describe.each(cases)("cas de référence $id", ({ input, expected }) => {
  const pricing = priceLease({
    financedAmountHt: input.financedAmountHt,
    durationMonths: input.durationMonths,
    periodicity: input.periodicity as Periodicity,
    timing: input.timing as PaymentTiming,
    annualRate: input.annualRate,
    residualValueHt: input.residualValueHt,
    ...(input.firstRentHt === null ? {} : { firstRentHt: input.firstRentHt }),
  });
  const offer = normalizeOffer({
    financedAmountHt: input.financedAmountHt,
    durationMonths: input.durationMonths,
    periodicity: input.periodicity as Periodicity,
    timing: input.timing as PaymentTiming,
    firstRentHt: pricing.firstRentHt,
    rentHt: pricing.rentHt,
    residualValueHt: input.residualValueHt,
    fileFeesHt: input.fileFeesHt,
    insurancePerPeriodHt: input.insurancePerPeriodHt,
    insuranceRequired: input.insuranceRequired,
    vatRate: DEFAULT_VAT_RATE,
  });

  it("loyers", () => {
    expect(pricing.periods).toBe(expected.periods);
    expect(pricing.rentHt).toBeCloseTo(expected.rentHt, 2);
    expect(pricing.firstRentHt).toBeCloseTo(expected.firstRentHt, 2);
  });

  it("totaux et TVA", () => {
    expect(offer.totals.rentsHt).toBeCloseTo(expected.rentsHt, 2);
    expect(offer.totals.paidHt).toBeCloseTo(expected.paidHt, 2);
    expect(offer.totals.vat).toBeCloseTo(expected.vat, 2);
    expect(offer.totals.paidTtc).toBeCloseTo(expected.paidTtc, 2);
    expect(offer.totals.financingCostHt).toBeCloseTo(expected.financingCostHt, 2);
  });

  it("TEG actuariel", () => {
    expect(Math.abs(offer.rates.annualEffectiveRate - expected.annualEffectiveRate)).toBeLessThan(
      1e-6,
    );
  });
});

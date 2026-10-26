import { describe, expect, it } from "vitest";
import { offerIssues, priceOffer, type OfferInput } from "./offers";

const now = new Date("2026-10-26T10:00:00Z");
const offer: OfferInput = {
  financedAmountHt: 1_000_000,
  durationMonths: 60,
  periodicity: "monthly",
  timing: "advance",
  annualRate: 0.085,
  firstRentHt: 100_000,
  residualValueHt: 10_000,
  fileFeesHt: 2_500,
  insurancePerPeriodHt: 0,
  insuranceRequired: false,
  validUntil: new Date("2026-11-25T00:00:00Z"),
  conditions: "Caution personnelle du dirigeant.",
};

describe("offre d'un bailleur", () => {
  it("offre conforme : aucune objection", () => {
    expect(offerIssues(offer, 1_000_000, now)).toEqual([]);
  });

  it("chaque condition hors bornes est signalée", () => {
    expect(
      offerIssues(
        {
          ...offer,
          financedAmountHt: 2_000_000,
          durationMonths: 130,
          annualRate: 0.5,
          firstRentHt: 1_500_000,
          residualValueHt: -1,
          fileFeesHt: -1,
          validUntil: new Date("2027-06-01T00:00:00Z"),
          conditions: "x".repeat(2001),
        },
        1_000_000,
        now,
      ),
    ).toEqual([
      "amount_invalid",
      "duration_invalid",
      "rate_invalid",
      "first_rent_invalid",
      "residual_invalid",
      "fees_invalid",
      "validity_invalid",
      "conditions_too_long",
    ]);
  });

  it("validité passée, valeurs non finies : refusées", () => {
    expect(
      offerIssues(
        {
          ...offer,
          validUntil: new Date("2026-10-20T00:00:00Z"),
          annualRate: Number.NaN,
          insurancePerPeriodHt: Number.NaN,
        },
        1_000_000,
        now,
      ),
    ).toEqual(["rate_invalid", "fees_invalid", "validity_invalid"]);
    expect(
      offerIssues({ ...offer, durationMonths: 61, periodicity: "quarterly" }, 1_000_000, now),
    ).toEqual(["duration_invalid"]);
  });

  it("loyer, coût total et TEG recalculés par le moteur", () => {
    const p = priceOffer(offer);
    expect(p.firstRentHt).toBe(100_000);
    expect(p.rentHt).toBeGreaterThan(15_000);
    expect(p.rentHt).toBeLessThan(20_000);
    expect(p.normalized.totals.financingCostHt).toBeGreaterThan(0);
    expect(p.normalized.rates.annualEffectiveRate).toBeGreaterThan(0.085);
    const plain = priceOffer({ ...offer, firstRentHt: 0, fileFeesHt: 0 });
    expect(plain.firstRentHt).toBe(plain.rentHt);
  });
});

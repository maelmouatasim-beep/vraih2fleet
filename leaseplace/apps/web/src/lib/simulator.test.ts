import { describe, expect, it } from "vitest";
import { DEFAULTS, parseSimulatorParams, simulate, toSearchParams } from "./simulator";

describe("simulateur", () => {
  it("défauts quand l'URL est vide ou invalide", () => {
    expect(parseSimulatorParams({})).toEqual(DEFAULTS);
    expect(
      parseSimulatorParams({ amount: "abc", months: "61", periodicity: "weekly", ratePct: "99" }),
    ).toEqual(DEFAULTS);
  });

  it("lit une simulation partagée et la réécrit à l'identique", () => {
    const p = parseSimulatorParams({
      amount: "2400000",
      months: ["48"],
      periodicity: "quarterly",
      ratePct: "8.25",
    });
    expect(p).toMatchObject({
      amount: 2_400_000,
      months: 48,
      periodicity: "quarterly",
      ratePct: 8.25,
    });
    expect(toSearchParams(p).toString()).toBe(
      "amount=2400000&months=48&periodicity=quarterly&ratePct=8.25",
    );
    expect(toSearchParams(DEFAULTS).toString()).toBe("");
  });

  it("calcule loyer, TEG et comparaison avec le moteur", () => {
    const r = simulate({
      ...DEFAULTS,
      firstRentPct: 0,
      residualPct: 0,
      timing: "arrears",
      amount: 500_000,
      months: 36,
      ratePct: 7.5,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pricing.rentHt).toBe(15_553.11);
    expect(r.offer.rates.annualEffectiveRate).toBeCloseTo(0.077633, 5);
    expect(r.comparison.cash.presentCostHt).toBe(500_000);
  });

  it("paramètres incohérents (hors bornes de l'écran) : résultat explicite, pas d'exception", () => {
    expect(simulate({ ...DEFAULTS, firstRentPct: 90, residualPct: 20 })).toEqual({
      ok: false,
      reason: "inconsistent",
    });
  });
});

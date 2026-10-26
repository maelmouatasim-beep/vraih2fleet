import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  COMMISSION_CANCEL_REASONS,
  DEFAULT_COMMISSION_GRID,
  commissionMachine,
  computeCommission,
  gridIssues,
  invoiceDueOn,
  isInvoiceOverdue,
  mandateActivationIssues,
  mandateMachine,
} from "./billing";

describe("grille de commission", () => {
  it("grille par défaut : de 1,5 % à 0,4 %, dégressive, valide", () => {
    expect(gridIssues(DEFAULT_COMMISSION_GRID)).toEqual([]);
    expect(DEFAULT_COMMISSION_GRID[0]?.rate).toBe(0.015);
    expect(DEFAULT_COMMISSION_GRID.at(-1)?.rate).toBe(0.004);
  });

  it("chaque défaut de grille est signalé", () => {
    expect(gridIssues([])).toEqual(["empty"]);
    expect(
      gridIssues([
        { from: 100, rate: 0.01 },
        { from: 50, rate: 0.02 },
        { from: 60, rate: 0.2 },
      ]),
    ).toEqual(["first_not_zero", "not_ascending", "not_degressive", "rate_out_of_range"]);
    expect(
      gridIssues(Array.from({ length: 11 }, (_, i) => ({ from: i * 1000, rate: 0.01 }))),
    ).toEqual(["too_many_tiers"]);
    expect(gridIssues([{ from: 0, rate: Number.NaN }])).toEqual(["rate_out_of_range"]);
    expect(
      gridIssues([
        { from: 0, rate: 0.01 },
        { from: Number.NaN, rate: 0.01 },
      ]),
    ).toEqual(["not_ascending"]);
  });
});

describe("calcul de la commission (tranches marginales)", () => {
  it("cas vérifiés à la main", () => {
    // 400 000 × 1,5 % = 6 000.
    expect(computeCommission(400_000, DEFAULT_COMMISSION_GRID).amountHt).toBe(6_000);
    // 1 150 000 : 500 000 × 1,5 % + 500 000 × 1,2 % + 150 000 × 0,9 % = 7 500 + 6 000 + 1 350.
    const c = computeCommission(1_150_000, DEFAULT_COMMISSION_GRID);
    expect(c.lines.map((l) => l.amount)).toEqual([7_500, 6_000, 1_350]);
    expect(c.amountHt).toBe(14_850);
  });

  it("répartition par tranche, TVA, taux effectif", () => {
    const c = computeCommission(6_000_000, DEFAULT_COMMISSION_GRID);
    // 7 500 + 6 000 + 9 000 + 18 000 + 4 000 = 44 500.
    expect(c.lines.map((l) => l.amount)).toEqual([7_500, 6_000, 9_000, 18_000, 4_000]);
    expect(c.amountHt).toBe(44_500);
    expect(c.vat).toBe(8_900);
    expect(c.amountTtc).toBe(53_400);
    expect(c.effectiveRate).toBeCloseTo(0.0074167, 6);
    expect(c.lines.at(-1)?.to).toBeNull();
  });

  it("montant ou grille invalides refusés", () => {
    expect(() => computeCommission(0, DEFAULT_COMMISSION_GRID)).toThrow(RangeError);
    expect(() => computeCommission(Number.NaN, DEFAULT_COMMISSION_GRID)).toThrow(RangeError);
    expect(() => computeCommission(100, [])).toThrow(/grille/);
  });

  it("propriétés : croissante, continue, taux effectif entre le dernier et le premier taux", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (a, d) => {
          const x = computeCommission(a, DEFAULT_COMMISSION_GRID);
          const y = computeCommission(a + d, DEFAULT_COMMISSION_GRID);
          expect(y.amountHt).toBeGreaterThanOrEqual(x.amountHt);
          // Continuité : l'écart ne dépasse jamais le premier taux appliqué à l'écart de montant.
          expect(y.amountHt - x.amountHt).toBeLessThanOrEqual(d * 0.015 + 0.02);
          expect(x.effectiveRate).toBeLessThanOrEqual(0.015 + 0.005 / a + 1e-12);
          expect(x.effectiveRate).toBeGreaterThanOrEqual(0.004 - 0.01 / a);
        },
      ),
    );
  });
});

describe("mandat", () => {
  const now = new Date("2026-10-26T10:00:00Z");
  const ok = {
    contractVersion: "MANDAT-2026-01",
    signedOn: new Date("2026-10-20T00:00:00Z"),
    antiCircumvention: true,
    antiCircumventionMonths: 24,
    grid: DEFAULT_COMMISSION_GRID,
  };
  it("cycle de vie", () => {
    expect(mandateMachine.edges()).toEqual([
      ["draft", "active"],
      ["draft", "terminated"],
      ["active", "suspended"],
      ["active", "terminated"],
      ["suspended", "active"],
      ["suspended", "terminated"],
    ]);
  });
  it("activation : version, signature passée, clause anti-contournement, grille valide", () => {
    expect(mandateActivationIssues(ok, now)).toEqual([]);
    expect(
      mandateActivationIssues(
        {
          contractVersion: " ",
          signedOn: null,
          antiCircumvention: false,
          antiCircumventionMonths: 0,
          grid: [],
        },
        now,
      ),
    ).toEqual([
      "version_missing",
      "signed_on_missing",
      "anti_circumvention_missing",
      "grid_invalid",
    ]);
    expect(
      mandateActivationIssues(
        { ...ok, signedOn: new Date("2026-11-01"), antiCircumventionMonths: 48 },
        now,
      ),
    ).toEqual(["signed_in_future", "anti_circumvention_out_of_range"]);
    expect(mandateActivationIssues({ ...ok, antiCircumventionMonths: 12.5 }, now)).toEqual([
      "anti_circumvention_out_of_range",
    ]);
  });
});

describe("commission et facture", () => {
  it("due → facturée → payée ; annulation par avoir avant paiement", () => {
    expect(commissionMachine.edges()).toEqual([
      ["due", "invoiced"],
      ["due", "cancelled"],
      ["invoiced", "paid"],
      ["invoiced", "cancelled"],
    ]);
    expect(COMMISSION_CANCEL_REASONS).toContain("other");
  });
  it("échéance à 30 jours ; retard au jour près, seulement si facturée", () => {
    const issued = new Date("2026-10-01T00:00:00Z");
    const due = invoiceDueOn(issued);
    expect(due.toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(isInvoiceOverdue("invoiced", due, new Date("2026-10-31T23:00:00Z"))).toBe(false);
    expect(isInvoiceOverdue("invoiced", due, new Date("2026-11-01T00:00:00Z"))).toBe(true);
    expect(isInvoiceOverdue("paid", due, new Date("2026-12-01T00:00:00Z"))).toBe(false);
    expect(isInvoiceOverdue("invoiced", null, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
});

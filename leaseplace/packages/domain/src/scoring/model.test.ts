import { describe, expect, it } from "vitest";
import type { FiscalYearFigures } from "../kyc/extraction";
import {
  assess,
  computeRatios,
  effectiveGrade,
  FACTOR_WEIGHTS,
  gradeOf,
  isGrade,
  overrideIssues,
  referenceAnnualRent,
  SCORING_MODEL_VERSION,
  type Factor,
  type ScoringInput,
} from "./model";

const now = new Date("2026-10-25T00:00:00Z");
const year = (over: Partial<FiscalYearFigures> = {}): FiscalYearFigures => ({
  year: 2025,
  revenue: 20_000_000,
  netIncome: 2_400_000,
  depreciation: 1_000_000,
  equity: 6_000_000,
  financialDebt: 2_000_000,
  cash: 1_800_000,
  ...over,
});

const solid: ScoringInput = {
  now,
  incorporationDate: new Date("2012-03-01T00:00:00Z"),
  sector: "health",
  equipmentCategory: "truck",
  condition: "new",
  equipmentYear: null,
  amountHt: 1_000_000,
  annualRentHt: 240_000,
  fiscalYears: [year({ year: 2024, revenue: 18_000_000 }), year()],
  consistencyFailures: 0,
};

const factor = (input: ScoringInput, f: Factor) =>
  assess(input).factors.find((x) => x.factor === f)?.score;
const withYear = (over: Partial<FiscalYearFigures>): ScoringInput => ({
  ...solid,
  fiscalYears: [year(over)],
});

describe("indice d'orientation v1", () => {
  it("dossier solide : note A, aucun drapeau, version tracée", () => {
    const a = assess(solid);
    expect(a.modelVersion).toBe(SCORING_MODEL_VERSION);
    expect(a.grade).toBe("A");
    expect(a.flags).toEqual([]);
    expect(a.factors.every((f) => f.level !== "missing")).toBe(true);
    expect(a.ratios.rentCoverage).toBeCloseTo(3_400_000 / 240_000);
    expect(a.ratios.revenueGrowth).toBeCloseTo(2 / 18);
  });

  it("les poids font 100", () => {
    expect(Object.values(FACTOR_WEIGHTS).reduce((s, w) => s + w, 0)).toBe(100);
  });

  it.each([
    [2.5, 100],
    [1.6, 80],
    [1.3, 60],
    [1.05, 40],
    [0.8, 20],
    [0.5, 0],
  ])("couverture %f → %i points", (coverage, points) => {
    const caf = coverage * solid.annualRentHt;
    expect(factor(withYear({ netIncome: caf - 1_000_000 }), "coverage")).toBe(points);
  });

  it.each([
    [0.4, 100],
    [0.9, 80],
    [1.8, 60],
    [2.5, 35],
    [4, 10],
  ])("endettement %f → %i points", (gearing, points) => {
    expect(factor(withYear({ financialDebt: gearing * 6_000_000 }), "leverage")).toBe(points);
  });

  it.each([
    [0.12, 100],
    [0.06, 80],
    [0.03, 60],
    [0.01, 40],
    [-0.05, 10],
  ])("marge nette %f → %i points", (margin, points) => {
    expect(factor(withYear({ netIncome: margin * 20_000_000 }), "profitability")).toBe(points);
  });

  it.each([
    [7, 100],
    [4, 75],
    [2, 50],
    [0.5, 20],
  ])("trésorerie %f mois de loyer → %i points", (months, points) => {
    expect(factor(withYear({ cash: (months * solid.annualRentHt) / 12 }), "liquidity")).toBe(
      points,
    );
  });

  it.each([
    [50_000_000, 100],
    [5_000_000, 75],
    [3_000_000, 45],
    [1_500_000, 15],
  ])("exposition (CA %i) → %i points", (revenue, points) => {
    expect(factor(withYear({ revenue }), "exposure")).toBe(points);
  });

  it.each([
    ["2010-01-01", 100],
    ["2020-01-01", 80],
    ["2023-01-01", 60],
    ["2024-06-01", 45],
    ["2025-06-01", 30],
    ["2026-06-01", 15],
  ])("ancienneté depuis %s → %i points", (date, points) => {
    expect(
      factor({ ...solid, incorporationDate: new Date(`${date}T00:00:00Z`) }, "seniority"),
    ).toBe(points);
  });

  it("date de création inconnue : ancienneté au plus bas", () => {
    expect(factor({ ...solid, incorporationDate: null }, "seniority")).toBe(15);
  });

  it("secteur et actif : risque sectoriel, liquidité, décote de l'occasion", () => {
    expect(factor({ ...solid, sector: "tourism" }, "sector")).toBe(40);
    expect(factor({ ...solid, sector: "transport" }, "sector")).toBe(65);
    expect(factor({ ...solid, equipmentCategory: "medical" }, "asset")).toBe(65);
    expect(factor({ ...solid, equipmentCategory: "it" }, "asset")).toBe(35);
    expect(factor({ ...solid, condition: "used", equipmentYear: 2022 }, "asset")).toBe(80);
    expect(factor({ ...solid, condition: "used", equipmentYear: null }, "asset")).toBe(80);
    const old = assess({ ...solid, condition: "used", equipmentYear: 2010 });
    expect(old.factors.find((f) => f.factor === "asset")?.score).toBe(60);
    expect(old.flags.map((f) => f.code)).toContain("old_used_asset");
  });

  it("sans états financiers : facteurs financiers absents, note plafonnée à C", () => {
    const a = assess({ ...solid, fiscalYears: [] });
    expect(a.factors.filter((f) => f.level === "missing").map((f) => f.factor)).toEqual([
      "coverage",
      "leverage",
      "profitability",
      "liquidity",
      "exposure",
    ]);
    expect(a.uncappedGrade).toBe("A");
    expect(a.grade).toBe("C");
    expect(a.flags).toEqual([
      { code: "no_financial_statements", severity: "warning", value: null },
    ]);
  });

  it("drapeau grave : note plafonnée à D", () => {
    const a = assess({ ...solid, consistencyFailures: 1 });
    expect(a.uncappedGrade).toBe("A");
    expect(a.grade).toBe("D");
    expect(a.flags[0]).toEqual({ code: "consistency_failures", severity: "severe", value: 1 });
  });

  it("entreprise fragile : drapeaux et note E", () => {
    const a = assess({
      ...solid,
      incorporationDate: new Date("2025-01-01T00:00:00Z"),
      sector: "construction",
      equipmentCategory: "other",
      amountHt: 3_000_000,
      fiscalYears: [
        year({ year: 2022, revenue: 5_000_000 }),
        year({
          year: 2023,
          revenue: 2_000_000,
          netIncome: -900_000,
          depreciation: 100_000,
          equity: -50_000,
          cash: 5_000,
        }),
      ],
    });
    expect(a.grade).toBe("E");
    expect(a.flags.map((f) => f.code)).toEqual([
      "negative_equity",
      "negative_caf",
      "net_loss",
      "low_cash",
      "high_exposure",
      "young_company",
      "revenue_decline",
      "stale_financials",
    ]);
    expect(a.factors.find((f) => f.factor === "leverage")).toMatchObject({
      score: 0,
      level: "weak",
    });
  });

  it("couverture inférieure à 1 avec CAF positive : drapeau grave dédié", () => {
    const a = assess(withYear({ netIncome: -800_000 }));
    expect(a.flags.map((f) => f.code)).toEqual(["coverage_below_one", "net_loss"]);
  });

  it("ratios non calculables : CA ou loyer nuls", () => {
    const r = computeRatios({ ...solid, annualRentHt: 0, fiscalYears: [year({ revenue: 0 })] });
    expect(r.rentCoverage).toBeNull();
    expect(r.netMargin).toBeNull();
    expect(r.exposure).toBeNull();
    expect(r.cashMonthsOfRent).toBeNull();
    const a = assess({ ...solid, annualRentHt: 0, fiscalYears: [year({ revenue: 0 })] });
    expect(a.factors.find((f) => f.factor === "coverage")?.level).toBe("missing");
  });
});

describe("notes", () => {
  it.each([
    [80, "A"],
    [79.99, "B"],
    [65, "B"],
    [50, "C"],
    [35, "D"],
    [34.9, "E"],
  ] as const)("score %f → %s", (score, grade) => {
    expect(gradeOf(score)).toBe(grade);
  });
  it("reconnaît une note", () => {
    expect(isGrade("B")).toBe(true);
    expect(isGrade("F")).toBe(false);
  });
});

describe("loyer de référence", () => {
  it("loyer annuel au taux de référence, avec ou sans premier loyer majoré", () => {
    const plain = referenceAnnualRent({
      amountHt: 1_000_000,
      durationMonths: 60,
      periodicity: "monthly",
      firstRentPct: 0,
      residualPct: 1,
    });
    const withFirst = referenceAnnualRent({
      amountHt: 1_000_000,
      durationMonths: 60,
      periodicity: "quarterly",
      firstRentPct: 10,
      residualPct: 1,
    });
    expect(plain).toBeGreaterThan(240_000);
    expect(plain).toBeLessThan(250_000);
    expect(withFirst).toBeLessThan(plain);
  });
});

describe("correction humaine", () => {
  it("exige une note différente et un motif d'au moins 20 caractères", () => {
    expect(overrideIssues("C", "C", "court")).toEqual(["same_grade", "reason_too_short"]);
    expect(overrideIssues("C", "B", "Caution personnelle du dirigeant fournie")).toEqual([]);
  });
  it("la dernière correction l'emporte", () => {
    expect(effectiveGrade("C", [])).toBe("C");
    expect(
      effectiveGrade("C", [
        { grade: "B", createdAt: new Date("2026-10-01") },
        { grade: "D", createdAt: new Date("2026-10-02") },
      ]),
    ).toBe("D");
  });
});

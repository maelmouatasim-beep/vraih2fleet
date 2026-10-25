import { priceLease } from "../finance/pricing";
import { periodsPerYear, type Periodicity } from "../finance/periodicity";
import { ageInMonths, type BusinessSector } from "../kyc/company";
import type { FiscalYearFigures } from "../kyc/extraction";
import type { EquipmentCategory, EquipmentCondition } from "../requests/requests";

/**
 * Indice d'orientation v1 : grille explicable, pas de boîte noire. Chaque
 * facteur donne un sous-score de 0 à 100 à partir d'un ratio lisible ; le
 * score est leur moyenne pondérée ; la note A–E en découle. Seuils et poids
 * sont des HYPOTHÈSES de la version 1.0.0, à calibrer avec les bailleurs
 * (docs/scoring.md). L'indice oriente le dossier : la décision de crédit
 * appartient exclusivement au bailleur.
 */
export const SCORING_MODEL_VERSION = "1.0.0";

export const GRADES = ["A", "B", "C", "D", "E"] as const;
export type Grade = (typeof GRADES)[number];

export const FACTORS = [
  "coverage",
  "leverage",
  "profitability",
  "liquidity",
  "exposure",
  "seniority",
  "sector",
  "asset",
] as const;
export type Factor = (typeof FACTORS)[number];

/** Facteurs qui exigent des états financiers. */
const FINANCIAL_FACTORS: ReadonlySet<Factor> = new Set([
  "coverage",
  "leverage",
  "profitability",
  "liquidity",
  "exposure",
]);

export const FACTOR_WEIGHTS: Readonly<Record<Factor, number>> = {
  coverage: 30,
  leverage: 15,
  profitability: 10,
  liquidity: 10,
  exposure: 5,
  seniority: 10,
  sector: 10,
  asset: 10,
};

/** Seuils minimaux du score pour chaque note. */
export const GRADE_THRESHOLDS: Readonly<Record<Exclude<Grade, "E">, number>> = {
  A: 80,
  B: 65,
  C: 50,
  D: 35,
};

/** Taux de référence pour estimer le loyer annuel (hypothèse, hors offre réelle). */
export const SCORING_REFERENCE_RATE = 0.08;

export const SECTOR_RISK: Readonly<Record<BusinessSector, "low" | "medium" | "high">> = {
  transport: "medium",
  construction: "high",
  health: "low",
  industry: "medium",
  agriculture: "high",
  trade: "medium",
  services: "medium",
  tech: "medium",
  tourism: "high",
  other: "medium",
};

/** Liquidité de l'actif sur le marché de l'occasion (valeur de revente). */
export const ASSET_RESALE: Readonly<Record<EquipmentCategory, "high" | "medium" | "low">> = {
  light_vehicle: "high",
  truck: "high",
  trailer: "high",
  construction_machine: "high",
  agricultural: "medium",
  industrial_machine: "medium",
  medical: "medium",
  it: "low",
  other: "low",
};

export const FLAG_CODES = [
  "negative_equity",
  "negative_caf",
  "coverage_below_one",
  "consistency_failures",
  "no_financial_statements",
  "net_loss",
  "low_cash",
  "high_exposure",
  "young_company",
  "revenue_decline",
  "old_used_asset",
  "stale_financials",
] as const;
export type FlagCode = (typeof FLAG_CODES)[number];
export type FlagSeverity = "severe" | "warning";

/** Drapeaux qui plafonnent la note à D, quel que soit le score. */
const SEVERE_FLAGS: ReadonlySet<FlagCode> = new Set([
  "negative_equity",
  "negative_caf",
  "coverage_below_one",
  "consistency_failures",
]);

export interface Flag {
  code: FlagCode;
  severity: FlagSeverity;
  value: number | null;
}

export interface ScoringInput {
  now: Date;
  incorporationDate: Date | null;
  sector: BusinessSector;
  equipmentCategory: EquipmentCategory;
  condition: EquipmentCondition;
  equipmentYear: number | null;
  amountHt: number;
  annualRentHt: number;
  fiscalYears: readonly FiscalYearFigures[];
  /** Contrôles de cohérence en échec. */
  consistencyFailures: number;
}

export interface Ratios {
  caf: number | null;
  rentCoverage: number | null;
  debtToEquity: number | null;
  netMargin: number | null;
  cashMonthsOfRent: number | null;
  exposure: number | null;
  revenueGrowth: number | null;
  ageMonths: number | null;
  latestFiscalYear: number | null;
}

export type FactorLevel = "strong" | "adequate" | "weak" | "missing";

export interface FactorScore {
  factor: Factor;
  weight: number;
  /** null : facteur non évaluable (pas d'états financiers). */
  score: number | null;
  level: FactorLevel;
  value: number | string | null;
}

export interface Assessment {
  modelVersion: string;
  ratios: Ratios;
  factors: FactorScore[];
  score: number;
  grade: Grade;
  /** Note avant plafonds (drapeaux graves, absence d'états financiers). */
  uncappedGrade: Grade;
  flags: Flag[];
}

/** Paliers « valeur ≥ seuil → points », du meilleur au moins bon. */
function stepDown(value: number, steps: readonly (readonly [number, number])[], floor: number) {
  for (const [threshold, points] of steps) if (value >= threshold) return points;
  return floor;
}

/** Paliers « valeur ≤ seuil → points », du meilleur au moins bon. */
function stepUp(value: number, steps: readonly (readonly [number, number])[], floor: number) {
  for (const [threshold, points] of steps) if (value <= threshold) return points;
  return floor;
}

export function gradeOf(score: number): Grade {
  for (const g of ["A", "B", "C", "D"] as const) if (score >= GRADE_THRESHOLDS[g]) return g;
  return "E";
}

const worse = (a: Grade, b: Grade): Grade => (GRADES.indexOf(a) >= GRADES.indexOf(b) ? a : b);

function levelOf(score: number | null): FactorLevel {
  if (score === null) return "missing";
  return score >= 75 ? "strong" : score >= 45 ? "adequate" : "weak";
}

const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

/** Loyer annuel HT estimé au taux de référence, pour les ratios de couverture. */
export function referenceAnnualRent(input: {
  amountHt: number;
  durationMonths: number;
  periodicity: Periodicity;
  firstRentPct: number;
  residualPct: number;
}): number {
  const pricing = priceLease({
    financedAmountHt: input.amountHt,
    durationMonths: input.durationMonths,
    periodicity: input.periodicity,
    timing: "advance",
    annualRate: SCORING_REFERENCE_RATE,
    firstRentHt: input.firstRentPct > 0 ? (input.amountHt * input.firstRentPct) / 100 : undefined,
    residualValueHt: (input.amountHt * input.residualPct) / 100,
  });
  return pricing.rentHt * periodsPerYear(input.periodicity);
}

export function computeRatios(input: ScoringInput): Ratios {
  const years = [...input.fiscalYears].sort((a, b) => b.year - a.year);
  const latest = years[0];
  const previous = years[1];
  const ageMonths =
    input.incorporationDate === null ? null : ageInMonths(input.incorporationDate, input.now);
  if (latest === undefined) {
    return {
      caf: null,
      rentCoverage: null,
      debtToEquity: null,
      netMargin: null,
      cashMonthsOfRent: null,
      exposure: null,
      revenueGrowth: null,
      ageMonths,
      latestFiscalYear: null,
    };
  }
  const caf = latest.netIncome + latest.depreciation;
  return {
    caf,
    rentCoverage: ratio(caf, input.annualRentHt),
    debtToEquity: latest.equity <= 0 ? null : latest.financialDebt / latest.equity,
    netMargin: ratio(latest.netIncome, latest.revenue),
    cashMonthsOfRent: ratio(latest.cash, input.annualRentHt / 12),
    exposure: ratio(input.amountHt, latest.revenue),
    revenueGrowth:
      previous === undefined ? null : ratio(latest.revenue - previous.revenue, previous.revenue),
    ageMonths,
    latestFiscalYear: latest.year,
  };
}

function factorScores(input: ScoringInput, r: Ratios, hasFinancials: boolean) {
  const latest = [...input.fiscalYears].sort((a, b) => b.year - a.year)[0];
  const negativeEquity = latest !== undefined && latest.equity <= 0;
  const usedPenalty =
    input.condition === "used"
      ? input.equipmentYear !== null && input.now.getUTCFullYear() - input.equipmentYear > 10
        ? 30
        : 10
      : 0;
  const raw: Record<Factor, [number | null, number | string | null]> = {
    coverage: [
      r.rentCoverage === null
        ? null
        : stepDown(
            r.rentCoverage,
            [
              [2, 100],
              [1.5, 80],
              [1.2, 60],
              [1, 40],
              [0.7, 20],
            ],
            0,
          ),
      r.rentCoverage,
    ],
    leverage: [
      negativeEquity
        ? 0
        : r.debtToEquity === null
          ? null
          : stepUp(
              r.debtToEquity,
              [
                [0.5, 100],
                [1, 80],
                [2, 60],
                [3, 35],
              ],
              10,
            ),
      r.debtToEquity,
    ],
    profitability: [
      r.netMargin === null
        ? null
        : stepDown(
            r.netMargin,
            [
              [0.1, 100],
              [0.05, 80],
              [0.02, 60],
              [0, 40],
            ],
            10,
          ),
      r.netMargin,
    ],
    liquidity: [
      r.cashMonthsOfRent === null
        ? null
        : stepDown(
            r.cashMonthsOfRent,
            [
              [6, 100],
              [3, 75],
              [1, 50],
            ],
            20,
          ),
      r.cashMonthsOfRent,
    ],
    exposure: [
      r.exposure === null
        ? null
        : stepUp(
            r.exposure,
            [
              [0.1, 100],
              [0.25, 75],
              [0.5, 45],
            ],
            15,
          ),
      r.exposure,
    ],
    seniority: [
      r.ageMonths === null
        ? 15
        : stepDown(
            r.ageMonths,
            [
              [120, 100],
              [60, 80],
              [36, 60],
              [24, 45],
              [12, 30],
            ],
            15,
          ),
      r.ageMonths,
    ],
    sector: [
      { low: 90, medium: 65, high: 40 }[SECTOR_RISK[input.sector]],
      SECTOR_RISK[input.sector],
    ],
    asset: [
      Math.max(
        0,
        { high: 90, medium: 65, low: 35 }[ASSET_RESALE[input.equipmentCategory]] - usedPenalty,
      ),
      ASSET_RESALE[input.equipmentCategory],
    ],
  };
  return FACTORS.map((factor): FactorScore => {
    const [score, value] = raw[factor];
    const usable = FINANCIAL_FACTORS.has(factor) && !hasFinancials ? null : score;
    return { factor, weight: FACTOR_WEIGHTS[factor], score: usable, level: levelOf(usable), value };
  });
}

function flagsOf(input: ScoringInput, r: Ratios): Flag[] {
  const latest = [...input.fiscalYears].sort((a, b) => b.year - a.year)[0];
  const raw: [FlagCode, boolean, number | null][] = [
    ["negative_equity", latest !== undefined && latest.equity <= 0, latest?.equity ?? null],
    ["negative_caf", r.caf !== null && r.caf < 0, r.caf],
    [
      "coverage_below_one",
      r.rentCoverage !== null && r.caf !== null && r.caf >= 0 && r.rentCoverage < 1,
      r.rentCoverage,
    ],
    ["consistency_failures", input.consistencyFailures > 0, input.consistencyFailures],
    ["no_financial_statements", latest === undefined, null],
    ["net_loss", latest !== undefined && latest.netIncome < 0, latest?.netIncome ?? null],
    ["low_cash", r.cashMonthsOfRent !== null && r.cashMonthsOfRent < 1, r.cashMonthsOfRent],
    ["high_exposure", r.exposure !== null && r.exposure > 0.5, r.exposure],
    ["young_company", r.ageMonths !== null && r.ageMonths < 24, r.ageMonths],
    ["revenue_decline", r.revenueGrowth !== null && r.revenueGrowth < -0.2, r.revenueGrowth],
    [
      "old_used_asset",
      input.condition === "used" &&
        input.equipmentYear !== null &&
        input.now.getUTCFullYear() - input.equipmentYear > 10,
      input.equipmentYear,
    ],
    [
      "stale_financials",
      r.latestFiscalYear !== null && r.latestFiscalYear < input.now.getUTCFullYear() - 2,
      r.latestFiscalYear,
    ],
  ];
  return raw
    .filter(([, on]) => on)
    .map(([code, , value]) => ({
      code,
      severity: SEVERE_FLAGS.has(code) ? "severe" : "warning",
      value,
    }));
}

export function assess(input: ScoringInput): Assessment {
  const ratios = computeRatios(input);
  const hasFinancials = ratios.latestFiscalYear !== null;
  const factors = factorScores(input, ratios, hasFinancials);
  let total = 0;
  let weights = 0;
  for (const f of factors) {
    if (f.score === null) continue;
    total += f.score * f.weight;
    weights += f.weight;
  }
  const score = Math.round((total / weights) * 100) / 100;
  const uncappedGrade = gradeOf(score);
  const flags = flagsOf(input, ratios);
  let grade = uncappedGrade;
  // Sans états financiers, l'indice ne dépasse pas C ; un drapeau grave le plafonne à D.
  if (!hasFinancials) grade = worse(grade, "C");
  if (flags.some((f) => f.severity === "severe")) grade = worse(grade, "D");
  return {
    modelVersion: SCORING_MODEL_VERSION,
    ratios,
    factors,
    score,
    grade,
    uncappedGrade,
    flags,
  };
}

// ── Correction humaine motivée ─────────────────────────────────────────────

export const MIN_OVERRIDE_REASON = 20;

export type OverrideIssue = "same_grade" | "reason_too_short";

export function overrideIssues(computed: Grade, grade: Grade, reason: string): OverrideIssue[] {
  const issues: OverrideIssue[] = [];
  if (grade === computed) issues.push("same_grade");
  if (reason.trim().length < MIN_OVERRIDE_REASON) issues.push("reason_too_short");
  return issues;
}

/** Note retenue : la dernière correction humaine, sinon la note calculée. */
export function effectiveGrade(
  computed: Grade,
  overrides: readonly { grade: Grade; createdAt: Date }[],
): Grade {
  const latest = [...overrides].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return latest?.grade ?? computed;
}

export function isGrade(value: unknown): value is Grade {
  return typeof value === "string" && (GRADES as readonly string[]).includes(value);
}

import {
  ageInMonths,
  latestFiscalYears,
  type Assessment,
  type ConsistencyCheck,
  type DocumentExtraction,
  type Grade,
} from "@leaseplace/domain";

/**
 * Faits transmis au modèle pour la note de synthèse : uniquement des
 * sorties du moteur et des extractions vérifiées, sans aucun nom de
 * personne (pseudonymisation : les dirigeants n'y figurent pas).
 */
export interface MemoFactsInput {
  now: Date;
  company: {
    legalName: string;
    legalForm: string;
    sector: string;
    city: string;
    incorporationDate: Date | null;
    revenueBand: string | null;
    headcountBand: string | null;
  };
  request: {
    equipmentCategory: string | null;
    condition: string | null;
    equipmentYear: number | null;
    description: string | null;
    supplierName: string | null;
    amountHt: number | null;
    durationMonths: number | null;
    firstRentPct: number | null;
    residualPct: number | null;
    periodicity: string | null;
    referenceAnnualRentHt: number | null;
  };
  assessment: Assessment;
  effectiveGrade: Grade;
  checks: readonly ConsistencyCheck[];
  documents: readonly DocumentExtraction[];
}

export interface MemoFacts {
  PROFILE: {
    legalName: string;
    legalForm: string;
    sector: string;
    city: string;
    ageYears: number | null;
    revenueBand: string | null;
    headcountBand: string | null;
  };
  REQUEST: MemoFactsInput["request"];
  SCORE: {
    modelVersion: string;
    grade: Grade;
    computedGrade: Grade;
    score: number;
    factors: { factor: string; level: string; value: number | string | null }[];
    flags: { code: string; severity: string; value: number | null }[];
    ratios: Assessment["ratios"];
  };
  CHECKS: { code: string; status: string }[];
  FINANCIALS: {
    year: number;
    revenue: number;
    netIncome: number;
    caf: number;
    equity: number;
    financialDebt: number;
    cash: number;
  }[];
  DOCUMENTS: { id: string; type: string; issuedOn: string | null }[];
}

export interface BuiltFacts {
  facts: MemoFacts;
  /** Identifiant court (D1, D2…) → identifiant du document en base. */
  documentIds: Record<string, string>;
  sourceIds: string[];
}

const round = (v: number, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

export function buildMemoFacts(input: MemoFactsInput): BuiltFacts {
  const documentIds: Record<string, string> = {};
  const docs = input.documents.map((d, i) => {
    const id = `D${String(i + 1)}`;
    documentIds[id] = d.documentId;
    return { id, type: d.type, issuedOn: d.fields.issuedOn };
  });
  const r = input.assessment.ratios;
  const facts: MemoFacts = {
    PROFILE: {
      legalName: input.company.legalName,
      legalForm: input.company.legalForm,
      sector: input.company.sector,
      city: input.company.city,
      ageYears:
        input.company.incorporationDate === null
          ? null
          : Math.floor(ageInMonths(input.company.incorporationDate, input.now) / 12),
      revenueBand: input.company.revenueBand,
      headcountBand: input.company.headcountBand,
    },
    REQUEST: input.request,
    SCORE: {
      modelVersion: input.assessment.modelVersion,
      grade: input.effectiveGrade,
      computedGrade: input.assessment.grade,
      score: input.assessment.score,
      factors: input.assessment.factors.map((f) => ({
        factor: f.factor,
        level: f.level,
        value: typeof f.value === "number" ? round(f.value) : f.value,
      })),
      flags: input.assessment.flags.map((f) => ({
        code: f.code,
        severity: f.severity,
        value: f.value === null ? null : round(f.value),
      })),
      ratios: {
        caf: r.caf,
        rentCoverage: r.rentCoverage === null ? null : round(r.rentCoverage),
        debtToEquity: r.debtToEquity === null ? null : round(r.debtToEquity),
        netMargin: r.netMargin === null ? null : round(r.netMargin),
        cashMonthsOfRent: r.cashMonthsOfRent === null ? null : round(r.cashMonthsOfRent),
        exposure: r.exposure === null ? null : round(r.exposure),
        revenueGrowth: r.revenueGrowth === null ? null : round(r.revenueGrowth),
        ageMonths: r.ageMonths,
        latestFiscalYear: r.latestFiscalYear,
      },
    },
    CHECKS: input.checks.map((c) => ({ code: c.code, status: c.status })),
    FINANCIALS: latestFiscalYears(input.documents).map((y) => ({
      year: y.year,
      revenue: y.revenue,
      netIncome: y.netIncome,
      caf: y.netIncome + y.depreciation,
      equity: y.equity,
      financialDebt: y.financialDebt,
      cash: y.cash,
    })),
    DOCUMENTS: docs,
  };
  return {
    facts,
    documentIds,
    sourceIds: ["PROFILE", "REQUEST", "SCORE", "CHECKS", "FINANCIALS", ...docs.map((d) => d.id)],
  };
}

import { describe, expect, it } from "vitest";
import {
  checkCounts,
  consistencyChecks,
  normalizeName,
  samePerson,
  type ConsistencyCheck,
  type ConsistencyInput,
} from "./consistency";
import {
  EMPTY_FIELDS,
  latestFiscalYears,
  type DocumentExtraction,
  type ExtractedFields,
} from "./extraction";

const now = new Date("2026-10-25T00:00:00Z");
const fy = (year: number, revenue: number) => ({
  year,
  revenue,
  netIncome: 1,
  depreciation: 1,
  equity: 1,
  financialDebt: 1,
  cash: 1,
});

function doc(
  documentId: string,
  type: DocumentExtraction["type"],
  fields: Partial<ExtractedFields>,
): DocumentExtraction {
  return { documentId, type, fields: { ...EMPTY_FIELDS, ...fields } };
}

const base: ConsistencyInput = {
  now,
  company: {
    ice: "001234567000089",
    legalName: "Atlas Transports Logistique SARL",
    rcNumber: "123456",
    revenueBand: "10m_50m",
  },
  request: { amountHt: 850_000 },
  extractions: [
    doc("rc", "rc_extract", {
      ice: "001 234 567 000 089",
      rcNumber: "123 456",
      legalName: "ATLAS TRANSPORTS LOGISTIQUE S.A.R.L.",
      directors: ["Salma Benali"],
      issuedOn: "2026-09-01",
    }),
    doc("ice", "ice_certificate", { ice: "001234567000089", legalName: "Atlas Transports" }),
    doc("cin", "director_id", { holderName: "BENALI Salma", expiresOn: "2030-01-01" }),
    doc("bilans", "tax_returns", { fiscalYears: [fy(2024, 18_000_000), fy(2025, 21_000_000)] }),
    doc("devis", "quote", { quoteAmountHt: 850_000 }),
  ],
  failedDocumentIds: [],
};

const byCode = (checks: ConsistencyCheck[]) => new Map(checks.map((c) => [c.code, c]));

describe("noms", () => {
  it("normalise accents, ponctuation et forme juridique", () => {
    expect(normalizeName("Société Atlas-Trans S.A.R.L.")).toBe("atlas trans");
  });
  it("reconnaît une personne quel que soit l'ordre des mots", () => {
    expect(samePerson("BENALI Salma", "Salma Benali")).toBe(true);
    expect(samePerson("Salma Benali", "Youssef Alaoui")).toBe(false);
    expect(samePerson("Benali", "Salma Benali")).toBe(true);
  });
});

describe("contrôles de cohérence", () => {
  it("dossier cohérent : tout passe", () => {
    const checks = consistencyChecks(base);
    expect(checks.filter((c) => c.status !== "pass")).toEqual([]);
    expect(checkCounts(checks)).toEqual({ pass: 10, warn: 0, fail: 0, not_applicable: 0 });
  });

  it("ICE différent dans un document : échec, document désigné", () => {
    const checks = byCode(
      consistencyChecks({
        ...base,
        extractions: [
          ...base.extractions,
          doc("autre", "tax_certificate", { ice: "009999999000001" }),
        ],
      }),
    );
    expect(checks.get("ice_match")).toMatchObject({ status: "fail", documentIds: ["autre"] });
  });

  it("RC non déclaré : les documents doivent concorder entre eux", () => {
    const company = { ...base.company, rcNumber: null };
    const agree = byCode(consistencyChecks({ ...base, company }));
    expect(agree.get("rc_match")?.status).toBe("pass");
    const disagree = byCode(
      consistencyChecks({
        ...base,
        company,
        extractions: [...base.extractions, doc("pv", "appointment_minutes", { rcNumber: "999" })],
      }),
    );
    expect(disagree.get("rc_match")?.status).toBe("fail");
  });

  it("raison sociale différente : signalée sans bloquer", () => {
    const checks = byCode(
      consistencyChecks({
        ...base,
        extractions: [doc("x", "articles", { legalName: "Sahara Négoce SARL" })],
      }),
    );
    expect(checks.get("legal_name_match")).toMatchObject({ status: "warn", documentIds: ["x"] });
  });

  it("titulaire de la CIN absent des dirigeants : signalé", () => {
    const checks = byCode(
      consistencyChecks({
        ...base,
        extractions: [
          doc("rc", "rc_extract", { directors: ["Youssef Alaoui"] }),
          doc("cin", "director_id", { holderName: "Salma Benali", expiresOn: "2030-01-01" }),
        ],
      }),
    );
    expect(checks.get("director_match")?.status).toBe("warn");
  });

  it("CIN expirée : échec ; date illisible : signalée", () => {
    const expired = byCode(
      consistencyChecks({
        ...base,
        extractions: [doc("cin", "director_id", { holderName: "S B", expiresOn: "2025-01-01" })],
      }),
    );
    expect(expired.get("id_document_valid")).toMatchObject({
      status: "fail",
      found: ["2025-01-01"],
    });
    const unknown = byCode(
      consistencyChecks({
        ...base,
        extractions: [doc("cin", "director_id", { holderName: "S B" })],
      }),
    );
    expect(unknown.get("id_document_valid")?.status).toBe("warn");
  });

  it("date de délivrance trop ancienne lue dans le document : signalée", () => {
    const checks = byCode(
      consistencyChecks({
        ...base,
        extractions: [doc("rc", "rc_extract", { issuedOn: "2026-01-10" })],
      }),
    );
    expect(checks.get("documents_fresh")).toMatchObject({ status: "warn", documentIds: ["rc"] });
  });

  it("chiffre d'affaires hors tranche, exercices anciens : signalés", () => {
    const checks = byCode(
      consistencyChecks({
        ...base,
        extractions: [doc("b", "tax_returns", { fiscalYears: [fy(2022, 2_000_000)] })],
      }),
    );
    expect(checks.get("revenue_band_match")).toMatchObject({ status: "warn", found: [2_000_000] });
    expect(checks.get("financials_recent")).toMatchObject({ status: "warn", found: [2022] });
  });

  it("tranche non déclarée : contrôle sans objet", () => {
    const checks = byCode(
      consistencyChecks({ ...base, company: { ...base.company, revenueBand: null } }),
    );
    expect(checks.get("revenue_band_match")?.status).toBe("not_applicable");
  });

  it("devis : 1 % passe, 10 % signalé, au-delà échec", () => {
    const at = (quoteAmountHt: number) =>
      byCode(
        consistencyChecks({ ...base, extractions: [doc("d", "quote", { quoteAmountHt })] }),
      ).get("quote_amount_match")?.status;
    expect(at(855_000)).toBe("pass");
    expect(at(900_000)).toBe("warn");
    expect(at(1_200_000)).toBe("fail");
  });

  it("sans montant demandé, sans documents : contrôles sans objet ; extraction ratée signalée", () => {
    const checks = consistencyChecks({
      ...base,
      request: { amountHt: null },
      extractions: [doc("vide", "other", { ice: " " })],
      failedDocumentIds: ["illisible"],
    });
    const m = byCode(checks);
    for (const code of [
      "ice_match",
      "rc_match",
      "legal_name_match",
      "director_match",
      "id_document_valid",
      "documents_fresh",
      "revenue_band_match",
      "financials_recent",
      "quote_amount_match",
    ] as const) {
      expect(m.get(code)?.status, code).toBe("not_applicable");
    }
    expect(m.get("extraction_complete")).toMatchObject({
      status: "warn",
      documentIds: ["illisible"],
    });
  });
});

describe("exercices", () => {
  it("le plus récent d'abord, un exercice par année", () => {
    const years = latestFiscalYears([
      doc("a", "tax_returns", { fiscalYears: [fy(2023, 1), fy(2024, 2)] }),
      doc("b", "tax_returns", { fiscalYears: [fy(2024, 3)] }),
    ]);
    expect(years.map((y) => [y.year, y.revenue])).toEqual([
      [2024, 3],
      [2023, 1],
    ]);
  });
});

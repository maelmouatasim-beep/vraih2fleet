import { describe, expect, it } from "vitest";
import { demoFacts } from "./fixtures.test-helpers";
import { mockMemo } from "./mock";
import type { ExtractionOutput, MemoOutput } from "./schemas";
import { allowedNumbers, normalizeExtraction, numbersInText, verifyMemo } from "./verify";

const raw: ExtractionOutput = {
  readable: true,
  matchesDeclaredType: true,
  fields: {
    legalName: "  Atlas  ",
    ice: "000 123 456 000 078",
    rcNumber: "",
    rcCourt: null,
    taxId: null,
    cnssNumber: null,
    legalForm: null,
    directors: [" Salma Benali ", " "],
    holderName: null,
    issuedOn: "02/09/2026",
    expiresOn: "2030-02-30",
    fiscalYears: [
      {
        year: 2025,
        revenue: 1,
        netIncome: 1,
        depreciation: 1,
        equity: 1,
        financialDebt: 1,
        cash: 1,
      },
      {
        year: 1890,
        revenue: 1,
        netIncome: 1,
        depreciation: 1,
        equity: 1,
        financialDebt: 1,
        cash: 1,
      },
      {
        year: 2024,
        revenue: Number.NaN,
        netIncome: 1,
        depreciation: 1,
        equity: 1,
        financialDebt: 1,
        cash: 1,
      },
    ],
    averageMonthlyBalance: Number.POSITIVE_INFINITY,
    paymentIncidents: 0,
    quoteAmountHt: null,
    supplierName: null,
  },
  sources: [{ field: "ice", page: 1, excerpt: "x".repeat(300) }],
  warnings: [],
};

describe("normalisation de l'extraction", () => {
  it("nettoie, écarte les valeurs mal formées et le signale", () => {
    const n = normalizeExtraction(raw);
    expect(n.fields.legalName).toBe("Atlas");
    expect(n.fields.ice).toBe("000123456000078");
    expect(n.fields.rcNumber).toBeNull();
    expect(n.fields.directors).toEqual(["Salma Benali"]);
    expect(n.fields.issuedOn).toBeNull();
    expect(n.fields.expiresOn).toBeNull();
    expect(n.fields.fiscalYears.map((y) => y.year)).toEqual([2025]);
    expect(n.fields.averageMonthlyBalance).toBeNull();
    expect(n.fields.paymentIncidents).toBe(0);
    expect(n.warnings).toHaveLength(2);
    expect(n.sources[0]?.excerpt).toHaveLength(200);
  });
  it("ICE sans chiffre : absent", () => {
    const n = normalizeExtraction({
      ...raw,
      fields: { ...raw.fields, ice: "n/a", issuedOn: "2026-09-02" },
    });
    expect(n.fields.ice).toBeNull();
    expect(n.fields.issuedOn).toBe("2026-09-02");
  });
});

describe("nombres", () => {
  it("lit les écritures françaises", () => {
    expect(numbersInText("1 250 000 DH, 1\u202f250\u202f000,50 DH, 8,5 % et 2024")).toEqual([
      1_250_000, 1_250_000.5, 8.5, 2024,
    ]);
  });
});

describe("vérification de la note", () => {
  const { facts, sourceIds } = demoFacts();
  const memo = mockMemo(facts);

  it("la note simulée passe la vérification", () => {
    expect(verifyMemo(memo, facts, sourceIds)).toEqual([]);
  });

  it("admet pourcentages, millions et dates des faits", () => {
    const allowed = allowedNumbers(facts);
    expect(allowed).toContain(1.25);
    expect(allowed).toContain(1000);
    const ok: MemoOutput = {
      sections: memo.sections.map((s) =>
        s.key === "need"
          ? {
              ...s,
              paragraphs: [
                {
                  text: "Montant de 1,25 M DH, devis du 2026-10-05, sur 60 mois.",
                  sources: ["REQUEST"],
                },
              ],
            }
          : s,
      ),
    };
    expect(verifyMemo(ok, facts, sourceIds)).toEqual([]);
  });

  it("admet les chiffres d'un texte des faits (raison sociale, description)", () => {
    const named = {
      ...facts,
      PROFILE: { ...facts.PROFILE, legalName: "Atlas 2000 SARL" },
      REQUEST: { ...facts.REQUEST, description: "Tracteur 4x2, 460 ch" },
    };
    const memoNamed: MemoOutput = {
      sections: mockMemo(named).sections.map((s) =>
        s.key === "presentation"
          ? {
              ...s,
              paragraphs: [
                {
                  text: "Atlas 2000 finance un tracteur de 460 ch.",
                  sources: ["PROFILE", "REQUEST"],
                },
              ],
            }
          : s,
      ),
    };
    expect(verifyMemo(memoNamed, named, sourceIds)).toEqual([]);
  });

  it("rejette un nombre inventé, une source inconnue, un paragraphe sans source ou vide", () => {
    const bad: MemoOutput = {
      sections: [
        ...memo.sections.filter((s) => s.key !== "risks"),
        {
          key: "risks",
          paragraphs: [
            { text: "Taux d'endettement de 437 %.", sources: ["SCORE"] },
            { text: "Garantie bancaire.", sources: ["D99"] },
            { text: "Sans source.", sources: [] },
            { text: "  ", sources: ["SCORE"] },
          ],
        },
      ],
    };
    expect(verifyMemo(bad, facts, sourceIds).map((i) => i.code)).toEqual([
      "unverified_number",
      "unknown_source",
      "no_source",
      "empty_paragraph",
    ]);
  });

  it("sections manquantes ou en double", () => {
    const first = memo.sections[0];
    if (!first) throw new Error("note vide");
    const issues = verifyMemo({ sections: [first, first] }, facts, sourceIds).map((i) => i.code);
    expect(issues.filter((c) => c === "missing_section")).toHaveLength(5);
    expect(issues).toContain("duplicate_section");
  });
});

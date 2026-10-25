import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPES, consistencyChecks } from "@leaseplace/domain";
import { DEMO, NOW, demoExtractions, demoFacts } from "./fixtures.test-helpers";
import { createMockProvider, mockExtraction, mockMemo } from "./mock";
import { verifyMemo } from "./verify";
import { extractionOutputSchema, memoOutputSchema } from "./schemas";

const request = (type: (typeof DOCUMENT_TYPES)[number], fileName = "piece.pdf") => ({
  type,
  mimeType: "application/pdf" as const,
  bytes: new Uint8Array(),
  fileName,
  demo: DEMO,
});

describe("simulateur de démonstration", () => {
  it.each(DOCUMENT_TYPES)("%s : sortie conforme au schéma, chaque valeur sourcée", (type) => {
    const out = mockExtraction(request(type));
    expect(extractionOutputSchema.safeParse(out).success).toBe(true);
    const filled = Object.entries(out.fields).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v !== null,
    );
    expect(out.sources.map((s) => s.field).sort()).toEqual(filled.map(([k]) => k).sort());
  });

  it("dossier simulé cohérent : aucun contrôle en échec", () => {
    const checks = consistencyChecks({
      now: NOW,
      company: { ice: DEMO.ice, legalName: DEMO.legalName, rcNumber: null, revenueBand: "10m_50m" },
      request: { amountHt: 1_250_000 },
      extractions: demoExtractions(),
      failedDocumentIds: [],
    });
    expect(checks.filter((c) => c.status === "fail" || c.status === "warn")).toEqual([]);
  });

  it("marqueurs d'anomalie dans le nom du fichier", () => {
    expect(mockExtraction(request("rc_extract", "rc-autre-ice.pdf")).fields.ice).not.toBe(DEMO.ice);
    const id = mockExtraction(request("director_id", "cin-expiree.pdf")).fields.expiresOn ?? "";
    expect(id < "2026-10-25").toBe(true);
    expect(mockExtraction(request("articles", "statuts-illisible.pdf")).readable).toBe(false);
    expect(mockExtraction(request("articles", "instruction.pdf")).warnings).toHaveLength(1);
  });

  it("sans RC ni tranche ni fournisseur : valeurs par défaut", () => {
    const ctx = {
      ...DEMO,
      ice: "000000000000000",
      revenueBand: null,
      supplierName: null,
      rcNumber: null,
    };
    const rc = mockExtraction({ ...request("rc_extract"), demo: ctx });
    expect(rc.fields.rcNumber).toBe("104233");
    const tr = mockExtraction({ ...request("tax_returns"), demo: ctx });
    expect(tr.fields.fiscalYears[1]?.revenue).toBe(6_500_000);
    expect(mockExtraction({ ...request("quote"), demo: ctx }).fields.supplierName).toContain(
      "simulation",
    );
    expect(
      mockExtraction({ ...request("rc_extract"), demo: { ...DEMO, rcNumber: "RC 9" } }).fields
        .rcNumber,
    ).toBe("RC 9");
  });

  it("note simulée : six sections, vérifiable", async () => {
    const { facts, sourceIds } = demoFacts();
    const provider = createMockProvider();
    expect(provider.real).toBe(false);
    const { output, meta } = await provider.writeMemo(facts);
    expect(memoOutputSchema.safeParse(output).success).toBe(true);
    expect(meta).toMatchObject({ provider: "mock", promptVersion: "memo-v1" });
    expect(verifyMemo(output, facts, sourceIds)).toEqual([]);
    const extraction = await provider.extract(request("ice_certificate"));
    expect(extraction.meta.promptVersion).toBe("extraction-v1");
  });

  it("note simulée sans exercices, sans drapeaux ni anomalies ni pièces", () => {
    const { facts, sourceIds } = demoFacts();
    const bare = {
      ...facts,
      PROFILE: { ...facts.PROFILE, ageYears: null },
      REQUEST: {
        ...facts.REQUEST,
        amountHt: null,
        durationMonths: null,
        equipmentCategory: null,
        condition: null,
      },
      SCORE: {
        ...facts.SCORE,
        flags: [],
        factors: [],
        ratios: { ...facts.SCORE.ratios, rentCoverage: null, netMargin: null },
      },
      FINANCIALS: [],
      DOCUMENTS: [],
      CHECKS: [{ code: "ice_match", status: "fail" }],
    };
    const memo = mockMemo(bare);
    expect(verifyMemo(memo, bare, sourceIds)).toEqual([]);
    const text = memo.sections.flatMap((s) => s.paragraphs.map((p) => p.text)).join(" ");
    expect(text).toContain("prévisionnel");
    expect(text).toContain("ICE identique dans les pièces (en échec)");
    const withFlags = mockMemo({
      ...facts,
      SCORE: { ...facts.SCORE, flags: [{ code: "net_loss", severity: "warning", value: -1 }] },
    });
    expect(withFlags.sections.find((s) => s.key === "risks")?.paragraphs[0]?.text).toContain(
      "perte nette",
    );
  });
});

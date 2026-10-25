import { assess, consistencyChecks, type DocumentExtraction } from "@leaseplace/domain";
import { buildMemoFacts, type BuiltFacts } from "./facts";
import { normalizeExtraction } from "./verify";
import { mockExtraction } from "./mock";
import type { DemoContext } from "./provider";

export const NOW = new Date("2026-10-25T00:00:00Z");

export const DEMO: DemoContext = {
  legalName: "Atlas Transports Logistique SARL",
  ice: "000123456000078",
  rcNumber: null,
  city: "Casablanca",
  revenueBand: "10m_50m",
  directorName: "Salma Benali",
  requestAmountHt: 1_250_000,
  supplierName: "Atlas Engins",
  now: NOW,
};

const TYPES = ["rc_extract", "director_id", "tax_returns", "quote", "bank_statements"] as const;

export function demoExtractions(fileName = "piece.pdf"): DocumentExtraction[] {
  return TYPES.map((type, i) => ({
    documentId: `doc-${String(i)}`,
    type,
    fields: normalizeExtraction(
      mockExtraction({
        type,
        mimeType: "application/pdf",
        bytes: new Uint8Array(),
        fileName,
        demo: DEMO,
      }),
    ).fields,
  }));
}

export function demoFacts(): BuiltFacts {
  const documents = demoExtractions();
  const checks = consistencyChecks({
    now: NOW,
    company: { ice: DEMO.ice, legalName: DEMO.legalName, rcNumber: null, revenueBand: "10m_50m" },
    request: { amountHt: 1_250_000 },
    extractions: documents,
    failedDocumentIds: [],
  });
  const assessment = assess({
    now: NOW,
    incorporationDate: new Date("2015-03-02T00:00:00Z"),
    sector: "transport",
    equipmentCategory: "construction_machine",
    condition: "new",
    equipmentYear: null,
    amountHt: 1_250_000,
    annualRentHt: 300_000,
    fiscalYears: documents.flatMap((d) => d.fields.fiscalYears),
    consistencyFailures: checks.filter((c) => c.status === "fail").length,
  });
  return buildMemoFacts({
    now: NOW,
    company: {
      legalName: DEMO.legalName,
      legalForm: "sarl",
      sector: "transport",
      city: "Casablanca",
      incorporationDate: new Date("2015-03-02T00:00:00Z"),
      revenueBand: "10m_50m",
      headcountBand: "10_49",
    },
    request: {
      equipmentCategory: "construction_machine",
      condition: "new",
      equipmentYear: null,
      description: "Chargeuse sur pneus",
      supplierName: "Atlas Engins",
      amountHt: 1_250_000,
      durationMonths: 60,
      firstRentPct: 10,
      residualPct: 1,
      periodicity: "monthly",
      referenceAnnualRentHt: 300_000,
    },
    assessment,
    effectiveGrade: assessment.grade,
    checks,
    documents,
  });
}

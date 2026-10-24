import { describe, expect, it } from "vitest";
import { ageInMonths, isCorporation, normalizeIce } from "./company";
import {
  completeness,
  isStale,
  requiredDocuments,
  sniffMimeType,
  type VaultDocument,
} from "./documents";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const now = d("2026-10-24");

describe("entreprise", () => {
  it("ICE à 15 chiffres, espaces et tirets tolérés", () => {
    expect(normalizeIce("001 234 567 000 089")).toBe("001234567000089");
    expect(normalizeIce("001-234.567000089")).toBe("001234567000089");
    expect(normalizeIce("12345")).toBeNull();
    expect(normalizeIce("00123456700008A")).toBeNull();
  });
  it("ancienneté en mois révolus", () => {
    expect(ageInMonths(d("2025-10-24"), now)).toBe(12);
    expect(ageInMonths(d("2025-10-25"), now)).toBe(11);
    expect(ageInMonths(d("2027-01-01"), now)).toBe(0);
  });
  it("sociétés vs entreprises en nom propre", () => {
    expect(isCorporation("sarl")).toBe(true);
    expect(isCorporation("ei")).toBe(false);
    expect(isCorporation("auto_entrepreneur")).toBe(false);
  });
});

describe("pièces exigées", () => {
  it("société de plus d'un an : statuts, PV, liasses", () => {
    expect(requiredDocuments("sarl", d("2020-01-01"), now)).toEqual([
      "rc_extract",
      "ice_certificate",
      "director_id",
      "articles",
      "appointment_minutes",
      "tax_returns",
      "bank_statements",
      "tax_certificate",
      "cnss_certificate",
    ]);
  });
  it("jeune société ou date inconnue : prévisionnel au lieu des liasses", () => {
    expect(requiredDocuments("sa", d("2026-06-01"), now)).toContain("business_plan");
    expect(requiredDocuments("sa", null, now)).not.toContain("tax_returns");
  });
  it("entreprise individuelle : ni statuts ni PV", () => {
    const r = requiredDocuments("ei", d("2018-01-01"), now);
    expect(r).not.toContain("articles");
    expect(r).toContain("tax_returns");
  });
  it("auto-entrepreneur : liste allégée", () => {
    expect(requiredDocuments("auto_entrepreneur", null, now)).toEqual([
      "auto_entrepreneur_card",
      "director_id",
      "bank_statements",
    ]);
  });
});

describe("complétude", () => {
  const doc = (
    type: VaultDocument["type"],
    status: VaultDocument["status"] = "clean",
    issuedOn: Date | null = null,
  ): VaultDocument => ({ type, status, issuedOn });
  it("manquante, périmée, valide", () => {
    const c = completeness(
      ["rc_extract", "director_id", "tax_certificate"],
      [
        doc("rc_extract", "clean", d("2026-05-01")),
        doc("director_id", "quarantined"),
        doc("tax_certificate", "clean", d("2026-09-30")),
      ],
      now,
    );
    expect(c.items).toEqual([
      { type: "rc_extract", state: "stale" },
      { type: "director_id", state: "missing" },
      { type: "tax_certificate", state: "ok" },
    ]);
    expect(c.ratio).toBeCloseTo(1 / 3);
    expect(c.complete).toBe(false);
  });
  it("une pièce récente suffit même si une ancienne existe ; liste vide = complète", () => {
    const c = completeness(
      ["rc_extract"],
      [doc("rc_extract", "clean", d("2025-01-01")), doc("rc_extract", "clean", d("2026-10-01"))],
      now,
    );
    expect(c.complete).toBe(true);
    expect(completeness([], [], now)).toEqual({ items: [], ratio: 1, complete: true });
  });
  it("fraîcheur : sans date ou sans règle, jamais périmée", () => {
    expect(isStale({ type: "rc_extract", issuedOn: null }, now)).toBe(false);
    expect(isStale({ type: "articles", issuedOn: d("2000-01-01") }, now)).toBe(false);
  });
});

describe("type de fichier par signature binaire", () => {
  it("PDF, JPEG, PNG ; le reste refusé", () => {
    expect(sniffMimeType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png",
    );
    expect(sniffMimeType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffMimeType(new Uint8Array([]))).toBeNull();
  });
});

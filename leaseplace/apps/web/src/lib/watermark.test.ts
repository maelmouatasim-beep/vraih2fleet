import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfTexts } from "../../e2e/pdf-text";
import { demoPdf, watermark, WatermarkError } from "./watermark";

describe("filigrane de consultation", () => {
  it("chaque page porte le nom du bailleur", async () => {
    const source = await demoPdf("Extrait RC", ["Atlas Transports"]);
    const out = await watermark(
      source,
      "application/pdf",
      "Cèdre Leasing",
      new Date("2026-10-26T10:00:00Z"),
    );
    const pdf = await PDFDocument.load(out);
    expect(pdf.getPageCount()).toBe(1);
    expect(out.length).toBeGreaterThan(source.length);
    const texts = pdfTexts(out);
    expect(texts.filter((t) => t === "Cèdre Leasing · LeasePlace")).toHaveLength(3);
    expect(texts.some((t) => t.startsWith("Consulté par Cèdre Leasing le 2026-10-26 10:00"))).toBe(
      true,
    );
  });

  it("une image devient un PDF filigrané", async () => {
    // PNG 1×1 transparent.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    );
    const out = await watermark(new Uint8Array(png), "image/png", "Argane Bail", new Date());
    expect(Buffer.from(out.subarray(0, 5)).toString()).toBe("%PDF-");
  });

  it("noms non latins translittérés ; document illisible refusé", async () => {
    const source = await demoPdf("Statuts");
    await expect(
      watermark(source, "application/pdf", "مؤجر Bail", new Date()),
    ).resolves.toBeInstanceOf(Uint8Array);
    await expect(
      watermark(new Uint8Array([1, 2, 3]), "application/pdf", "X", new Date()),
    ).rejects.toBeInstanceOf(WatermarkError);
  });
});

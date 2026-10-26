import { describe, expect, it, vi } from "vitest";
import { DEFAULT_COMMISSION_GRID } from "@leaseplace/domain";
import { pdfTexts } from "../../../e2e/pdf-text";

vi.mock("server-only", () => ({}));
const { invoicePdf } = await import("./invoice-pdf");

describe("facture PDF", () => {
  it("numéro, bailleur, demande, totaux HT, TVA et TTC", async () => {
    const bytes = await invoicePdf({
      number: "LP-F-2026-000007",
      issuedOn: new Date("2026-10-26T00:00:00Z"),
      dueOn: new Date("2026-11-25T00:00:00Z"),
      lessorName: "Cèdre Leasing",
      reference: "LP-2026-000003",
      activatedOn: new Date("2026-10-20T00:00:00Z"),
      financedAmountHt: 1_150_000,
      mandateVersion: "MANDAT-2026-01",
      grid: DEFAULT_COMMISSION_GRID,
      amountHt: 14_850,
      vatRate: 0.2,
      vat: 2_970,
      amountTtc: 17_820,
    });
    const text = pdfTexts(bytes).join("\n");
    expect(text).toContain("N° LP-F-2026-000007");
    expect(text).toContain("Cèdre Leasing");
    expect(text).toContain("Demande LP-2026-000003");
    expect(text).toContain("14 850,00 DH");
    expect(text).toContain("17 820,00 DH");
    expect(text).toContain("TVA 20 %");
    expect(text).not.toContain("?");
  });
});

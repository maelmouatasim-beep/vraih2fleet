import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { CommissionGrid } from "@leaseplace/domain";
import { brand } from "../brand";
import { formatDate, formatMad, formatPercent } from "../format";
import { encodable } from "../watermark";

export interface InvoiceDocument {
  number: string;
  issuedOn: Date;
  dueOn: Date;
  lessorName: string;
  reference: string;
  activatedOn: Date;
  financedAmountHt: number;
  mandateVersion: string;
  grid: CommissionGrid;
  amountHt: number;
  vatRate: number;
  vat: number;
  amountTtc: number;
}

/** Police standard : espaces fines et signe moins typographiques remplacés. */
const plain = (text: string) => text.replace(/[\u202f\u00a0]/g, " ").replace(/\u2212/g, "-");

function writer(page: PDFPage, font: PDFFont, bold: PDFFont) {
  return (
    text: string,
    x: number,
    y: number,
    size = 10,
    strong = false,
    color = rgb(0.1, 0.1, 0.1),
  ) => {
    const f = strong ? bold : font;
    page.drawText(encodable(f, plain(text)), { x, y, size, font: f, color });
  };
}

function right(page: PDFPage, font: PDFFont, text: string, xRight: number, y: number, size = 10) {
  const t = encodable(font, plain(text));
  page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, size, font });
}

/** Facture de commission d'intermédiation (A4, français). */
export async function invoicePdf(inv: InvoiceDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Facture ${inv.number}`);
  pdf.setAuthor(brand.name);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = writer(page, font, bold);
  const green = rgb(0.06, 0.29, 0.22);
  const muted = rgb(0.4, 0.4, 0.4);

  w(brand.name, 50, 780, 20, true, green);
  w(brand.legal.entityName, 50, 760, 9, false, muted);
  w(brand.legal.address, 50, 748, 9, false, muted);
  w(
    `ICE ${brand.legal.ice} - RC ${brand.legal.rc} - IF ${brand.legal.taxId}`,
    50,
    736,
    9,
    false,
    muted,
  );

  w("FACTURE", 400, 780, 16, true);
  w(`N° ${inv.number}`, 400, 762, 10, true);
  w(`Date : ${formatDate(inv.issuedOn)}`, 400, 748);
  w(`Échéance : ${formatDate(inv.dueOn)}`, 400, 734);

  w("Facturé à", 50, 690, 9, false, muted);
  w(inv.lessorName, 50, 676, 12, true);

  const top = 620;
  page.drawRectangle({ x: 50, y: top - 6, width: 495, height: 22, color: rgb(0.93, 0.95, 0.94) });
  w("Désignation", 58, top, 10, true);
  right(page, bold, "Montant HT", 537, top);
  w("Commission d'intermédiation en crédit-bail", 58, top - 28, 10, true);
  w(`Demande ${inv.reference} - mise en loyer du ${formatDate(inv.activatedOn)}`, 58, top - 43, 9);
  w(`Montant financé : ${formatMad(inv.financedAmountHt, 2)} HT`, 58, top - 56, 9);
  w(`Grille du mandat ${inv.mandateVersion} (tranches marginales) :`, 58, top - 69, 9);
  let y = top - 82;
  inv.grid.forEach((t, i) => {
    const to = inv.grid[i + 1]?.from;
    const range =
      to === undefined
        ? `au-delà de ${formatMad(t.from, 0)}`
        : `de ${formatMad(t.from, 0)} à ${formatMad(to, 0)}`;
    w(`- ${range} : ${formatPercent(t.rate, 2)}`, 66, y, 8, false, muted);
    y -= 11;
  });
  right(page, font, formatMad(inv.amountHt, 2), 537, top - 28);

  const totals: [string, string][] = [
    ["Total HT", formatMad(inv.amountHt, 2)],
    [`TVA ${formatPercent(inv.vatRate, 0)}`, formatMad(inv.vat, 2)],
    ["Total TTC", formatMad(inv.amountTtc, 2)],
  ];
  y -= 20;
  page.drawLine({
    start: { x: 330, y: y + 14 },
    end: { x: 545, y: y + 14 },
    thickness: 0.5,
    color: muted,
  });
  for (const [k, v] of totals) {
    w(k, 340, y, 10, k === "Total TTC");
    right(page, k === "Total TTC" ? bold : font, v, 537, y);
    y -= 16;
  }

  w("Conditions de paiement : virement à réception, au plus tard à l'échéance.", 50, 150, 9);
  w(`Référence à rappeler : ${inv.number}.`, 50, 137, 9);
  w(
    `${brand.name} est un intermédiaire en opérations de crédit-bail agissant sous mandat écrit des bailleurs (loi 103-12).`,
    50,
    100,
    8,
    false,
    muted,
  );
  w(
    `${brand.name} ne manie aucun fonds de ses clients et ne prend aucune décision de crédit.`,
    50,
    89,
    8,
    false,
    muted,
  );
  return pdf.save();
}

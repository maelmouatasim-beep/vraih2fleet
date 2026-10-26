import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Filigrane de consultation (exigence du cahier des charges) : chaque page
 * porte le nom du bailleur, en diagonale, et une ligne de pied indiquant qui
 * a consulté et quand. Une image est convertie en PDF filigrané. Un document
 * qui ne peut pas être filigrané n'est pas servi.
 */
export class WatermarkError extends Error {
  constructor() {
    super("Document non filigranable");
    this.name = "WatermarkError";
  }
}

/** Police standard (WinAnsi) : accents latins conservés, autres caractères translittérés. */
export function encodable(font: PDFFont, text: string): string {
  const out: string[] = [];
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out.push(ch);
    } catch {
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out.push(/^[\x20-\x7e]+$/.test(base) ? base : "?");
    }
  }
  return out.join("");
}

function stamp(page: PDFPage, font: PDFFont, label: string, footer: string) {
  const { width, height } = page.getSize();
  const size = Math.max(18, Math.min(width, height) / 14);
  const textWidth = font.widthOfTextAtSize(label, size);
  for (const y of [0.3, 0.6, 0.9]) {
    page.drawText(label, {
      x: width / 2 - (textWidth * Math.cos(Math.PI / 6)) / 2,
      y: height * y - (textWidth * Math.sin(Math.PI / 6)) / 2,
      size,
      font,
      color: rgb(0.06, 0.29, 0.22),
      opacity: 0.13,
      rotate: degrees(30),
    });
  }
  page.drawText(footer, { x: 18, y: 12, size: 7, font, color: rgb(0.3, 0.3, 0.3), opacity: 0.85 });
}

export async function watermark(
  bytes: Uint8Array,
  mimeType: string,
  lessorName: string,
  viewedAt: Date,
): Promise<Uint8Array> {
  try {
    let pdf: PDFDocument;
    if (mimeType === "application/pdf") {
      pdf = await PDFDocument.load(bytes);
    } else {
      pdf = await PDFDocument.create();
      const image =
        mimeType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scale = Math.min(1, 595 / image.width, 842 / image.height);
      const page = pdf.addPage([image.width * scale, image.height * scale]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width * scale,
        height: image.height * scale,
      });
    }
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const label = encodable(font, `${lessorName} · LeasePlace`);
    const footer = encodable(
      font,
      `Consulté par ${lessorName} le ${viewedAt.toISOString().slice(0, 16).replace("T", " ")} UTC – usage limité à l’étude du dossier`,
    );
    for (const page of pdf.getPages()) stamp(page, font, label, footer);
    return await pdf.save();
  } catch {
    throw new WatermarkError();
  }
}

/** PDF fictif lisible (démonstration, tests) : une page de texte. */
export async function demoPdf(title: string, lines: readonly string[] = []): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(encodable(font, title), { x: 50, y: 780, size: 16, font });
  lines.forEach((line, i) => {
    page.drawText(encodable(font, line), { x: 50, y: 750 - i * 18, size: 11, font });
  });
  page.drawText(encodable(font, "Document FICTIF de démonstration – LeasePlace"), {
    x: 50,
    y: 60,
    size: 9,
    font,
  });
  return pdf.save();
}

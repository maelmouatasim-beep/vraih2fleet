/**
 * Import intelligent — LECTURE déterministe d'un fichier en tableau brut
 * (cellules texte) : CSV (papaparse), Excel .xlsx (exceljs, feuille la
 * plus remplie, ligne d'entête détectée) et PDF (pdfjs : texte positionné
 * → lignes → colonnes alignées sur l'entête). Aucune IA ici.
 */
import Papa from "papaparse";
import { grilleDepuisPdf, tableauDepuisGrille, type ElementTextePdf, type TableauBrut } from "./smartImport";

function texteCellule(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return texteCellule(o.result);
    if (o.text !== undefined) return texteCellule(o.text);
    return "";
  }
  return String(v);
}

export async function lireTableauBrut(file: File): Promise<TableauBrut> {
  const nom = file.name.toLowerCase();
  if (nom.endsWith(".csv") || nom.endsWith(".txt")) {
    const r = Papa.parse<string[]>(await file.text(), { header: false, skipEmptyLines: true });
    return tableauDepuisGrille(r.data.map((l) => l.map((c) => String(c ?? ""))), "csv");
  }
  if (nom.endsWith(".xlsx")) {
    const ExcelJS = await import("exceljs");
    const classeur = new ExcelJS.Workbook();
    await classeur.xlsx.load(await file.arrayBuffer());
    const feuille = [...classeur.worksheets].sort((a, b) => b.actualRowCount - a.actualRowCount)[0];
    if (!feuille) return { source: "xlsx", entetes: [], lignes: [], lignesNonReconnues: 0 };
    const grille: string[][] = [];
    feuille.eachRow({ includeEmpty: false }, (rangee) => {
      const ligne: string[] = [];
      rangee.eachCell({ includeEmpty: true }, (cellule, col) => {
        ligne[col - 1] = texteCellule(cellule.value).trim();
      });
      grille.push(Array.from(ligne, (c) => c ?? ""));
    });
    return tableauDepuisGrille(grille, "xlsx");
  }
  if (nom.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const elements: ElementTextePdf[] = [];
    for (let p = 1; p <= Math.min(doc.numPages, 50); p++) {
      const page = await doc.getPage(p);
      const contenu = await page.getTextContent();
      for (const item of contenu.items) {
        if (!("str" in item)) continue;
        elements.push({ texte: item.str, x: item.transform[4], y: item.transform[5], largeur: item.width, page: p });
      }
    }
    const { grille, lignesNonReconnues } = grilleDepuisPdf(elements);
    return { ...tableauDepuisGrille(grille, "pdf"), lignesNonReconnues };
  }
  if (nom.endsWith(".xls")) {
    throw new Error("le format .xls (Excel 97-2003) n'est plus pris en charge : enregistrer en .xlsx ou en CSV");
  }
  throw new Error("format non pris en charge (CSV, XLSX ou PDF attendu)");
}

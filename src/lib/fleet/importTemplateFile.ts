/**
 * Fichiers du modèle d'import (Excel 2 feuilles, CSV) — génération côté
 * navigateur (exceljs chargé à la demande). Contenu : ./importTemplate.ts.
 */
import { modeleCsv, modeleImport } from "./importTemplate";

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

export function telechargerModeleCsv(langue: "fr" | "en") {
  // BOM UTF-8 : accents corrects à l'ouverture dans Excel
  telecharger(new Blob(["﻿" + modeleCsv(langue)], { type: "text/csv;charset=utf-8" }), `h2fleet-modele-import-${langue}.csv`);
}

export async function telechargerModeleExcel(langue: "fr" | "en") {
  const m = modeleImport(langue);
  const ExcelJS = await import("exceljs");
  const classeur = new ExcelJS.Workbook();
  const vehicules = classeur.addWorksheet(langue === "en" ? "Vehicles" : "Véhicules");
  vehicules.addRow(m.entetes).font = { bold: true };
  for (const l of m.exemples) vehicules.addRow(l);
  vehicules.columns.forEach((c) => (c.width = 18));
  vehicules.views = [{ state: "frozen", ySplit: 1 }];
  const lisez = classeur.addWorksheet(langue === "en" ? "Read me" : "Lisez-moi");
  for (const l of m.lisezMoi) lisez.addRow(l);
  lisez.getRow(1).font = { bold: true, size: 14 };
  lisez.getRow(5).font = { bold: true };
  lisez.columns = [{ width: 20 }, { width: 12 }, { width: 70 }, { width: 90 }, { width: 18 }];
  lisez.eachRow((r) => r.eachCell((c) => (c.alignment = { wrapText: true, vertical: "top" })));
  const tampon = await classeur.xlsx.writeBuffer();
  telecharger(
    new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `h2fleet-modele-import-${langue}.xlsx`,
  );
}

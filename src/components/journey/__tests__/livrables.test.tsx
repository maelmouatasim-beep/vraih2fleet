/**
 * Phase 5.7 — Les livrables (note au conseil PDF et Word, rapport détaillé
 * PDF) se génèrent hors navigateur, avec la structure attendue d'un
 * livrable de cabinet : recommandation d'abord, pièces numérotées et
 * sourcées, limites, traçabilité ; et sans texte « espacé » illisible
 * (recherche et accessibilité). Texte extrait par pdftotext quand il est
 * disponible (CI : poppler-utils).
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { analyserSensibilite, ENGINE_VERSION } from "@/lib/tco";
import { construireStrategie, type VehiculeProjet } from "@/lib/journey/strategies";
import { brouillonModele, faitsNote, rendreSections } from "@/lib/journey/councilNote";
import { construireNoteDocx } from "@/lib/journey/councilNoteDocx";
import { titreEtCorps } from "@/lib/journey/redaction";
import CouncilNotePDF from "../CouncilNotePDF";
import CouncilReportPDF from "../CouncilReportPDF";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };
const vehicule = (id: string, annee: number): VehiculeProjet => ({
  id,
  category: "camionnette",
  fuel_type: "diesel",
  annual_km: 30000,
  consumption_per_100km: 16,
  consumption_source: "saisie",
  usage_profile: "urbain",
  replacement_year: annee,
  target_technology: "bev",
  depot: "Garage municipal",
});
const strategie = construireStrategie([vehicule("v1", 2027), vehicule("v2", 2028)], "plan_actuel", OPTIONS);
const sensibilite = analyserSensibilite(strategie.plan!);
const retenue = { cle: "plan_actuel" as const, ecarts: 0 };
const faits = faitsNote({
  organisation: "Ville de Rivière-Claire",
  projet: "Transition 2027-2036",
  dateIso: "2026-10-03",
  anneeReference: 2026,
  horizonAns: 10,
  tauxActualisationNominal: 0.05,
  strategie,
  retenue,
  sensibilite,
  hiver: [],
});
const sections = rendreSections(brouillonModele(faits, "fr"), faits, "fr");
const meta = {
  organisation: "Ville de Rivière-Claire",
  projet: "Transition 2027-2036",
  dateIso: "2026-10-03",
  strategie: "Plan actuel",
  snapshotDate: "2026-10-03",
  moteur: ENGINE_VERSION,
  empreinte: strategie.resultat!.empreinteEntree,
};

function texteDuPdf(buffer: Buffer): string | null {
  try {
    const dossier = mkdtempSync(join(tmpdir(), "h2fleet-pdf-"));
    const f = join(dossier, "doc.pdf");
    writeFileSync(f, buffer);
    return execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" });
  } catch {
    return null;
  }
}

describe("livrables au standard cabinet", () => {
  it("titre d'action : la première phrase (la conclusion) devient le titre", () => {
    expect(titreEtCorps("Le plan est moins coûteux que le statu quo : son coût atteint X. Suite.")).toEqual({
      titre: "Le plan est moins coûteux que le statu quo",
      corps: "Son coût atteint X. Suite.",
    });
    expect(titreEtCorps("- Étape une\n- Étape deux").titre).toBe("");
  });

  it("note au conseil PDF : recommandation, pièces sourcées, limites, traçabilité, texte lisible", async () => {
    const buffer = await renderToBuffer(
      <CouncilNotePDF langue="fr" sections={sections} faits={faits} meta={meta} strategie={strategie} sensibilite={sensibilite} />,
    );
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    const texte = texteDuPdf(buffer);
    if (texte === null) return; // pdftotext absent : rendu seulement
    for (const attendu of ["NOTE AU CONSEIL", "RECOMMANDATION", "PIÈCE 1", "PIÈCE 2", "PIÈCE 3", "CE QUE CETTE NOTE NE DIT PAS", "TRAÇABILITÉ DES CHIFFRES", "Source : moteur H2Fleet"]) {
      expect(texte).toContain(attendu);
    }
    expect(texte).not.toMatch(/N O T E/);
    expect(texte).toContain(faits.find((f) => f.id === "tco_plan")!.rendu.fr.replace(/\u202f/g, "\u00a0").split("\u00a0")[0]);
  });

  it("note au conseil Word : document .docx généré", async () => {
    const blob = await construireNoteDocx({ langue: "en", sections: rendreSections(brouillonModele(faits, "en"), faits, "en"), faits, meta, strategie, sensibilite });
    const octets = Buffer.from(await blob.arrayBuffer());
    expect(octets.subarray(0, 2).toString()).toBe("PK");
    expect(octets.length).toBeGreaterThan(5000);
  });

  it("rapport détaillé PDF : titre d'action chiffré, pièces numérotées, totaux lisibles par l'e2e", async () => {
    const buffer = await renderToBuffer(
      <CouncilReportPDF
        langue="fr"
        meta={{ organisation: "Ville", projet: "P", dateIso: "2026-10-03", anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, strategieRetenue: retenue }}
        strategie={strategie}
        sensibilite={sensibilite}
        unites={new Map([["v1", "C-01"], ["v2", "C-02"]])}
      />,
    );
    const texte = texteDuPdf(buffer);
    if (texte === null) return;
    expect(texte).toContain("Stratégie retenue : Plan actuel");
    expect(texte).toMatch(/Le plan (économise|coûte)/);
    for (const attendu of ["PIÈCE 1", "PIÈCE 4", "ANNEXE D", "Subventions prévues"]) expect(texte).toContain(attendu);
    expect(texte).toMatch(/Infrastructure totale \(avant taxes\)\s+[\d\s\u00a0\u202f]+ \$/);
    // Point 13 : tornade lisible (libellés complets, bornes) et statu quo expliqué par scénario.
    expect(texte).toContain("Ce qui fait bouger le résultat");
    expect(texte).toContain("Prix du diesel");
    expect(texte).toMatch(/Prudent : Statu quo moins cher qu'au central/);
    // Point 12 : prix d'achat par catégorie et sources numérotées avec leur adresse.
    for (const attendu of ["ANNEXE E", "ANNEXE F", "Autobus", "statcan.gc.ca"]) expect(texte).toContain(attendu);
    expect(texte).toMatch(/\[\d+\] Statistique Canada/);
  });
});

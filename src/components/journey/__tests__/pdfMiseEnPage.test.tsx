/**
 * Audit acheteur, point 1 — le PDF du conseil reste LISIBLE quelle que soit
 * la taille de la flotte : aucun texte superposé (une pièce trop longue se
 * poursuit sur la page suivante au lieu d'être écrasée sur une seule), et
 * le nombre de pages grandit avec le nombre de véhicules. Positions du texte
 * lues avec pdfjs (aucune dépendance système).
 */
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { analyserSensibilite, ENGINE_VERSION } from "@/lib/tco";
import { construireStrategie, type VehiculeProjet } from "@/lib/journey/strategies";
import { analyserEquite, scenarioReduction } from "@/lib/journey/fmv";
import { brouillonModele, faitsNote, rendreSections } from "@/lib/journey/councilNote";
import { genererFlotteDemo, planDemo } from "@/lib/demoData/villeDemo";
import CouncilReportPDF from "../CouncilReportPDF";
import CouncilNotePDF from "../CouncilNotePDF";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };

function flotte(n: number): VehiculeProjet[] {
  const base = genererFlotteDemo();
  const plan = planDemo(base, 2026);
  return Array.from({ length: n }, (_, i) => {
    const v = base[i % base.length];
    const p = plan[i % plan.length];
    return {
      ...v,
      id: `v${i}`,
      unit_number: `${v.unit_number}-${Math.floor(i / base.length)}`,
      department: ["Travaux publics", "Parcs et loisirs", "Transport collectif", "Sécurité incendie"][i % 4],
      replacement_year: p.replacement_year,
      target_technology: p.target_technology,
    };
  });
}

interface Boite {
  page: number;
  texte: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Paires de fragments de texte qui se recouvrent sur une même page. */
async function chevauchements(buffer: Buffer): Promise<{ pages: number; paires: [string, string][] }> {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: false, isEvalSupported: false }).promise;
  const paires: [string, string][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const contenu = await page.getTextContent();
    const boites: Boite[] = [];
    for (const item of contenu.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const h = Math.abs(item.transform[3]) || 8;
      const x = item.transform[4];
      const y = item.transform[5];
      boites.push({ page: p, texte: item.str, x0: x, x1: x + item.width, y0: y, y1: y + h * 0.8 });
    }
    for (let i = 0; i < boites.length; i++) {
      for (let j = i + 1; j < boites.length; j++) {
        const a = boites[i];
        const b = boites[j];
        const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        if (dx > 1.5 && dy > 1.5) paires.push([a.texte, b.texte]);
      }
    }
  }
  return { pages: doc.numPages, paires };
}

async function rapport(n: number) {
  const vehicules = flotte(n);
  const strategie = construireStrategie(vehicules, "plan_actuel", OPTIONS);
  const sensibilite = analyserSensibilite(strategie.plan!);
  const unites = new Map(vehicules.map((v) => [v.id, v.unit_number!]));
  const meta = {
    organisation: "Ville de Rivière-Claire",
    projet: "Transition 2027-2036",
    dateIso: "2026-10-04",
    anneeReference: 2026,
    horizonAns: 10,
    tauxActualisationNominal: 0.05,
    strategieRetenue: { cle: "plan_actuel" as const, ecarts: 0 },
    fmv: { equite: analyserEquite(strategie, vehicules), reduction: scenarioReduction(strategie, vehicules, OPTIONS) },
  };
  const buffer = await renderToBuffer(
    <CouncilReportPDF langue="fr" meta={meta} strategie={strategie} sensibilite={sensibilite} unites={unites} />,
  );
  return { buffer, strategie, sensibilite };
}

describe("PDF du conseil lisible à toute taille de flotte", () => {
  it("40, 80 et 300 véhicules : aucun texte superposé, les pages suivent le volume", async () => {
    const pages: number[] = [];
    for (const n of [40, 80, 300]) {
      const { buffer } = await rapport(n);
      const r = await chevauchements(buffer);
      expect(r.paires.slice(0, 5), `${n} véhicules`).toEqual([]);
      pages.push(r.pages);
    }
    expect(pages[1]).toBeGreaterThan(pages[0]);
    expect(pages[2]).toBeGreaterThan(pages[1] + 4);
  }, 120000);

  it("note au conseil (80 véhicules) : aucun texte superposé", async () => {
    const { strategie, sensibilite } = await rapport(80);
    const faits = faitsNote({
      organisation: "Ville de Rivière-Claire",
      projet: "Transition 2027-2036",
      dateIso: "2026-10-04",
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
      strategie,
      retenue: { cle: "plan_actuel", ecarts: 0 },
      sensibilite,
      hiver: [],
    });
    const buffer = await renderToBuffer(
      <CouncilNotePDF
        langue="fr"
        sections={rendreSections(brouillonModele(faits, "fr"), faits, "fr")}
        faits={faits}
        meta={{ organisation: "Ville", projet: "P", dateIso: "2026-10-04", strategie: "Plan actuel", snapshotDate: "2026-10-04", moteur: ENGINE_VERSION, empreinte: strategie.resultat!.empreinteEntree }}
        strategie={strategie}
        sensibilite={sensibilite}
      />,
    );
    const r = await chevauchements(buffer);
    expect(r.paires.slice(0, 5)).toEqual([]);
  }, 60000);
});

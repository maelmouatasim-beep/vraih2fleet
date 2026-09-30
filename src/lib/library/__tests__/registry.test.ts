import { describe, expect, it } from "vitest";
import { LISTE_HYPOTHESES } from "@/lib/tco";
import energyData from "@/lib/tco/energy-data.json";
import { filtrerHypotheses, formaterValeur, historiqueDiesel, resumeStatuts } from "../registry";

describe("registre de la Bibliothèque (D2)", () => {
  it("le résumé couvre TOUTES les hypothèses du moteur, sans reste", () => {
    const r = resumeStatuts(LISTE_HYPOTHESES);
    expect(r.total).toBe(LISTE_HYPOTHESES.length);
    expect(r.verifie + r.estimation + r.a_valider).toBe(r.total);
  });

  it("formate ratios en %, montants en $ CAD, autres unités telles quelles", () => {
    expect(formaterValeur(0.03, "ratio", "fr")).toMatch(/^3\s?%$/);
    expect(formaterValeur(15000, "$", "fr")).toMatch(/15\s?000/);
    expect(formaterValeur(1.8179, "$/L", "fr")).toBe("1,8179 $/L");
  });

  it("filtre par statut et par texte sans tenir compte des accents", () => {
    const ech = [
      { id: "prix_diesel", description: "Prix du diésel", statut: "verifie" as const },
      { id: "borne", description: "Borne niveau 2", statut: "estimation" as const },
    ];
    expect(filtrerHypotheses(ech, "diesel", "tous").map((h) => h.id)).toEqual(["prix_diesel"]);
    expect(filtrerHypotheses(ech, "", "estimation").map((h) => h.id)).toEqual(["borne"]);
    expect(filtrerHypotheses(ech, "", "tous")).toHaveLength(2);
  });

  it("l'historique diesel reprend EXACTEMENT la série archivée (aucune valeur ajoutée)", () => {
    const h = historiqueDiesel();
    expect(h.points).toHaveLength(energyData.diesel.mois.length);
    expect(h.points[0].quebec).toBe(energyData.diesel.serieTtcCentsParL.quebec[0]);
    expect(h.source.archive).toBe(energyData.diesel.source.archive);
  });
});

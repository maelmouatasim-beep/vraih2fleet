import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, LISTE_HYPOTHESES } from "@/lib/tco";
import { construireClasseurPlan } from "../report";
import { construireStrategie, type VehiculeProjet } from "../strategies";

const OPTIONS = {
  anneeReference: 2026,
  horizonAns: 10,
  tauxActualisationNominal: 0.05,
  typeOrganisme: "municipalite" as const,
};

const META = {
  organisation: "Ville de Test",
  projet: "Transition",
  dateIso: "2026-09-28",
  anneeReference: 2026,
  horizonAns: 10,
};

function flotte(): VehiculeProjet[] {
  return [
    {
      id: "v1",
      category: "camionnette",
      fuel_type: "diesel",
      annual_km: 30000,
      consumption_per_100km: 16,
      consumption_source: "saisie",
      usage_profile: "urbain",
      replacement_year: 2028,
      target_technology: "bev",
    },
  ];
}

describe("construireClasseurPlan", () => {
  const strategie = construireStrategie(flotte(), "plan_actuel", OPTIONS);
  const unites = new Map([["v1", "U-101"]]);
  const feuilles = construireClasseurPlan(strategie, unites, META);

  it("trois feuilles : plan annuel, véhicules, hypothèses", () => {
    expect(feuilles.map((f) => f.nom)).toEqual(["Plan annuel", "Véhicules", "Hypothèses"]);
  });

  it("le plan annuel reprend la vueBudgetaire du moteur, ligne à ligne", () => {
    const budget = feuilles[0].lignes;
    const entete = budget[4];
    expect(entete[0]).toBe("Année");
    const premiere = budget[5];
    expect(premiere[0]).toBe(2026);
    const vue = strategie.resultat!.vueBudgetaire;
    expect(budget.slice(5, 5 + vue.length).map((l) => l[8])).toEqual(vue.map((l) => l.ecart));
    // traçabilité : version du moteur et empreinte dans l'en-tête
    expect(String(budget[1][0])).toContain(ENGINE_VERSION);
    expect(String(budget[1][0])).toContain(strategie.resultat!.empreinteEntree);
  });

  it("la feuille véhicules porte l'unité, l'année d'achat et les subventions", () => {
    const lignes = feuilles[1].lignes;
    const v1 = lignes[1];
    expect(v1[0]).toBe("U-101");
    expect(v1[1]).toBe("BEV");
    expect(v1[2]).toBe(2028);
    expect(typeof v1[8]).toBe("number");
  });

  it("la feuille hypothèses liste tout le registre avec statut et date de vérification", () => {
    const lignes = feuilles[2].lignes;
    expect(lignes.length).toBe(3 + LISTE_HYPOTHESES.length);
    const prixDiesel = lignes.find((l) => l[0] === "prix_diesel")!;
    expect(prixDiesel[4]).toBe("vérifié");
    expect(String(prixDiesel[7])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

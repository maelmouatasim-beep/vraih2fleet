import { describe, expect, it } from "vitest";
import { calculerPlan, DEFAUTS_CATEGORIES, HYPOTHESES } from "@/lib/tco";
import { analyserEquite, QUESTIONS_EQUITE, scenarioReduction } from "../fmv";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { construireClasseurPlan } from "../report";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };

function v(id: string, patch: Partial<VehiculeProjet> & { department?: string }): VehiculeProjet {
  return {
    id,
    unit_number: id.toUpperCase(),
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 30000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    replacement_year: 2027,
    target_technology: "bev",
    depot: "Garage central",
    ...patch,
  } as VehiculeProjet;
}

const FLOTTE = [
  v("a", { department: "Parcs", annual_km: 32000 }),
  v("b", { department: "Parcs", annual_km: 8000 }), // sous-utilisée (8 000 < 0,6 × 30 000)
  v("c", { department: "Travaux publics", category: "camion_moyen", annual_km: 12000, consumption_per_100km: 26, depot: "Dépôt Nord" }),
  v("d", { department: "Déneigement", category: "camion_lourd", annual_km: 20000, consumption_per_100km: 38, target_technology: "diesel", depot: "Dépôt Nord" }),
  v("bus", { department: "Transport collectif", category: "autobus_urbain_12m", annual_km: 55000, consumption_per_100km: 45 }),
];

describe("Fonds municipal vert — analyse d'équité", () => {
  const s = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
  const e = analyserEquite(s, FLOTTE);

  it("répartit les bénéfices par service et par secteur ; les sommes égalent le moteur (véhicules seuls)", () => {
    expect(e.parService.map((l) => l.libelle).sort()).toEqual(["Déneigement", "Parcs", "Transport collectif", "Travaux publics"]);
    expect(e.parService.reduce((x, l) => x + l.vehicules, 0)).toBe(FLOTTE.length);
    const seuls = calculerPlan({ ...s.plan!, sitesInfra: [] });
    expect(e.parService.reduce((x, l) => x + l.co2WtwEviteTonnes, 0)).toBeCloseTo(seuls.co2EviteWtwTonnes, 6);
    expect(e.parService.reduce((x, l) => x + l.vanVehicules, 0)).toBeCloseTo(seuls.vanDifferentielle, 2);
    expect(e.parService.find((l) => l.libelle === "Déneigement")!.zeroEmission).toBe(0);
    // Secteurs : l'infrastructure de chaque garage = plan d'infrastructure (source unique).
    expect(e.parSecteur.reduce((x, l) => x + l.infraCapex, 0)).toBeCloseTo(s.infra.totalCapex, 2);
  });

  it("part du transport collectif dans le CO2e évité au pot, et questions qualitatives à documenter (rien d'inventé)", () => {
    expect(e.partTransportCollectifCo2).toBeGreaterThan(0);
    expect(e.partTransportCollectifCo2).toBeLessThan(1);
    expect(e.questions).toEqual(QUESTIONS_EQUITE);
  });
});

describe("Fonds municipal vert — scénario de réduction / redimensionnement", () => {
  const s = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
  const r = scenarioReduction(s, FLOTTE, OPTIONS);

  it("seuil du registre (à valider) ; seuls les véhicules sous le seuil sont candidats", () => {
    expect(r.seuil).toBe(HYPOTHESES.seuil_sous_utilisation_flotte.valeur);
    expect(HYPOTHESES.seuil_sous_utilisation_flotte.statut).toBe("a_valider");
    const ids = r.candidats.map((c) => c.id).sort();
    expect(ids).toEqual(["b", "c", "d"]);
    for (const c of r.candidats) {
      expect(c.ratio).toBeLessThan(r.seuil);
      expect(c.kmParAnType).toBe(DEFAUTS_CATEGORIES[c.categorie].kmParAnDefaut);
    }
    expect(r.vehiculesDuPlan).toBe(5);
    // Déneigement : à juger par le service (saisonnier).
    expect(r.candidats.find((c) => c.id === "d")!.aJugerParLeService).toBe(true);
  });

  it("coût total actualisé évité = moteur sur le véhicule seul ; total = somme", () => {
    const b = s.plan!.vehicules.find((x) => x.id === "b")!;
    const seul = calculerPlan({ parametres: s.plan!.parametres, vehicules: [b], sitesInfra: [] });
    expect(r.candidats.find((c) => c.id === "b")!.tcoEvite).toBeCloseTo(seul.alternative.tcoActualise, 2);
    expect(r.tcoEviteTotal).toBeCloseTo(r.candidats.reduce((x, c) => x + c.tcoEvite, 0), 2);
  });

  it("pistes de déclassement : véhicule plus petit chiffré par le moteur (économie positive)", () => {
    const parId = new Map(r.pistes.map((p) => [p.id, p]));
    expect(parId.get("b")).toEqual(expect.objectContaining({ de: "camionnette", vers: "vehicule_leger" }));
    expect(parId.get("c")).toEqual(expect.objectContaining({ de: "camion_moyen", vers: "camionnette" }));
    for (const p of r.pistes) expect(p.economie).toBeGreaterThan(0);
  });

  it("le classeur du rapport contient la feuille « Fonds municipal vert » (fr et en)", () => {
    const meta = {
      organisation: "Org",
      projet: "Projet",
      dateIso: "2026-10-04",
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
      fmv: { equite: analyserEquite(s, FLOTTE), reduction: r },
    };
    const unites = new Map(FLOTTE.map((x) => [x.id, x.unit_number!]));
    const fr = construireClasseurPlan(s, unites, meta, "fr");
    expect(fr.map((f) => f.nom)).toEqual(["Plan annuel", "Véhicules", "Fonds municipal vert", "Hypothèses"]);
    const texte = fr[2].lignes.flat().join(" ");
    expect(texte).toContain("ANALYSE D'ÉQUITÉ");
    expect(texte).toContain("SCÉNARIO DE RÉDUCTION / REDIMENSIONNEMENT");
    expect(texte).toContain("Transport collectif");
    expect(texte).toContain("B");
    const en = construireClasseurPlan(s, unites, meta, "en");
    expect(en[2].nom).toBe("Green Municipal Fund");
    expect(en[2].lignes.flat().join(" ")).toContain("EQUITY ANALYSIS");
    // Sans analyse FMV fournie, le classeur reste à 3 feuilles.
    expect(construireClasseurPlan(s, unites, { ...meta, fmv: undefined }, "fr")).toHaveLength(3);
  });
});

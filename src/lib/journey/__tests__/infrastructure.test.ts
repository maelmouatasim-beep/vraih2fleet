import { describe, expect, it } from "vitest";
import { HYPOTHESES } from "@/lib/tco";
import {
  calculerRaccordement,
  cleGarage,
  planifierInfrastructure,
  sitesInfraMoteur,
  type VehiculeInfra,
} from "../infrastructure";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { construireClasseurPlan } from "../report";

const N2 = HYPOTHESES.borne_niveau2_installee.valeur;
const R50 = HYPOTHESES.borne_rapide_50kw_installee.valeur;
const P1 = HYPOTHESES.raccordement_palier1.valeur;
const P2 = HYPOTHESES.raccordement_palier2.valeur;
const P3 = HYPOTHESES.raccordement_palier3.valeur;
const PRESUMES = HYPOTHESES.puissance_disponible_garage_presumee.valeur;

function vi(patch: Partial<VehiculeInfra>): VehiculeInfra {
  return { id: "v", category: "camionnette", depot: "Garage A", technologie: "BEV", anneeAcquisition: 0, ...patch };
}

describe("planifierInfrastructure (source unique par garage)", () => {
  it("bornes par catégorie, un raccordement par garage, station H2 si FCEV", () => {
    const p = planifierInfrastructure(
      [
        vi({ id: "a1", depot: "Garage A" }),
        vi({ id: "a2", depot: "garage a ", category: "camion_moyen", anneeAcquisition: 2 }),
        vi({ id: "b1", depot: "Garage B", technologie: "FCEV", category: "camion_lourd" }),
      ],
      // station au dépôt CHOISIE pour le garage B (sinon : station externe, 1 camion < seuil)
      { anneeReference: 2026, garages: new Map([[cleGarage("Garage B"), { ravitaillementH2: "depot" as const }]]) },
    );
    expect(p.garages.map((g) => g.depot)).toEqual(["Garage A", "Garage B"]);
    const a = p.garages[0];
    expect(a.capexBornes).toBe(N2 + R50);
    // 19 kW (niveau 2) + 50 kW (rapide) = 69 kW demandés vs 20 kW présumés → +49 kW, palier 1.
    expect(a.raccordement).toMatchObject({
      kwDemandes: 69,
      kwDisponibles: PRESUMES,
      kwDisponiblesSource: "presumee",
      kwSupplementaires: 69 - PRESUMES,
      palier: 1,
      cout: P1,
      source: "estimation",
    });
    expect(a.anneeMiseEnServiceRecharge).toBe(0);
    expect(a.phasage.map((ph) => ph.annee)).toEqual([2026, 2028]);
    const b = p.garages[1];
    expect(b.raccordement.cout).toBe(0);
    expect(b.capexStationH2).toBe(HYPOTHESES.station_h2_depot.valeur);
    expect(p.totalCapex).toBe(N2 + R50 + P1 + HYPOTHESES.station_h2_depot.valeur);
  });

  it("une seule borne niveau 2 (ex. Hôtel de ville) : tient dans la capacité existante → 0 $", () => {
    const p = planifierInfrastructure([vi({ id: "h", depot: "Hôtel de ville" })], { anneeReference: 2026 });
    expect(p.garages[0].raccordement).toMatchObject({ cout: 0, source: "capacite_existante", palier: 0, kwDemandes: 19 });
    expect(p.totalCapex).toBe(N2);
  });

  it("paliers selon les kW SUPPLÉMENTAIRES (et non un forfait par garage)", () => {
    expect(calculerRaccordement(0, undefined)).toMatchObject({ cout: 0, source: "aucun" });
    expect(calculerRaccordement(PRESUMES, undefined)).toMatchObject({ cout: 0, source: "capacite_existante" });
    const s1 = HYPOTHESES.raccordement_seuil_palier1_kw.valeur;
    const s2 = HYPOTHESES.raccordement_seuil_palier2_kw.valeur;
    expect(calculerRaccordement(PRESUMES + s1, undefined)).toMatchObject({ palier: 1, cout: P1 });
    expect(calculerRaccordement(PRESUMES + s1 + 1, undefined)).toMatchObject({ palier: 2, cout: P2 });
    expect(calculerRaccordement(PRESUMES + s2 + 1, undefined)).toMatchObject({ palier: 3, cout: P3 });
    // Monotone : plus de kW supplémentaires ne coûte jamais moins.
    let precedent = 0;
    for (let kw = 0; kw <= 1000; kw += 7) {
      const c = calculerRaccordement(kw, undefined).cout;
      expect(c).toBeGreaterThanOrEqual(precedent);
      precedent = c;
    }
  });

  it("puissance disponible du garage renseignée : elle remplace la valeur présumée", () => {
    const g = new Map([[cleGarage("Garage A"), { puissanceDisponibleKw: 200 }]]);
    const p = planifierInfrastructure(
      [vi({ id: "a1" }), vi({ id: "a2", category: "camion_moyen" })],
      { anneeReference: 2026, garages: g },
    );
    expect(p.garages[0].raccordement).toMatchObject({
      kwDisponibles: 200,
      kwDisponiblesSource: "garage",
      cout: 0,
      source: "capacite_existante",
    });
  });

  it("devis du garage : toujours prioritaire, même sur le devis du projet", () => {
    const g = new Map([[cleGarage("A"), { devisRaccordement: 12345 }]]);
    const p = planifierInfrastructure(
      [vi({ id: "a", depot: "A", category: "camion_lourd" }), vi({ id: "b", depot: "B", category: "camion_lourd" })],
      { anneeReference: 2026, garages: g, devisRaccordementProjet: 40000 },
    );
    const [a, b] = p.garages;
    expect(a.raccordement).toMatchObject({ cout: 12345, source: "devis_garage" });
    expect(b.raccordement).toMatchObject({ cout: 40000, source: "devis_projet" });
    expect(p.raccordement).toBe(12345 + 40000);
  });

  it("devis client du projet : remplace la somme des raccordements, réparti, total exact", () => {
    const p = planifierInfrastructure(
      [vi({ id: "a", depot: "A" }), vi({ id: "b", depot: "B" })],
      { anneeReference: 2026, devisRaccordementProjet: 80000 },
    );
    expect(p.raccordement).toBeCloseTo(80000, 6);
    expect(p.garages.every((g) => g.raccordement.source === "devis_projet")).toBe(true);
  });

  it("Σ capex des sites du moteur = totalCapex (par construction)", () => {
    const p = planifierInfrastructure(
      [vi({ id: "a", depot: "A" }), vi({ id: "b", depot: null, technologie: "FCEV", category: "camion_lourd" })],
      { anneeReference: 2026 },
    );
    const sites = sitesInfraMoteur(p);
    expect(sites.reduce((s, x) => s + x.capexAvantTaxes, 0)).toBeCloseTo(p.totalCapex, 6);
    expect(cleGarage(null)).toBe("__sans_garage__");
  });
});

// Cas du test terrain : 12 véhicules, 3 garages.
const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };
function veh(i: number, depot: string, category: string, target: string | null, annee: number): VehiculeProjet {
  return {
    id: `v${i}`,
    unit_number: `U-${i}`,
    category,
    fuel_type: "diesel",
    annual_km: 20000 + i * 1000,
    consumption_per_100km: null,
    consumption_source: "estimation",
    usage_profile: "urbain",
    replacement_year: annee,
    target_technology: target,
    depot,
  };
}
const FLOTTE: VehiculeProjet[] = [
  veh(1, "Hôtel de ville", "vehicule_leger", "bev", 2027),
  veh(2, "Garage municipal", "camionnette", "bev", 2027),
  veh(3, "Garage municipal", "camionnette", "bev", 2028),
  veh(4, "Garage municipal", "camion_moyen", "bev", 2029),
  veh(5, "Garage municipal", "camion_lourd", "diesel", 2030),
  veh(6, "Travaux publics", "camionnette", "bev", 2027),
  veh(7, "Travaux publics", "camion_moyen", "bev", 2028),
  veh(8, "Travaux publics", "camion_lourd", null, 2031),
  veh(9, "Travaux publics", "vehicule_leger", "bev", 2029),
  veh(10, "Hôtel de ville", "vehicule_leger", null, 2030),
  veh(11, "Garage municipal", "camionnette", "bev", 2032),
  veh(12, "Travaux publics", "camionnette", "diesel", 2033),
];

describe("1.1 — le même projet affiche le même total d'infrastructure partout", () => {
  it("stratégie = sites du moteur = carte Plan (infra) = Excel, au dollar près", () => {
    const s = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
    const sites = s.plan!.sitesInfra ?? [];
    const sommeSites = sites.reduce((a, x) => a + x.capexAvantTaxes, 0);
    expect(s.infraCapex).toBe(s.infra.totalCapex);
    expect(sommeSites).toBeCloseTo(s.infra.totalCapex, 6);
    expect(s.infra.garages.reduce((a, g) => a + g.capexTotal, 0)).toBeCloseTo(s.infra.totalCapex, 6);
    // 3 garages distincts, chacun avec son propre site de recharge
    expect(s.infra.garages.map((g) => g.depot)).toEqual(["Garage municipal", "Hôtel de ville", "Travaux publics"]);
    expect(sites).toHaveLength(3);

    const classeur = construireClasseurPlan(s, new Map(), {
      organisation: "Ville", projet: "P", dateIso: "2026-10-02", anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05,
    });
    const lignes = classeur[1].lignes;
    const total = lignes.find((l) => l[0] === "Infrastructure totale")!;
    expect(total[total.length - 1]).toBe(s.infra.totalCapex);
  });

  it("Stratégies (toutes) et Plan utilisent la même fonction : plan_actuel recalculé = même total", () => {
    const a = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
    const b = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
    expect(a.infra.totalCapex).toBe(b.infra.totalCapex);
  });
});

describe("ravitaillement H2 : station au dépôt ou station externe (§3.5 v2.5)", () => {
  const SEUIL = HYPOTHESES.seuil_station_h2_depot_vehicules.valeur;
  const camions = (n: number) =>
    Array.from({ length: n }, (_, i) => vi({ id: `h${i}`, depot: "Dépôt Nord", technologie: "FCEV", category: "camion_lourd" }));

  it("moins de N camions H2 sur un garage (seuil du registre, estimation) : station externe, aucun capex de station", () => {
    expect(HYPOTHESES.seuil_station_h2_depot_vehicules.statut).toBe("estimation");
    const p = planifierInfrastructure(camions(SEUIL - 1), { anneeReference: 2026 });
    expect(p.garages[0].ravitaillementH2).toMatchObject({ mode: "externe", origine: "auto", seuil: SEUIL });
    expect(p.garages[0].capexStationH2).toBe(0);
    expect(p.totalCapex).toBe(0);
    expect(sitesInfraMoteur(p)).toEqual([]);
  });

  it("à partir du seuil : station au dépôt proposée", () => {
    const p = planifierInfrastructure(camions(SEUIL), { anneeReference: 2026 });
    expect(p.garages[0].ravitaillementH2).toMatchObject({ mode: "depot", origine: "auto" });
    expect(p.garages[0].capexStationH2).toBe(HYPOTHESES.station_h2_depot.valeur);
  });

  it("le choix du garage l'emporte sur le seuil, dans les deux sens", () => {
    const g = (mode: "depot" | "externe") => new Map([[cleGarage("Dépôt Nord"), { ravitaillementH2: mode }]]);
    expect(planifierInfrastructure(camions(1), { anneeReference: 2026, garages: g("depot") }).garages[0].capexStationH2).toBeGreaterThan(0);
    const p = planifierInfrastructure(camions(SEUIL + 2), { anneeReference: 2026, garages: g("externe") });
    expect(p.garages[0].ravitaillementH2).toMatchObject({ mode: "externe", origine: "garage" });
    expect(p.garages[0].capexStationH2).toBe(0);
  });

  it("prix livré et détour de la station externe reportés sur les camions H2 dans le moteur", () => {
    const veh = (id: string): VehiculeProjet => ({
      id,
      category: "camion_lourd",
      fuel_type: "diesel",
      annual_km: 50000,
      consumption_per_100km: 40,
      consumption_source: "saisie",
      usage_profile: "regional",
      replacement_year: 2027,
      target_technology: "fcev",
      depot: "Dépôt Nord",
    });
    const options = (garage: Record<string, unknown>) => ({
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
      typeOrganisme: "municipalite" as const,
      garages: new Map([[cleGarage("Dépôt Nord"), garage]]),
    });
    const sans = construireStrategie([veh("c1")], "plan_actuel", options({}));
    const avec = construireStrategie([veh("c1")], "plan_actuel", options({ prixH2ExterneParKg: 12, detourH2KmParJour: 10 }));
    expect(sans.infra.totalCapex).toBe(0);
    expect(sans.plan!.vehicules[0].prixH2ParKg).toBeUndefined();
    expect(avec.plan!.vehicules[0]).toMatchObject({ prixH2ParKg: 12, kmDetourParAn: 10 * HYPOTHESES.jours_utilisation_an.valeur });
    expect(avec.resultat!.vanDifferentielle).not.toBe(sans.resultat!.vanDifferentielle);
  });
});

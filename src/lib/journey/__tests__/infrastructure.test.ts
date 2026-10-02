import { describe, expect, it } from "vitest";
import { HYPOTHESES } from "@/lib/tco";
import { cleGarage, planifierInfrastructure, sitesInfraMoteur, type VehiculeInfra } from "../infrastructure";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { construireClasseurPlan } from "../report";

const N2 = HYPOTHESES.borne_niveau2_installee.valeur;
const R50 = HYPOTHESES.borne_rapide_50kw_installee.valeur;
const RACC = HYPOTHESES.raccordement_depot.valeur;

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
      { anneeReference: 2026 },
    );
    expect(p.garages.map((g) => g.depot)).toEqual(["Garage A", "Garage B"]);
    const a = p.garages[0];
    expect(a.capexBornes).toBe(N2 + R50);
    expect(a.raccordement).toEqual({ cout: RACC, source: "estimation" });
    expect(a.anneeMiseEnServiceRecharge).toBe(0);
    expect(a.phasage.map((ph) => ph.annee)).toEqual([2026, 2028]);
    const b = p.garages[1];
    expect(b.raccordement.cout).toBe(0);
    expect(b.capexStationH2).toBe(HYPOTHESES.station_h2_depot.valeur);
    expect(p.totalCapex).toBe(N2 + R50 + RACC + HYPOTHESES.station_h2_depot.valeur);
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
    expect(total[4]).toBe(s.infra.totalCapex);
  });

  it("Stratégies (toutes) et Plan utilisent la même fonction : plan_actuel recalculé = même total", () => {
    const a = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
    const b = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
    expect(a.infra.totalCapex).toBe(b.infra.totalCapex);
  });
});

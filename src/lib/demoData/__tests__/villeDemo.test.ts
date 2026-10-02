import { describe, expect, it } from "vitest";
import { MARQUEUR_DEMO, estVehiculeDemo, genererFlotteDemo, planDemo } from "../villeDemo";
import { contraintesDemo } from "../villeDemo";
import { optimiserCalendrier, zContraintesOptimiseur } from "@/lib/journey/optimizer";
import { cleGarage } from "@/lib/journey/infrastructure";

describe("flotte de démonstration (Ville de Rivière-Claire)", () => {
  const flotte = genererFlotteDemo();

  it("~40 véhicules, unités uniques, toutes catégories du moteur représentées", () => {
    expect(flotte.length).toBe(40);
    expect(new Set(flotte.map((v) => v.unit_number)).size).toBe(40);
    const categories = new Set(flotte.map((v) => v.category));
    expect(categories).toEqual(
      new Set(["vehicule_leger", "camionnette", "camion_moyen", "camion_lourd", "autobus_urbain_12m"]),
    );
  });

  it("déterministe (aucun aléatoire) et clairement marquée fictive", () => {
    expect(genererFlotteDemo()).toEqual(flotte);
    for (const v of flotte) {
      expect(v.notes).toContain(MARQUEUR_DEMO);
      expect(v.annual_km).toBeGreaterThan(0);
      expect(v.consumption_per_100km).toBeGreaterThan(0);
    }
  });

  it("le plan par défaut couvre tous les véhicules, années dans l'horizon, mix de technologies", () => {
    const plan = planDemo(flotte, 2026);
    expect(plan.length).toBe(40);
    for (const p of plan) {
      expect(p.replacement_year).toBeGreaterThanOrEqual(2027);
      expect(p.replacement_year).toBeLessThanOrEqual(2035);
    }
    const technos = new Set(plan.map((p) => p.target_technology));
    expect(technos.has("bev")).toBe(true);
    expect(technos.has("fcev")).toBe(true);
    expect(plan.filter((p) => p.target_technology === "fcev").length).toBe(2);
  });
});

describe("C7 — démo propre", () => {
  const flotte = genererFlotteDemo();

  it("chaque véhicule démo porte le marqueur et est reconnu par estVehiculeDemo", () => {
    for (const v of flotte) {
      expect(estVehiculeDemo(v.notes)).toBe(true);
    }
    expect(estVehiculeDemo("véhicule réel du client")).toBe(false);
    expect(estVehiculeDemo(null)).toBe(false);
  });

  it("les consommations FICTIVES sont marquées « estimation », jamais « saisie »", () => {
    for (const v of flotte) {
      expect(v.consumption_source).toBe("estimation");
    }
  });
});

describe("démo : contraintes de l'optimiseur (Phase 5.1)", () => {
  it("valides, clé de garage normalisée, et toutes les décisions expliquées", () => {
    const c = zContraintesOptimiseur.parse(contraintesDemo(2026));
    expect(Object.keys(c.garages)).toEqual([cleGarage("Dépôt Nord")]);
    const flotte = genererFlotteDemo();
    const plan = planDemo(flotte, 2026);
    const vehicules = flotte.map((v, i) => {
      const p = plan.find((x) => x.unit_number === v.unit_number)!;
      return { ...v, id: `d${i}`, replacement_year: p.replacement_year, target_technology: p.target_technology };
    });
    const r = optimiserCalendrier({
      vehicules,
      options: { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" },
      contraintes: c,
    });
    expect(r.realisable).toBe(true);
    expect(r.decisions).toHaveLength(flotte.length);
    for (const d of r.decisions) expect(d.raisons.length).toBeGreaterThan(0);
    const codes = new Set(r.decisions.flatMap((d) => d.raisons.map((x) => x.code)));
    // la démo montre chaque famille d'explication
    for (const code of ["electrifie_rentable", "report_budget", "diesel_capacite"]) expect(codes.has(code as never)).toBe(true);
  }, 30000);
});

import { describe, expect, it } from "vitest";
import { MARQUEUR_DEMO, genererFlotteDemo, planDemo } from "../villeDemo";

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

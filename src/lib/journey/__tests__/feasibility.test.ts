import { describe, expect, it } from "vitest";
import { DEFAUTS_CATEGORIES } from "@/lib/tco";
import { evaluerFaisabiliteVehicule, type VehiculeFaisabilite } from "../feasibility";

const OPTIONS = {
  anneeReference: 2026,
  horizonAns: 10,
  tauxActualisationNominal: 0.05,
  typeOrganisme: "municipalite" as const,
};

function vehicule(patch: Partial<VehiculeFaisabilite> = {}): VehiculeFaisabilite {
  return {
    id: "v1",
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 30000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    ...patch,
  };
}

describe("evaluerFaisabiliteVehicule", () => {
  it("évalue BEV et FCEV avec le moteur (économie chiffrée, cohérence verdict/économie)", () => {
    const r = evaluerFaisabiliteVehicule(vehicule(), OPTIONS);
    expect(r.evaluations).not.toBeNull();
    expect(r.evaluations!.map((e) => e.technologie)).toEqual(["BEV", "FCEV"]);
    for (const e of r.evaluations!) {
      expect(Number.isFinite(e.economieActualisee)).toBe(true);
      if (e.economieActualisee > 0) {
        expect(["favorable", "conditionnel"]).toContain(e.verdict);
      } else {
        expect(e.verdict).toBe("defavorable");
      }
    }
    expect(r.kmParAnRetenu).toBe(30000);
    expect(r.donneesEstimees).toEqual([]);
  });

  it("catégorie inconnue du moteur (« autre ») → non évaluable", () => {
    const r = evaluerFaisabiliteVehicule(vehicule({ category: "autre" }), OPTIONS);
    expect(r.evaluations).toBeNull();
  });

  it("km absent → défaut de catégorie, marqué comme donnée estimée", () => {
    const r = evaluerFaisabiliteVehicule(vehicule({ annual_km: null }), OPTIONS);
    expect(r.kmParAnRetenu).toBe(DEFAUTS_CATEGORIES.camionnette.kmParAnDefaut);
    expect(r.donneesEstimees).toContain("km");
  });

  it("consommation « estimation » ou véhicule non diesel → défaut de catégorie marqué estimé", () => {
    const estime = evaluerFaisabiliteVehicule(
      vehicule({ consumption_source: "estimation" }),
      OPTIONS,
    );
    expect(estime.donneesEstimees).toContain("consommation");
    const essence = evaluerFaisabiliteVehicule(vehicule({ fuel_type: "essence" }), OPTIONS);
    expect(essence.donneesEstimees).toContain("consommation");
  });

  it("usage longue distance → réserve BEV ; réserve H2 systématique côté FCEV", () => {
    const r = evaluerFaisabiliteVehicule(vehicule({ usage_profile: "longue_distance" }), OPTIONS);
    const [bev, fcev] = r.evaluations!;
    expect(bev.reserves).toContain("longue_distance");
    if (bev.economieActualisee > 0) expect(bev.verdict).toBe("conditionnel");
    expect(fcev.reserves).toContain("ravitaillement_h2");
  });

  it("la consommation réelle change le chiffre (raison chiffrée traçable)", () => {
    const sobre = evaluerFaisabiliteVehicule(vehicule({ consumption_per_100km: 10 }), OPTIONS);
    const gourmand = evaluerFaisabiliteVehicule(vehicule({ consumption_per_100km: 25 }), OPTIONS);
    // Plus le diesel de référence consomme, plus l'alternative économise.
    expect(gourmand.evaluations![0].economieActualisee).toBeGreaterThan(
      sobre.evaluations![0].economieActualisee,
    );
  });

  it("les subventions résolues sont rattachées à l'évaluation (camionnette BEV : Écocamionnage actif)", () => {
    const r = evaluerFaisabiliteVehicule(vehicule(), OPTIONS);
    const bev = r.evaluations![0];
    expect(bev.subventions.length).toBeGreaterThan(0);
    for (const s of bev.subventions) {
      expect(s.montant).toBeGreaterThan(0);
      expect(s.annee).toBeGreaterThanOrEqual(0);
    }
  });
});

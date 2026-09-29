import { describe, expect, it } from "vitest";
import { DEFAUTS_CATEGORIES } from "@/lib/tco";
import { cibleSuggeree, evaluerFaisabiliteVehicule, type VehiculeFaisabilite } from "../feasibility";

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
  it("MÊME année d'acquisition que le Plan (revue A5) : un remplacement différé change l'économie", () => {
    const immediat = evaluerFaisabiliteVehicule(vehicule(), OPTIONS);
    const differe = evaluerFaisabiliteVehicule(vehicule({ replacement_year: 2029 }), OPTIONS);
    // même calendrier que le Plan : le différentiel est nul avant 2029,
    // l'économie actualisée diffère donc du remplacement immédiat
    expect(differe.evaluations![0].economieActualisee).not.toBeCloseTo(
      immediat.evaluations![0].economieActualisee,
      2,
    );
    // les subventions sont versées à partir de l'année d'acquisition (k=3)
    for (const s of differe.evaluations![0].subventions) {
      expect(s.annee).toBeGreaterThanOrEqual(3);
    }
  });

  it("remplacement APRÈS l'horizon : aucun calcul, signalement clair (revue A5)", () => {
    const r = evaluerFaisabiliteVehicule(vehicule({ replacement_year: 2040 }), OPTIONS);
    expect(r.evaluations).toBeNull();
    expect(r.horsHorizon).toEqual({ anneeRemplacement: 2040, horizonAns: 10 });
  });

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

describe("cibleSuggeree (C2 — cible pré-suggérée à l'étape Flotte)", () => {
  it("retient la meilleure technologie non défavorable (économie la plus élevée)", () => {
    const f = evaluerFaisabiliteVehicule(vehicule(), OPTIONS);
    const s = cibleSuggeree(f);
    const nonDefavorables = f.evaluations!.filter((e) => e.verdict !== "defavorable");
    if (nonDefavorables.length === 0) {
      expect(s).toBeNull();
    } else {
      const meilleure = nonDefavorables.reduce((a, b) =>
        b.economieActualisee > a.economieActualisee ? b : a,
      );
      expect(s).toBe(meilleure.technologie === "BEV" ? "bev" : "fcev");
    }
  });

  it("null quand le véhicule n'est pas évaluable (catégorie inconnue, hors horizon)", () => {
    expect(cibleSuggeree(evaluerFaisabiliteVehicule(vehicule({ category: "autre" }), OPTIONS))).toBeNull();
    expect(
      cibleSuggeree(evaluerFaisabiliteVehicule(vehicule({ replacement_year: 2045 }), OPTIONS)),
    ).toBeNull();
  });

  it("null quand BEV et FCEV sont tous deux défavorables", () => {
    expect(
      cibleSuggeree({
        vehiculeId: "x",
        kmParAnRetenu: 1,
        donneesEstimees: [],
        evaluations: [
          {
            technologie: "BEV",
            verdict: "defavorable",
            economieActualisee: -1000,
            paybackActualiseAns: null,
            co2EviteWtwTonnes: 0,
            coutParTonneWtw: null,
            subventions: [],
            reserves: [],
          },
          {
            technologie: "FCEV",
            verdict: "defavorable",
            economieActualisee: -5000,
            paybackActualiseAns: null,
            co2EviteWtwTonnes: 0,
            coutParTonneWtw: null,
            subventions: [],
            reserves: [],
          },
        ],
      }),
    ).toBeNull();
  });
});

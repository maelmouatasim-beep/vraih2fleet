import { describe, expect, it } from "vitest";
import { DEFAUTS_CATEGORIES } from "@/lib/tco";
import { analyserDonneesVehicule, cibleSuggeree, evaluerFaisabiliteVehicule, recommandationCible, type VehiculeFaisabilite } from "../feasibility";

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

  it("consommation « estimation » ou véhicule ni diesel ni essence → défaut de catégorie marqué estimé", () => {
    const estime = evaluerFaisabiliteVehicule(
      vehicule({ consumption_source: "estimation" }),
      OPTIONS,
    );
    expect(estime.donneesEstimees).toContain("consommation");
    const phev = evaluerFaisabiliteVehicule(vehicule({ fuel_type: "phev" }), OPTIONS);
    expect(phev.donneesEstimees).toContain("consommation");
  });

  it("1.8 — véhicule à essence : référence ESSENCE (sa consommation réelle, facteur essence), plus un diesel", () => {
    const d = analyserDonneesVehicule(vehicule({ fuel_type: "essence", consumption_per_100km: 6.5 }));
    expect(d.carburant).toBe("essence");
    expect(d.consoReference).toBe(6.5);
    expect(d.donneesEstimees).not.toContain("consommation");
    expect(analyserDonneesVehicule(vehicule({ fuel_type: "hybride" })).carburant).toBe("essence");
    expect(analyserDonneesVehicule(vehicule({ fuel_type: "diesel" })).carburant).toBe("diesel");
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
          paybackJamaisCode: "surcout_non_resorbe",
            co2EviteTtwTonnes: 0,
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
          paybackJamaisCode: "surcout_non_resorbe",
            co2EviteTtwTonnes: 0,
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

describe("1.8 — CO2 de la Corolla du test terrain", () => {
  it("Corolla essence 12 500 km/an à 6,5 L/100 km : ≈ 18,8 t évitées au pot sur 10 ans (et non 30 t)", () => {
    const r = evaluerFaisabiliteVehicule(
      vehicule({
        category: "vehicule_leger",
        fuel_type: "essence",
        annual_km: 12500,
        consumption_per_100km: 6.5,
        replacement_year: 2026,
      }),
      OPTIONS,
    );
    const bev = r.evaluations!.find((e) => e.technologie === "BEV")!;
    // 12 500 × 6,5 / 100 = 812,5 L/an × 2,312 kg/L = 1,8785 t/an × 10 ans
    expect(bev.co2EviteTtwTonnes).toBeCloseTo(18.785, 2);
    // Cycle complet : TTW essence × (1 + amont) − électricité du réseau QC (faible)
    expect(bev.co2EviteWtwTonnes).toBeGreaterThan(bev.co2EviteTtwTonnes);
    expect(bev.co2EviteWtwTonnes).toBeLessThan(18.785 * 1.25 + 0.01);
  });
});

describe("3.1 — consommation importée", () => {
  it("source « import » : consommation réelle retenue (pas une estimation)", () => {
    const d = analyserDonneesVehicule(vehicule({ consumption_source: "import", consumption_per_100km: 17 }));
    expect(d.consoReference).toBe(17);
    expect(d.donneesEstimees).not.toContain("consommation");
  });
});

describe("3.3 — recommandation pour un véhicule sans technologie cible", () => {
  it("cible suggérée si favorable, remplacement à l'identique sinon, diesel pour « à reporter », rien si non évaluable", () => {
    const rentable = evaluerFaisabiliteVehicule(vehicule({ annual_km: 40000, replacement_year: 2026 }), OPTIONS);
    expect(recommandationCible(rentable)).toBe(cibleSuggeree(rentable));
    expect(recommandationCible(rentable)).toBe("bev");
    const peuRoulant = evaluerFaisabiliteVehicule(vehicule({ annual_km: 2000, replacement_year: 2027 }), OPTIONS);
    expect(cibleSuggeree(peuRoulant)).toBeNull();
    expect(recommandationCible(peuRoulant)).toBe("diesel");
    expect(recommandationCible(evaluerFaisabiliteVehicule(vehicule({ category: "deneigeuse" }), OPTIONS))).toBe("diesel");
    expect(recommandationCible(evaluerFaisabiliteVehicule(vehicule({ category: "autre" }), OPTIONS))).toBeNull();
  });
});

describe("subventions confirmées par le client (mêmes règles qu'aux Stratégies)", () => {
  it("une PAGTCP confirmée est comptée dans l'économie de l'autobus électrique", () => {
    const bus = vehicule({ category: "autobus_urbain_12m", annual_km: 50000, consumption_per_100km: 45, replacement_year: 2028 });
    const sans = evaluerFaisabiliteVehicule(bus, OPTIONS).evaluations!.find((e) => e.technologie === "BEV")!;
    const avec = evaluerFaisabiliteVehicule(
      {
        ...bus,
        subventionsConfirmees: [
          { programId: "pagtcp", libelle: "PAGTCP", montant: 650000, anneeCalendaireVersement: 2029, reference: "FICTIF-1" },
        ],
      },
      OPTIONS,
    ).evaluations!.find((e) => e.technologie === "BEV")!;
    expect(avec.economieActualisee - sans.economieActualisee).toBeGreaterThan(400000);
  });
});

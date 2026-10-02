import { describe, expect, it } from "vitest";
import { DEFAUTS_CATEGORIES, HYPOTHESES } from "@/lib/tco";
import { diagnostiquerHiver } from "../winter";
import { evaluerFaisabiliteVehicule } from "../feasibility";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { cleGarage } from "../infrastructure";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };
const D = DEFAUTS_CATEGORIES.camionnette;
const consoHiver =
  D.consommation.BEV.valeur * (1 + HYPOTHESES.majoration_hivernale_bev.valeur) * (1 + HYPOTHESES.majoration_charge_utile.valeur);
const autonomieHiver = ((D.batterieUtileKwh.valeur * (1 - HYPOTHESES.reserve_batterie.valeur)) / consoHiver) * 100;

describe("diagnostic hiver / autonomie (bloc 2.4)", () => {
  it("autonomie hiver = batterie utile × (1 − réserve) ÷ conso majorée (hiver × charge), calculée à la main", () => {
    const d = diagnostiquerHiver({ category: "camionnette", annual_km: 20000, max_daily_km: 100 })!;
    expect(d.autonomieHiverKm).toBe(Math.round(autonomieHiver));
    expect(d.autonomieNominaleKm).toBe(Math.round((D.batterieUtileKwh.valeur / D.consommation.BEV.valeur) * 100));
    expect(d.kmJourSource).toBe("saisi");
    expect(d.fenetreSource).toBe("presumee");
  });

  it("trois verdicts selon le km journalier max", () => {
    const tient = diagnostiquerHiver({ category: "camionnette", annual_km: null, max_daily_km: Math.floor(autonomieHiver) - 5 })!;
    expect(tient.verdict).toBe("tient");
    const jour = diagnostiquerHiver({ category: "camionnette", annual_km: null, max_daily_km: Math.ceil(autonomieHiver) + 20 })!;
    expect(jour.verdict).toBe("recharge_journee");
    expect(jour.energieJourneeKwh).toBeGreaterThan(0);
    const non = diagnostiquerHiver({ category: "camionnette", annual_km: null, max_daily_km: Math.ceil(2 * autonomieHiver) + 10 })!;
    expect(non.verdict).toBe("ne_tient_pas");
  });

  it("fenêtre courte du garage : la nuit ne suffit pas → recharge en journée chiffrée", () => {
    const km = Math.floor(autonomieHiver) - 5;
    const d = diagnostiquerHiver({ category: "camionnette", annual_km: null, max_daily_km: km, fenetre: { retour: "23:00", depart: "01:00" } })!;
    expect(d.fenetreH).toBe(2);
    expect(d.fenetreSource).toBe("garage");
    expect(d.verdict).toBe("recharge_journee");
    expect(d.energieNuitKwh).toBeCloseTo(2 * 19 * HYPOTHESES.rendement_recharge.valeur, 0);
  });

  it("km/jour absent : km/an ÷ jours d'utilisation, signalé estimé", () => {
    const d = diagnostiquerHiver({ category: "camionnette", annual_km: 25000 })!;
    expect(d.kmJour).toBe(Math.round(25000 / HYPOTHESES.jours_utilisation_an.valeur));
    expect(d.kmJourSource).toBe("estime");
  });

  it("Faisabilité : « ne tient pas » ⇒ BEV défavorable avec la réserve ; jamais retenu par « Économies d'abord »", () => {
    const v = {
      id: "loin",
      category: "camionnette",
      fuel_type: "diesel",
      annual_km: 60000,
      consumption_per_100km: 16,
      consumption_source: "saisie",
      usage_profile: "urbain",
      replacement_year: 2026,
      target_technology: null,
      depot: "Garage municipal",
      max_daily_km: Math.ceil(2 * autonomieHiver) + 50,
    } as VehiculeProjet;
    const f = evaluerFaisabiliteVehicule(v, OPTIONS);
    const bev = f.evaluations!.find((e) => e.technologie === "BEV")!;
    expect(f.hiver!.verdict).toBe("ne_tient_pas");
    expect(bev.reserves).toContain("autonomie_hiver");
    expect(bev.verdict).toBe("defavorable");
    const s = construireStrategie([v], "economies_d_abord", OPTIONS);
    expect(s.nbZeroEmission).toBe(0);
    // Le même véhicule avec un km/jour raisonnable et la fenêtre de son garage tient l'hiver.
    const garages = new Map([[cleGarage("Garage municipal"), { fenetreRecharge: { retour: "17:00", depart: "07:00" } }]]);
    const ok = evaluerFaisabiliteVehicule({ ...v, max_daily_km: 80 }, { ...OPTIONS, garages });
    expect(ok.hiver).toMatchObject({ verdict: "tient", fenetreH: 14, fenetreSource: "garage" });
  });
});

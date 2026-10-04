import { describe, expect, it } from "vitest";
import {
  GARAGES_DEMO,
  MARQUEUR_DEMO,
  MONTANT_PAGTCP_DEMO,
  SEUIL_KM_CAMION_MOYEN_BEV,
  UNITE_ROUTE_REGIONALE,
  estVehiculeDemo,
  genererFlotteDemo,
  planDemo,
  subventionsConfirmeesDemo,
} from "../villeDemo";
import { CLASSES_PNBV } from "@/lib/fleet/gvwr";
import { caracteristiquesGarages } from "@/lib/fleet/garagesModel";
import { parVehicule } from "@/lib/confirmedSubsidies";
import { construireStrategies, type VehiculeProjet } from "@/lib/journey/strategies";
import { evaluerFaisabiliteVehicule } from "@/lib/journey/feasibility";
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
    expect(technos.has("diesel")).toBe(true);
  });
});

describe("point 3 — démo réaliste et crédible", () => {
  const flotte = genererFlotteDemo();
  const plan = planDemo(flotte, 2026);
  const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };
  const lignesGarages = GARAGES_DEMO.map((g) => ({
    ...g,
    id: g.name,
    organization_id: "org",
    created_at: "",
    updated_at: "",
    charger_quote_document_id: null,
    charger_unit_quote: null,
    grid_connection_quote: null,
    grid_quote_document_id: null,
  }));
  const options = { ...OPTIONS, garages: caracteristiquesGarages(lignesGarages) };
  const confirmees = parVehicule(subventionsConfirmeesDemo(plan).map((c) => ({ ...c, vehicle_id: c.unit_number })));
  const vehicules: VehiculeProjet[] = flotte.map((v, i) => ({
    ...v,
    id: v.unit_number,
    replacement_year: plan[i].replacement_year,
    target_technology: plan[i].target_technology,
    subventionsConfirmees: confirmees.get(v.unit_number),
  }));

  it("classe de poids PNBV renseignée pour chaque véhicule, cohérente avec la catégorie", () => {
    const attendues: Record<string, string[]> = {
      vehicule_leger: ["1"],
      camionnette: ["2b"],
      camion_moyen: ["6", "7"],
      camion_lourd: ["8"],
      autobus_urbain_12m: ["8"],
    };
    for (const v of flotte) {
      expect(CLASSES_PNBV).toContain(v.gvwr_class);
      expect(attendues[v.category]).toContain(v.gvwr_class);
      expect(v.max_daily_km).toBeGreaterThan(0);
    }
  });

  it("puissance disponible RENSEIGNÉE pour chaque garage : plus aucune valeur présumée", () => {
    const depots = new Set(flotte.map((v) => cleGarage(v.depot)));
    expect(new Set(GARAGES_DEMO.map((g) => cleGarage(g.name)))).toEqual(depots);
    for (const g of GARAGES_DEMO) {
      expect(g.available_power_kw).toBeGreaterThan(0);
      expect(g.notes).toContain(MARQUEUR_DEMO);
      expect(g.address).toMatch(/fictive/);
    }
    for (const s of construireStrategies(vehicules, options)) {
      for (const g of s.infra.garages) expect(g.raccordement.kwDisponiblesSource).toBe("garage");
    }
  });

  it("PAGTCP « confirmée par le client » pour les autobus électriques seulement, montant plausible et marqué FICTIF", () => {
    const subs = subventionsConfirmeesDemo(plan);
    const autobusBev = plan.filter((p) => p.unit_number.startsWith("B-") && p.target_technology === "bev");
    expect(subs.map((s) => s.unit_number)).toEqual(autobusBev.map((p) => p.unit_number));
    expect(subs.length).toBe(4);
    for (const s of subs) {
      expect(s.program_id).toBe("pagtcp");
      expect(s.amount).toBe(MONTANT_PAGTCP_DEMO);
      expect(s.amount).toBeGreaterThan(300000);
      expect(s.amount).toBeLessThan(970000); // < surcoût d'un autobus électrique (registre)
      expect(s.document_reference).toMatch(/FICTIF/);
      expect(s.label).toMatch(/FICTIF/);
      expect(s.notes).toContain(MARQUEUR_DEMO);
    }
    // Repris par le moteur, libellé « confirmée par le client (réf. FICTIF…) ».
    const actuel = construireStrategies(vehicules, options).find((x) => x.cle === "plan_actuel")!;
    const bus = actuel.plan!.vehicules.find((v) => v.id === "B-03")!;
    expect(bus.subventionsAlternative!.some((x) => /confirmée par le client \(réf\. FICTIF/.test(x.libelle))).toBe(true);
  });

  it("plan actuel cohérent : électrique là où c'est pertinent, hydrogène pour un seul camion lourd justifié par l'hiver", () => {
    const parUnite = new Map(plan.map((p) => [p.unit_number, p.target_technology]));
    for (const v of flotte) {
      const t = parUnite.get(v.unit_number);
      if (["vehicule_leger", "camionnette", "autobus_urbain_12m"].includes(v.category)) expect(t).toBe("bev");
      if (v.category === "camion_moyen") expect(t).toBe(v.annual_km >= SEUIL_KM_CAMION_MOYEN_BEV ? "bev" : "diesel");
    }
    const fcev = plan.filter((p) => p.target_technology === "fcev").map((p) => p.unit_number);
    expect(fcev).toEqual([UNITE_ROUTE_REGIONALE]);
    expect(flotte.find((v) => v.unit_number === UNITE_ROUTE_REGIONALE)!.category).toBe("camion_lourd");
    // Justification : l'électrique ne tient pas l'hiver sur la route régionale.
    const cl01 = vehicules.find((v) => v.unit_number === UNITE_ROUTE_REGIONALE)!;
    expect(evaluerFaisabiliteVehicule(cl01, options).hiver?.verdict).toBe("ne_tient_pas");
  });

  it("démo nuancée : des gains réels sur certains véhicules, des pertes sur d'autres, l'outil tranche", () => {
    const eco = vehicules.map((v) => evaluerFaisabiliteVehicule(v, options).evaluations!.find((e) => e.technologie === "BEV")!.economieActualisee);
    expect(eco.filter((x) => x > 10000).length).toBeGreaterThanOrEqual(10);
    expect(eco.filter((x) => x < -10000).length).toBeGreaterThanOrEqual(5);
    // La PAGTCP confirmée rend au moins un autobus électrique gagnant (Faisabilité = Stratégies).
    const bus = vehicules.filter((v) => v.category === "autobus_urbain_12m").map((v) => evaluerFaisabiliteVehicule(v, options).evaluations!.find((e) => e.technologie === "BEV")!.economieActualisee);
    expect(bus.some((x) => x > 0)).toBe(true);
    const strategies = construireStrategies(vehicules, options);
    const parCle = Object.fromEntries(strategies.map((s) => [s.cle, s]));
    // Économies d'abord : des véhicules retenus dans chaque garage, VAN positive.
    expect(parCle.economies_d_abord.resultat!.vanDifferentielle).toBeGreaterThan(0);
    for (const g of parCle.economies_d_abord.selection!) expect(g.retenus).toBeGreaterThan(0);
    // Le plan du gestionnaire perd de l'argent : l'outil montre pourquoi et quoi changer.
    expect(parCle.plan_actuel.resultat!.vanDifferentielle).toBeLessThan(parCle.economies_d_abord.resultat!.vanDifferentielle);
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

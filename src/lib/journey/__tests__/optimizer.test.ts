import { describe, expect, it } from "vitest";
import {
  anneesPrevuesDe,
  changementsOptimises,
  ecartsAssignation,
  optimiserCalendrier,
  programmesAvecEcheances,
  zContraintesOptimiseur,
  type ContraintesOptimiseurEntree,
  type RaisonDecision,
} from "../optimizer";
import { chiffrerChoix, construireStrategies, strategieRetenue, type VehiculeProjet } from "../strategies";
import { cleGarage } from "../infrastructure";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { CODES_RAISONS, CODES_VIOLATIONS, FAMILLES } from "../optimizer";
import { changementsVehicules } from "../changeLog";

const OPTIONS = {
  anneeReference: 2026,
  horizonAns: 12,
  tauxActualisationNominal: 0.05,
  typeOrganisme: "municipalite" as const,
};

function vehicule(patch: Partial<VehiculeProjet> & { id: string }): VehiculeProjet {
  return {
    unit_number: patch.id.toUpperCase(),
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 30000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    replacement_year: 2027,
    target_technology: null,
    depot: "Nord",
    ...patch,
  };
}

/** Petite flotte : deux garages, une catégorie à reporter, un véhicule
 *  dont l'autonomie hivernale ne tient pas. */
const FLOTTE: VehiculeProjet[] = [
  vehicule({ id: "a", annual_km: 32000, consumption_per_100km: 17 }),
  vehicule({ id: "b", annual_km: 28000, replacement_year: 2028 }),
  vehicule({ id: "c", category: "vehicule_leger", annual_km: 22000, consumption_per_100km: 8.5, depot: "Sud" }),
  vehicule({ id: "d", category: "camion_moyen", annual_km: 30000, consumption_per_100km: 26, depot: "Sud", replacement_year: 2029 }),
  vehicule({ id: "e", category: "deneigeuse", annual_km: 8000, consumption_per_100km: 45, depot: "Sud", replacement_year: 2028 }),
  vehicule({ id: "f", annual_km: 60000, max_daily_km: 600, depot: "Nord" }),
];

const lancer = (contraintes: ContraintesOptimiseurEntree = {}, vehicules = FLOTTE) =>
  optimiserCalendrier({ vehicules, options: OPTIONS, contraintes });

const raisons = (r: ReturnType<typeof lancer>, id: string): RaisonDecision["code"][] =>
  r.decisions.find((d) => d.vehiculeId === id)!.raisons.map((x) => x.code);

describe("optimiseur de calendrier (Phase 5.1)", () => {
  it("sans contrainte : jamais moins bien que les 3 stratégies, chiffres = moteur complet, déterministe", () => {
    const r = lancer();
    const strategies = construireStrategies(FLOTTE, OPTIONS);
    const meilleureExistante = Math.max(...strategies.map((s) => s.resultat!.vanDifferentielle));
    expect(r.strategie!.resultat!.vanDifferentielle).toBeGreaterThanOrEqual(meilleureExistante - 0.01);
    expect(r.strategie!.cle).toBe("optimisee");
    // Contrôle d'intégrité : somme des contributions = re-chiffrage complet
    expect(r.ecartControle).toBeLessThan(0.01);
    // Re-chiffrer les choix donne exactement les mêmes chiffres (même moteur)
    const again = chiffrerChoix(FLOTTE, "optimisee", OPTIONS, (v) => r.choix[v.id] ?? { techno: "diesel", annee: v.replacement_year });
    expect(again.resultat!.vanDifferentielle).toBeCloseTo(r.strategie!.resultat!.vanDifferentielle, 2);
    expect(r.realisable).toBe(true);
    // Déterminisme
    expect(lancer().choix).toEqual(r.choix);
    // Sans avance autorisée, aucun remplacement n'est avancé
    for (const d of r.decisions) expect(d.annee).toBeGreaterThanOrEqual(d.anneePrevue);
  });

  it("catégorie à reporter et autonomie hivernale : jamais électrifiés, raison donnée", () => {
    const r = lancer();
    expect(r.choix.e.techno).toBe("diesel");
    expect(raisons(r, "e")).toContain("diesel_a_reporter");
    expect(r.choix.f.techno).toBe("diesel");
    expect(raisons(r, "f")).toContain("diesel_hiver");
  });

  it("chaque décision est expliquée", () => {
    const r = lancer();
    for (const d of r.decisions) expect(d.raisons.length).toBeGreaterThan(0);
    for (const d of r.decisions.filter((x) => x.techno === "BEV")) {
      const ok = d.raisons.some((x) => x.code === "electrifie_rentable" && x.economie > 0);
      expect(ok).toBe(true);
    }
  });

  it("budget d'investissement : respecté chaque année (vue budgétaire du moteur), reports expliqués", () => {
    const libre = lancer();
    const pic = Math.max(...libre.strategie!.resultat!.vueBudgetaire.slice(0, 12).map((l) => l.investissementAlt));
    const budget = Math.round(pic * 0.75);
    const r = lancer({ budgetInvestissementAnnuel: budget, reportMaxAns: 4 });
    expect(r.violations).toEqual([]);
    expect(r.realisable).toBe(true);
    for (const l of r.strategie!.resultat!.vueBudgetaire.slice(0, 12)) {
      expect(l.investissementAlt).toBeLessThanOrEqual(budget + 0.5);
    }
    // Le budget change le plan (report OU maintien au diesel) et chaque
    // véhicule touché le dit.
    expect(r.choix).not.toEqual(libre.choix);
    expect(
      r.decisions.some((d) => d.raisons.some((x) => x.code === "report_budget" || x.code === "diesel_budget")),
    ).toBe(true);
  });

  it("budget impossible : violation chiffrée année par année et levier « budget » identifié", () => {
    const r = lancer({ budgetInvestissementAnnuel: 1000, reportMaxAns: 0 });
    expect(r.realisable).toBe(false);
    const v = r.violations.find((x) => x.code === "budget_investissement")!;
    expect(v.code === "budget_investissement" && v.depassement).toBeGreaterThan(0);
    expect(r.leviers.find((l) => l.famille === "budget")?.suffit).toBe(true);
  });

  it("places du garage : au plus N bornes ; augmentation prévue → report expliqué par la capacité", () => {
    const flotte = [
      vehicule({ id: "p1", annual_km: 34000, consumption_per_100km: 18 }),
      vehicule({ id: "p2", annual_km: 33000, consumption_per_100km: 18 }),
      vehicule({ id: "p3", annual_km: 32000, consumption_per_100km: 18 }),
    ];
    const libre = lancer({}, flotte);
    expect(Object.values(libre.choix).filter((c) => c.techno === "BEV").length).toBe(3);

    const nord = cleGarage("Nord");
    const r = lancer({ garages: { [nord]: { places: 1 } } }, flotte);
    expect(r.realisable).toBe(true);
    expect(Object.values(r.choix).filter((c) => c.techno === "BEV").length).toBe(1);
    expect(r.decisions.filter((d) => d.techno === "diesel").every((d) => d.raisons.some((x) => x.code === "diesel_capacite"))).toBe(true);

    const r2 = lancer({ garages: { [nord]: { places: 1, augmentation: { annee: 2029, places: 3 } } }, reportMaxAns: 3 }, flotte);
    expect(Object.values(r2.choix).filter((c) => c.techno === "BEV").length).toBe(3);
    const reportes = r2.decisions.filter((d) => d.annee >= 2029);
    expect(reportes.length).toBe(2);
    for (const d of reportes) expect(d.raisons.some((x) => x.code === "report_capacite")).toBe(true);
  });

  it("capacité électrique (kW) : la somme des bornes ne dépasse pas la capacité", () => {
    const nord = cleGarage("Nord");
    const r = lancer({ garages: { [nord]: { capaciteKw: 20 } } });
    const g = r.strategie!.infra.garages.find((x) => x.cle === nord);
    expect(g?.puissanceMaxKw ?? 0).toBeLessThanOrEqual(20);
  });

  it("technologies autorisées par catégorie : respectées", () => {
    const r = lancer({ technologiesParCategorie: { camionnette: ["diesel"] } });
    for (const id of ["a", "b"]) {
      expect(r.choix[id].techno).toBe("diesel");
      expect(raisons(r, id)).toContain("diesel_techno_non_autorisee");
    }
  });

  it("véhicules gardés : année et technologie du plan conservées", () => {
    const flotte = FLOTTE.map((v) => (v.id === "a" ? { ...v, target_technology: "diesel", replacement_year: 2030 } : v));
    const r = lancer({ vehiculesGardes: ["a"], reportMaxAns: 3 }, flotte);
    expect(r.choix.a).toEqual({ annee: 2030, techno: "diesel", anneePrevue: 2030 });
    expect(raisons(r, "a")).toEqual(["garde"]);
  });

  it("cible zéro émission : atteinte si possible ; sinon véhicules manquants chiffrés", () => {
    const r = lancer({ ciblesZe: [{ annee: 2030, part: 0.5 }] });
    expect(r.realisable).toBe(true);
    const i2030 = r.indicateurs.find((x) => x.annee === 2030)!;
    expect(i2030.partZe).toBeGreaterThanOrEqual(0.5);
    // 6 véhicules dont un à reporter et un hors autonomie : 100 % impossible
    const imp = lancer({ ciblesZe: [{ annee: 2030, part: 1 }] });
    expect(imp.realisable).toBe(false);
    const v = imp.violations.find((x) => x.code === "cible_ze");
    expect(v && v.code === "cible_ze" && v.vehiculesManquants).toBe(2);
  });

  it("cible de réduction des GES : respectée l'année visée", () => {
    const r = lancer({ ciblesGes: [{ annee: 2031, reduction: 0.3 }] });
    const i = r.indicateurs.find((x) => x.annee === 2031)!;
    expect(r.realisable).toBe(true);
    expect(i.reductionGes).toBeGreaterThanOrEqual(0.3 - 1e-9);
  });

  it("objectif CO2 : au moins autant de CO2 évité qu'en mode économies", () => {
    const eco = lancer();
    const co2 = lancer({ objectif: "co2" });
    expect(co2.strategie!.resultat!.co2EviteWtwTonnes).toBeGreaterThanOrEqual(eco.strategie!.resultat!.co2EviteWtwTonnes - 1e-6);
  });

  it("date limite de subvention : un achat avancé pour en profiter est expliqué", () => {
    const flotte = [vehicule({ id: "m", category: "camion_moyen", annual_km: 40000, consumption_per_100km: 30, replacement_year: 2029, depot: "Sud" })];
    const r = lancer({ avanceMaxAns: 1 }, flotte);
    // Écocamionnage cesse après 2028 (registre) : l'achat BEV passe en 2028
    if (r.choix.m.techno === "BEV") {
      expect(r.choix.m.annee).toBe(2028);
      expect(raisons(r, "m")).toContain("avance_subvention");
    }
    // Date limite SAISIE plus tôt : appliquée par le résolveur
    const progs = programmesAvecEcheances({ ecocamionnage_v1: "2027-06-30" });
    expect(progs.find((p) => p.id === "ecocamionnage_v1")!.dateFin).toBe("2027-06-30");
    // jamais repoussée au-delà de la date du registre
    expect(programmesAvecEcheances({ ecocamionnage_v1: "2035-01-01" }).find((p) => p.id === "ecocamionnage_v1")!.dateFin).not.toBe("2035-01-01");
  });

  it("appliquer : aperçu avant → après (année ET techno), écarts et stratégie retenue", () => {
    const r = lancer({ budgetInvestissementAnnuel: 200000, reportMaxAns: 4 });
    const changements = changementsOptimises(FLOTTE, r.choix);
    for (const c of changements) {
      const v = FLOTTE.find((x) => x.id === c.vehiculeId)!;
      expect(c.anneeActuelle).toBe(v.replacement_year);
    }
    // Plan après application : aucun écart
    const apres = FLOTTE.map((v) => {
      const c = r.choix[v.id];
      return c ? { ...v, replacement_year: c.annee, target_technology: c.techno === "BEV" ? "bev" : c.techno === "FCEV" ? "fcev" : "diesel" } : v;
    });
    const assignation = { calculeLe: "2026-10-03", vehicules: r.choix };
    expect(ecartsAssignation(apres, assignation)).toBe(0);
    expect(strategieRetenue(apres, "optimisee", OPTIONS, assignation)).toEqual({ cle: "optimisee", ecarts: 0 });
    const modifie = apres.map((v) => (v.id === "a" ? { ...v, replacement_year: 2037 } : v));
    expect(strategieRetenue(modifie, "optimisee", OPTIONS, assignation).ecarts).toBe(1);
    // Relancer après application garde la fenêtre d'origine (années prévues d'origine)
    const relance = optimiserCalendrier({
      vehicules: apres,
      options: OPTIONS,
      contraintes: { budgetInvestissementAnnuel: 200000, reportMaxAns: 4 },
      anneesPrevues: anneesPrevuesDe(assignation),
    });
    expect(relance.strategie!.resultat!.vanDifferentielle).toBeGreaterThanOrEqual(r.strategie!.resultat!.vanDifferentielle - 0.01);
    expect(relance.realisable).toBe(r.realisable);
    for (const d of relance.decisions) expect(d.anneePrevue).toBe(r.choix[d.vehiculeId].anneePrevue);
  });

  it("contraintes validées (zod) : valeurs aberrantes refusées", () => {
    expect(() => zContraintesOptimiseur.parse({ budgetInvestissementAnnuel: -5 })).toThrow();
    expect(() => zContraintesOptimiseur.parse({ ciblesZe: [{ annee: 2030, part: 1.5 }] })).toThrow();
    expect(zContraintesOptimiseur.parse({}).reportMaxAns).toBe(2);
    expect(zContraintesOptimiseur.parse({}).avanceMaxAns).toBe(0);
  });
});

describe("optimiseur : textes et journal", () => {
  it("chaque raison, contrainte et levier a son texte fr ET en", () => {
    for (const l of [fr, en]) {
      const o = l.journey.optimizer as unknown as {
        reasons: Record<string, string>;
        violations: Record<string, string>;
        families: Record<string, string>;
      };
      for (const c of CODES_RAISONS) expect(o.reasons[c], c).toBeTruthy();
      for (const c of CODES_VIOLATIONS) expect(o.violations[c] ?? o.violations[`${c}_other`], c).toBeTruthy();
      for (const f of FAMILLES) expect(o.families[f], f).toBeTruthy();
    }
  });

  it("journal : seuls les champs qui changent, avant → après", () => {
    const c = changementsVehicules([
      { unite: "C-01", anneeAvant: 2027, anneeApres: 2029, cibleAvant: "bev", cibleApres: "bev" },
      { unite: "C-02", anneeAvant: 2028, anneeApres: 2028, cibleAvant: null, cibleApres: "diesel" },
    ]);
    expect(c).toEqual([
      { cible: "C-01", champ: "replacement_year", avant: 2027, apres: 2029 },
      { cible: "C-02", champ: "target_technology", avant: null, apres: "diesel" },
    ]);
  });
});

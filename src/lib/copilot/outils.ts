/**
 * Copilote de projet (Phase 5.2) — EXÉCUTION des outils dans le
 * navigateur, avec LE moteur TCO (src/lib/tco) et l'optimiseur
 * déterministe (src/lib/journey/optimizer). Logique PURE et testée : les
 * résultats sont des données JSON, chaque valeur porte sa source (étape,
 * version du moteur, hypothèse et date). Les définitions des outils
 * (envoyées à Claude) sont dans supabase/functions/_shared/copilotTools.ts.
 *
 * Minimisation (Loi 25) : seules les données nécessaires au calcul
 * quittent le navigateur (unités, catégories, kilométrages, années,
 * garages) — ni NIV, ni notes, ni service, ni personnes assignées.
 */
import { z } from "zod";
import {
  ENGINE_VERSION,
  LISTE_HYPOTHESES,
  PROGRAMMES,
  analyserSensibilite,
  calculerPlan,
  statutEffectif,
  type PlanTcoEntree,
  type ResultatPlan,
} from "@/lib/tco";
import {
  construireStrategie,
  construireStrategies,
  type CibleVehicule,
  type OptionsStrategie,
  type StrategieConstruite,
  type VehiculeProjet,
} from "@/lib/journey/strategies";
import { BUDGET_OPTIMISEUR_MS,
  changementsOptimises,
  contraintesParDefaut,
  optimiserCalendrier,
  type AssignationOptimisee,
  type ContraintesOptimiseur,
  type ResultatOptimisation,
} from "@/lib/journey/optimizer";
import { SECTIONS_PROJET } from "../../../supabase/functions/_shared/copilotTools";
import { investissementCompare } from "@/lib/journey/synthese";

export interface TacheResume {
  titre: string;
  statut: string;
  echeance: string | null;
  annee: number | null;
}

export interface SnapshotProjet {
  projet: { id: string; nom: string; horizonAns: number; anneeReference: number; tauxActualisation: number };
  strategieRetenue: string | null;
  vehicules: VehiculeProjet[];
  options: OptionsStrategie;
  contraintes: ContraintesOptimiseur | null;
  assignation: AssignationOptimisee | null;
  taches: TacheResume[];
  /** Date du jour (ISO) — statut des programmes. */
  aujourdhui: string;
}

/** Une proposition d'action : aperçu avant → après, appliquée seulement
 *  par l'utilisateur après confirmation (jamais par l'IA). */
export interface PropositionCopilote {
  id: string;
  type: "plan" | "optimisee";
  resume: string;
  changements: {
    vehiculeId: string;
    unite: string;
    anneeAvant: number | null;
    anneeApres: number | null;
    cibleAvant: string | null;
    cibleApres: string;
  }[];
  /** Pour une solution optimisée : ce qu'il faut enregistrer à l'application. */
  optimisee?: { contraintes: ContraintesOptimiseur; choix: ResultatOptimisation["choix"] };
}

const arrondi = (x: number, d = 0) => {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
};
const sourceMoteur = (etape: string, r: ResultatPlan | null) =>
  `${etape} — moteur TCO ${ENGINE_VERSION}${r ? `, empreinte ${r.empreinteEntree.slice(0, 10)}` : ""}`;

function metriques(s: StrategieConstruite) {
  const r = s.resultat;
  if (!r) return null;
  return {
    economie_van: arrondi(r.vanDifferentielle),
    tco_strategie: arrondi(r.alternative.tcoActualise),
    tco_statu_quo: arrondi(r.reference.tcoActualise),
    co2_evite_cycle_complet_t: arrondi(r.co2EviteWtwTonnes, 1),
    co2_evite_pot_echappement_t: arrondi(r.co2EviteTtwTonnes, 1),
    recuperation_ans: r.paybackActualise.annees,
    recuperation_jamais_raison: r.paybackActualise.code,
    infrastructure: arrondi(s.infraCapex),
    subventions: arrondi(s.subventionsTotal),
    vehicules: s.nbVehicules,
    vehicules_zero_emission: s.nbZeroEmission,
    horizon_ans: r.horizonAns,
  };
}

const uniteDe = (snap: SnapshotProjet, id: string) => snap.vehicules.find((v) => v.id === id)?.unit_number ?? id;
const CIBLE: Record<string, CibleVehicule> = { BEV: "bev", FCEV: "fcev", diesel: "diesel" };

function lireProjet(snap: SnapshotProjet, sections: string[]) {
  const plan = construireStrategie(snap.vehicules, "plan_actuel", snap.options);
  const r = plan.resultat;
  const out: Record<string, unknown> = {};
  if (sections.includes("resume")) {
    out.resume = {
      projet: snap.projet.nom,
      annee_reference: snap.projet.anneeReference,
      horizon_ans: snap.projet.horizonAns,
      fin_horizon: snap.projet.anneeReference + snap.projet.horizonAns,
      taux_actualisation_pct: arrondi(snap.projet.tauxActualisation * 100, 2),
      strategie_retenue: snap.strategieRetenue,
      plan: metriques(plan),
      vehicules_exclus_categorie_autre: plan.exclusions.length,
      vehicules_hors_horizon: plan.horsHorizon.map((h) => ({ unite: uniteDe(snap, h.id), annee: h.anneeRemplacement })),
      source: sourceMoteur("Étape Plan (cibles et années du plan actuel)", r),
    };
  }
  if (sections.includes("flotte")) {
    out.flotte = {
      vehicules: snap.vehicules.map((v) => ({
        unite: v.unit_number ?? v.id,
        categorie: v.category,
        carburant: v.fuel_type,
        km_an: v.annual_km,
        conso_100km: v.consumption_per_100km,
        source_conso: v.consumption_source,
        km_jour_max: v.max_daily_km ?? null,
        classe_pnbv: v.gvwr_class ?? null,
        garage: v.depot ?? null,
        annee_remplacement: v.replacement_year,
        cible: v.target_technology,
      })),
      source: "Étape Flotte (Ma flotte + choix du projet)",
    };
  }
  if (sections.includes("garages")) {
    out.garages = {
      infrastructure_totale: arrondi(plan.infra.totalCapex),
      garages: plan.infra.garages.map((g) => ({
        garage: g.depot,
        bornes: g.bornes,
        puissance_bornes_kw: g.puissanceMaxKw,
        puissance_disponible_kw: g.raccordement.kwDisponibles,
        puissance_disponible_source: g.raccordement.kwDisponiblesSource,
        raccordement: arrondi(g.raccordement.cout),
        raccordement_source: g.raccordement.source,
        station_h2: arrondi(g.capexStationH2),
        total: arrondi(g.capexTotal),
        mise_en_service: g.anneeMiseEnServiceRecharge != null ? snap.projet.anneeReference + g.anneeMiseEnServiceRecharge : null,
      })),
      source: sourceMoteur("Étape Plan — infrastructure par garage (registre : bornes, paliers de raccordement « estimation »)", r),
    };
  }
  if (sections.includes("plan") && r) {
    const inv = investissementCompare(r);
    out.plan = {
      // Audit, point 7 : investissement brut À CÔTÉ de celui du statu quo.
      investissement_total: arrondi(inv.brut),
      investissement_statu_quo: arrondi(inv.statuQuo),
      ecart_investissement_vs_statu_quo: arrondi(inv.surcout),
      budget_annuel: r.vueBudgetaire.slice(0, r.horizonAns).map((l) => ({
        annee: l.annee,
        investissement: arrondi(l.investissementAlt),
        subventions: arrondi(l.subventionsAlt),
        reste_a_financer: arrondi(l.resteAFinancerAlt),
        fonctionnement: arrondi(l.fonctionnementAlt),
        ecart_vs_statu_quo: arrondi(l.ecart),
      })),
      remplacements: snap.vehicules
        .filter((v) => v.replacement_year != null)
        .map((v) => ({ unite: v.unit_number ?? v.id, annee: v.replacement_year, cible: v.target_technology ?? "diesel" })),
      source: sourceMoteur("Étape Plan — vue budgétaire", r),
    };
  }
  if (sections.includes("strategies")) {
    const strategies = construireStrategies(snap.vehicules, snap.options);
    out.strategies = {
      strategies: strategies.map((s) => ({ strategie: s.cle, ...metriques(s) })),
      contraintes_optimiseur_enregistrees: snap.contraintes,
      source: sourceMoteur("Étape Stratégies", strategies[0]?.resultat ?? null),
    };
  }
  if (sections.includes("subventions")) {
    out.subventions = {
      par_vehicule: Object.entries(plan.explicationsSubventions).map(([id, expl]) => ({
        unite: uniteDe(snap, id),
        programmes: expl.map((e) => ({
          programme: e.programme,
          montant: arrondi(e.montant),
          statut: e.statut,
          raisons: e.raisons.map((x) => x.code),
        })),
      })),
      total_plan: arrondi(plan.subventionsTotal),
      avertissements: plan.avertissementsSubventions.slice(0, 6),
      source: "Étape Financement — registre des programmes (statut calculé, date de vérification par programme)",
    };
  }
  if (sections.includes("taches")) {
    out.taches = {
      taches: snap.taches.slice(0, 40).map((t) => ({ titre: t.titre.slice(0, 120), statut: t.statut, echeance: t.echeance, annee: t.annee })),
      source: "Étape Suivi",
    };
  }
  return out;
}

const zSelecteur = z.object({ unites: z.array(z.string()).optional(), categories: z.array(z.string()).optional() });
const zSimuler = z
  .object({
    prix: z
      .object({
        carburants_pct: z.number().min(-90).max(500).optional(),
        electricite_pct: z.number().min(-90).max(500).optional(),
        hydrogene_pct: z.number().min(-90).max(500).optional(),
      })
      .strict()
      .optional(),
    decaler: zSelecteur.extend({ ans: z.number().int().min(-10).max(15) }).strict().optional(),
    technologie: zSelecteur.extend({ cible: z.enum(["diesel", "bev", "fcev"]) }).strict().optional(),
    stress_test: z.boolean().optional(),
  })
  .strict();

const vise = (v: VehiculeProjet, s: { unites?: string[]; categories?: string[] }) => {
  const parUnite = !!s.unites?.length && s.unites.some((u) => u.toLocaleLowerCase("fr") === (v.unit_number ?? "").toLocaleLowerCase("fr"));
  const parCategorie = !!s.categories?.length && s.categories.includes(v.category);
  const aucunFiltre = !s.unites?.length && !s.categories?.length;
  return aucunFiltre || parUnite || parCategorie;
};

/** Plan du moteur avec les prix de l'énergie modifiés (simulation). */
function planAvecPrix(plan: PlanTcoEntree, prix: z.infer<typeof zSimuler>["prix"]): PlanTcoEntree {
  if (!prix) return plan;
  const p = plan.parametres;
  const f = (pct?: number) => 1 + (pct ?? 0) / 100;
  return {
    ...plan,
    parametres: {
      ...p,
      prixAnnee0: {
        ...p.prixAnnee0,
        dieselParL: p.prixAnnee0.dieselParL * f(prix.carburants_pct),
        ...(p.prixAnnee0.essenceParL != null ? { essenceParL: p.prixAnnee0.essenceParL * f(prix.carburants_pct) } : {}),
        electriciteEffectiveParKwh: p.prixAnnee0.electriciteEffectiveParKwh * f(prix.electricite_pct),
        h2LivreParKg: p.prixAnnee0.h2LivreParKg * f(prix.hydrogene_pct),
      },
    },
  };
}

function simuler(snap: SnapshotProjet, entree: z.infer<typeof zSimuler>, propositions: Map<string, PropositionCopilote>) {
  const actuel = construireStrategie(snap.vehicules, "plan_actuel", snap.options);
  const modifies = snap.vehicules.map((v) => {
    let w = v;
    if (entree.decaler && vise(v, entree.decaler)) {
      const base = v.replacement_year ?? snap.projet.anneeReference;
      w = { ...w, replacement_year: Math.max(base + entree.decaler.ans, snap.projet.anneeReference) };
    }
    if (entree.technologie && vise(v, entree.technologie)) w = { ...w, target_technology: entree.technologie.cible };
    return w;
  });
  const simule = construireStrategie(modifies, "plan_actuel", snap.options);
  const resultatSimule = simule.plan ? calculerPlan(planAvecPrix(simule.plan, entree.prix)) : null;
  const ma = metriques(actuel)!;
  const msBase = metriques(simule);
  const ms = msBase && resultatSimule
    ? {
        ...msBase,
        economie_van: arrondi(resultatSimule.vanDifferentielle),
        tco_strategie: arrondi(resultatSimule.alternative.tcoActualise),
        tco_statu_quo: arrondi(resultatSimule.reference.tcoActualise),
        co2_evite_cycle_complet_t: arrondi(resultatSimule.co2EviteWtwTonnes, 1),
        co2_evite_pot_echappement_t: arrondi(resultatSimule.co2EviteTtwTonnes, 1),
        recuperation_ans: resultatSimule.paybackActualise.annees,
        recuperation_jamais_raison: resultatSimule.paybackActualise.code,
      }
    : null;
  const ecarts = ms
    ? {
        economie_van: arrondi(ms.economie_van - ma.economie_van),
        co2_evite_cycle_complet_t: arrondi(ms.co2_evite_cycle_complet_t - ma.co2_evite_cycle_complet_t, 1),
        infrastructure: arrondi(ms.infrastructure - ma.infrastructure),
        subventions: arrondi(ms.subventions - ma.subventions),
      }
    : null;

  let stress = null;
  if (entree.stress_test && simule.plan) {
    const planPrix = planAvecPrix(simule.plan, entree.prix);
    const a = analyserSensibilite(planPrix);
    const gagnants = [a.scenarios.prudent, a.scenarios.central, a.scenarios.favorable].filter((x) => x.van > 0).length;
    stress = {
      scenario_prudent_van: arrondi(a.scenarios.prudent.van),
      scenario_central_van: arrondi(a.scenarios.central.van),
      scenario_favorable_van: arrondi(a.scenarios.favorable.van),
      scenarios_gagnants: gagnants,
      scenarios_total: 3,
      niveau_risque: a.niveauRisque,
      source: "Stress test — moteur relancé aux bornes sourcées du registre (§7)",
    };
  }

  // Proposition : seulement si des véhicules changent (les prix ne s'appliquent pas au plan).
  const changements = modifies
    .map((v, i) => ({ avant: snap.vehicules[i], apres: v }))
    .filter(({ avant, apres }) => avant.replacement_year !== apres.replacement_year || avant.target_technology !== apres.target_technology)
    .map(({ avant, apres }) => ({
      vehiculeId: avant.id,
      unite: avant.unit_number ?? avant.id,
      anneeAvant: avant.replacement_year,
      anneeApres: apres.replacement_year,
      cibleAvant: avant.target_technology,
      cibleApres: apres.target_technology ?? "diesel",
    }));
  let proposition = null;
  if (changements.length > 0) {
    const id = `sim-${propositions.size + 1}`;
    const p: PropositionCopilote = {
      id,
      type: "plan",
      resume: `${changements.length} ${changements.length === 1 ? "véhicule" : "véhicules"} : année et/ou technologie cible`,
      changements,
    };
    propositions.set(id, p);
    proposition = { id, vehicules_modifies: changements.length, changements: changements.slice(0, 20) };
  }

  return {
    plan_actuel: ma,
    plan_simule: ms,
    ecarts,
    variations_prix_pct: entree.prix ?? null,
    stress_test: stress,
    proposition,
    note: entree.prix ? "Les variations de prix sont une simulation : elles ne modifient pas le plan." : undefined,
    source: sourceMoteur("Simulation sur le plan actuel", resultatSimule ?? null),
  };
}

const zOptimiser = z
  .object({
    objectif: z.enum(["economies", "co2"]).optional(),
    budget_investissement_annuel: z.number().min(0).optional(),
    budget_reste_a_financer_annuel: z.number().min(0).optional(),
    cible_ze: z.object({ annee: z.number().int(), part_pct: z.number().min(0).max(100) }).strict().optional(),
    cible_ges: z.object({ annee: z.number().int(), reduction_pct: z.number().min(0).max(100) }).strict().optional(),
    report_max_ans: z.number().int().min(0).max(10).optional(),
  })
  .strict();

function optimiser(snap: SnapshotProjet, entree: z.infer<typeof zOptimiser>, propositions: Map<string, PropositionCopilote>) {
  const base = snap.contraintes ?? contraintesParDefaut();
  const contraintes: ContraintesOptimiseur = {
    ...base,
    ...(entree.objectif ? { objectif: entree.objectif } : {}),
    ...(entree.budget_investissement_annuel != null ? { budgetInvestissementAnnuel: entree.budget_investissement_annuel } : {}),
    ...(entree.budget_reste_a_financer_annuel != null ? { budgetResteAFinancerAnnuel: entree.budget_reste_a_financer_annuel } : {}),
    ...(entree.cible_ze ? { ciblesZe: [{ annee: entree.cible_ze.annee, part: entree.cible_ze.part_pct / 100 }] } : {}),
    ...(entree.cible_ges ? { ciblesGes: [{ annee: entree.cible_ges.annee, reduction: entree.cible_ges.reduction_pct / 100 }] } : {}),
    ...(entree.report_max_ans != null ? { reportMaxAns: entree.report_max_ans } : {}),
  };
  const anneesPrevues = snap.assignation
    ? new Map(Object.entries(snap.assignation.vehicules).map(([id, c]) => [id, c.anneePrevue]))
    : undefined;
  // Borné dans le temps comme dans l'interface (ajustement C de l'audit).
  const r = optimiserCalendrier({ vehicules: snap.vehicules, options: snap.options, contraintes, anneesPrevues, budgetMs: BUDGET_OPTIMISEUR_MS });
  const changements = changementsOptimises(snap.vehicules, r.choix);
  const id = `opt-${propositions.size + 1}`;
  if (changements.length > 0) {
    propositions.set(id, {
      id,
      type: "optimisee",
      resume: `${changements.length} ${changements.length === 1 ? "véhicule" : "véhicules"} : année et/ou technologie (solution optimisée)`,
      changements: changements.map((c) => ({
        vehiculeId: c.vehiculeId,
        unite: uniteDe(snap, c.vehiculeId),
        anneeAvant: c.anneeActuelle,
        anneeApres: c.anneeNouvelle,
        cibleAvant: c.cibleActuelle,
        cibleApres: c.cibleNouvelle,
      })),
      optimisee: { contraintes, choix: r.choix },
    });
  }
  return {
    resultat: r.strategie ? metriques(r.strategie) : null,
    realisable: r.realisable,
    contraintes_utilisees: {
      objectif: contraintes.objectif,
      budget_investissement_annuel: contraintes.budgetInvestissementAnnuel ?? null,
      budget_reste_a_financer_annuel: contraintes.budgetResteAFinancerAnnuel ?? null,
      cibles_ze: contraintes.ciblesZe.map((c) => ({ annee: c.annee, part_pct: arrondi(c.part * 100, 1) })),
      cibles_ges: contraintes.ciblesGes.map((c) => ({ annee: c.annee, reduction_pct: arrondi(c.reduction * 100, 1) })),
      report_max_ans: contraintes.reportMaxAns,
    },
    contraintes_non_respectees: r.violations.slice(0, 10).map((v) => {
      const { code, ...reste } = v;
      return { code, ...Object.fromEntries(Object.entries(reste).map(([k, x]) => [k, typeof x === "number" ? arrondi(x, 3) : x])) };
    }),
    leviers: r.leviers.map((l) => ({ famille: l.famille, suffit: l.suffit, economie_van_si_leve: l.van != null ? arrondi(l.van) : null })),
    indicateurs: r.indicateurs.map((i) => ({
      annee: i.annee,
      investissement: arrondi(i.investissement),
      reste_a_financer: arrondi(i.resteAFinancer),
      part_ze_pct: arrondi(i.partZe * 100, 1),
      reduction_ges_pct: arrondi(i.reductionGes * 100, 1),
    })),
    decisions_modifiees: r.decisions
      .filter((d) => d.annee !== d.anneePrevue || d.techno !== d.technoPrevue)
      .slice(0, 20)
      .map((d) => ({
        unite: d.unite,
        prevu: { annee: d.anneePrevue, techno: d.technoPrevue },
        optimise: { annee: d.annee, techno: d.techno },
        raisons: d.raisons.map((x) => {
          const { code, ...reste } = x as Record<string, unknown> & { code: string };
          return { code, ...Object.fromEntries(Object.entries(reste).map(([k, v]) => [k, typeof v === "number" ? arrondi(v) : v])) };
        }),
      })),
    proposition: changements.length > 0 ? { id, vehicules_modifies: changements.length } : null,
    source: sourceMoteur("Optimiseur déterministe (étape Stratégies, 4e stratégie)", r.strategie?.resultat ?? null),
  };
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");

function consulterHypotheses(recherche: string) {
  const mots = sansAccents(recherche).split(/\s+/).filter((m) => m.length >= 2);
  const trouvees = LISTE_HYPOTHESES.filter((h) => {
    const texte = sansAccents(`${h.id} ${h.description}`);
    return mots.length === 0 || mots.some((m) => texte.includes(m));
  }).slice(0, 10);
  return {
    hypotheses: trouvees.map((h) => ({
      id: h.id,
      description: h.description,
      valeur: h.valeur,
      unite: h.unite,
      plage: h.plage,
      statut: h.statut,
      date_verification: h.dateVerification,
      source: `Registre d'hypothèses — ${h.id} : ${h.source.organisme}, ${h.source.document} (vérifié le ${h.dateVerification}, statut ${h.statut})`,
      url: h.source.url,
    })),
  };
}

function consulterProgrammes(aujourdhui: string) {
  return {
    programmes: PROGRAMMES.map((p) => ({
      id: p.id,
      nom: p.nom,
      palier: p.palier,
      cible: p.cible,
      statut: statutEffectif(p, aujourdhui),
      date_fin: p.dateFin ?? null,
      organismes_admissibles: p.organismesAdmissibles,
      limites: p.limites ?? null,
      source: `Registre des programmes — ${p.nom} (vérifié le ${p.dateVerification}, statut ${p.statutVerification})`,
      url: p.source.url,
    })),
  };
}

const zLire = z.object({ sections: z.array(z.enum(SECTIONS_PROJET)).min(1) }).strict();
const zRecherche = z.object({ recherche: z.string().max(200) }).strict();

/** Exécute un outil ; renvoie le résultat sérialisé et une éventuelle erreur. */
export function executerOutil(
  nom: string,
  entree: unknown,
  snap: SnapshotProjet,
  propositions: Map<string, PropositionCopilote>,
): { contenu: string; erreur: boolean } {
  try {
    let resultat: unknown;
    switch (nom) {
      case "lire_projet":
        resultat = lireProjet(snap, zLire.parse(entree).sections);
        break;
      case "simuler":
        resultat = simuler(snap, zSimuler.parse(entree ?? {}), propositions);
        break;
      case "optimiser":
        resultat = optimiser(snap, zOptimiser.parse(entree ?? {}), propositions);
        break;
      case "consulter_hypotheses":
        resultat = consulterHypotheses(zRecherche.parse(entree).recherche);
        break;
      case "consulter_programmes":
        resultat = consulterProgrammes(snap.aujourdhui);
        break;
      default:
        return { contenu: JSON.stringify({ erreur: `outil inconnu : ${nom}` }), erreur: true };
    }
    return { contenu: JSON.stringify(resultat), erreur: false };
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : e instanceof Error ? e.message : "erreur";
    return { contenu: JSON.stringify({ erreur: message }), erreur: true };
  }
}

export const OUTILS_IMPLEMENTES = ["lire_projet", "simuler", "optimiser", "consulter_hypotheses", "consulter_programmes"];

/** Données du projet transmises comme contexte (faits stables du tour). */
export function contexteCopilote(snap: SnapshotProjet) {
  return {
    projet: snap.projet.nom,
    annee_reference: snap.projet.anneeReference,
    horizon_ans: snap.projet.horizonAns,
    fin_horizon: snap.projet.anneeReference + snap.projet.horizonAns,
    vehicules_du_projet: snap.vehicules.length,
    strategie_retenue: snap.strategieRetenue,
    etapes: ["1 Flotte", "2 Faisabilité", "3 Stratégies", "4 Plan", "5 Financement", "6 Rapports", "7 Suivi"],
    nombre_strategies: 4,
    scenarios_stress_test: 3,
    version_moteur: ENGINE_VERSION,
    unites: snap.vehicules.map((v) => v.unit_number ?? v.id),
    categories: [...new Set(snap.vehicules.map((v) => v.category))],
    garages: [...new Set(snap.vehicules.map((v) => v.depot).filter(Boolean))],
    date_du_jour: snap.aujourdhui,
  };
}

export { CIBLE };

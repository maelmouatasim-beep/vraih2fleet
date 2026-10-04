/**
 * Phase 5, point 1 — OPTIMISEUR DE CALENDRIER (algorithme DÉTERMINISTE,
 * aucune IA, aucun hasard).
 *
 * Il propose, pour chaque véhicule du projet, l'année de remplacement et
 * la technologie (diesel = remplacement à l'identique, BEV, FCEV) qui
 * maximisent les économies (VAN différentielle) — ou le CO2e évité sur le
 * cycle complet, au choix — en respectant TOUTES les contraintes saisies :
 * budgets annuels (investissement et/ou reste à financer), cibles de part
 * zéro émission ou de réduction de GES par année, véhicules gardés tels
 * quels, capacité électrique (kW) et places de recharge de chaque garage,
 * dates limites des subventions, technologies autorisées par catégorie et
 * fenêtre de calendrier (avance / report maximal).
 *
 * Chiffres : TOUS viennent du moteur src/lib/tco. Le moteur est additif
 * par véhicule et par site d'infrastructure (même code que l'écran) :
 * chaque option (véhicule × année × technologie) est chiffrée une fois par
 * le moteur, chaque site d'infrastructure aussi ; la recherche combine ces
 * contributions exactes, puis la solution retenue est RE-CHIFFRÉE en entier
 * par le moteur (chiffrerChoix, infrastructure par garage comprise) — ce
 * sont ces chiffres-là qui s'affichent, et les contraintes y sont
 * re-vérifiées.
 *
 * Recherche : amorces = statu quo diesel + les 3 stratégies existantes
 * (l'optimiseur ne fait donc jamais moins bien qu'une stratégie existante
 * qui respecte les contraintes), puis recherche locale à meilleure
 * amélioration (un véhicule à la fois, et ajout groupé par garage pour
 * franchir le coût fixe des bornes et du raccordement). Ordre
 * lexicographique : contraintes dures (budgets, garages) d'abord, puis
 * cibles (ZE, GES), puis objectif.
 *
 * Convention de calendrier (méthodologie §10.11) : la VAN compare chaque
 * véhicule à un diesel neuf acheté LA MÊME ANNÉE. Avancer un remplacement
 * avant la fin de vie prévue suppose de retirer le véhicule actuel plus
 * tôt, ce que le moteur ne chiffre pas (valeur résiduelle de l'ancien
 * véhicule) : l'avance est donc désactivée par défaut (avanceMaxAns = 0).
 */
import { z } from "zod";
import { calculerPlan, parametresParDefaut, type PlanTcoEntree, type VehiculePlan } from "@/lib/tco";
import { PROGRAMMES, type ProgrammeSubvention } from "@/lib/tco/subsidy-programs";
import { categorieMoteur, raisonAReporter } from "./categories";
import { analyserDonneesVehicule, evaluerFaisabiliteVehicule } from "./feasibility";
import {
  BORNES,
  calculerRaccordement,
  cleGarage,
  PALIERS_RACCORDEMENT,
  planifierInfrastructure,
  sitesInfraMoteur,
  TYPE_BORNE_PAR_CATEGORIE,
  type InfraGarage,
  type VehiculeInfra,
} from "./infrastructure";
import { marchesRaccordement, proposerSousEnsembles } from "./selectionGarage";
import {
  chiffrerChoix,
  construireStrategie,
  entreeVehiculeMoteur,
  type OptionsStrategie,
  type StrategieConstruite,
  type TechnoAlternative,
  type VehiculeProjet,
} from "./strategies";

// ---------------------------------------------------------------------------
// Contraintes (validées : elles viennent de la base ou du copilote)
// ---------------------------------------------------------------------------

const zTechno = z.enum(["diesel", "BEV", "FCEV"]);
const zAnnee = z.number().int().min(2000).max(2100);
const zMontant = z.number().finite().nonnegative();

export const zContrainteGarage = z.object({
  /** Puissance maximale installable pour la recharge (kW, bornes à pleine
   *  puissance, sans gestion de charge). Absente = pas de limite (la mise
   *  à niveau du raccordement est chiffrée). */
  capaciteKw: zMontant.nullable().optional(),
  /** Nombre maximal de bornes (une par véhicule électrique). */
  places: z.number().int().nonnegative().nullable().optional(),
  /** Augmentation prévue (travaux) à partir d'une année. */
  augmentation: z
    .object({
      annee: zAnnee,
      capaciteKw: zMontant.nullable().optional(),
      places: z.number().int().nonnegative().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type ContrainteGarage = z.infer<typeof zContrainteGarage>;

export const zContraintesOptimiseur = z.object({
  objectif: z.enum(["economies", "co2"]).default("economies"),
  /** Investissement annuel maximal (achats + infrastructure, $ courants, taxes non récupérables comprises). */
  budgetInvestissementAnnuel: zMontant.nullable().optional(),
  /** Reste à financer annuel maximal (investissement − subventions de l'année). */
  budgetResteAFinancerAnnuel: zMontant.nullable().optional(),
  /** Part minimale de véhicules zéro émission (0..1) livrés au plus tard l'année donnée. */
  ciblesZe: z.array(z.object({ annee: zAnnee, part: z.number().min(0).max(1) })).default([]),
  /** Réduction minimale (0..1) des GES de la flotte (cycle complet) l'année donnée, vs flotte diesel. */
  ciblesGes: z.array(z.object({ annee: zAnnee, reduction: z.number().min(0).max(1) })).default([]),
  /** Véhicules gardés tels quels : année et technologie du plan actuel. */
  vehiculesGardes: z.array(z.string()).default([]),
  /** Par garage (clé cleGarage) : capacité électrique et places. */
  garages: z.record(zContrainteGarage).default({}),
  /** Date limite saisie par programme (id du registre), ISO AAAA-MM-JJ. */
  echeancesSubventions: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).default({}),
  /** Technologies autorisées par catégorie de la flotte (absente = diesel + BEV). */
  technologiesParCategorie: z.record(z.array(zTechno)).default({}),
  /** Avance maximale sur l'année prévue (défaut 0 : voir l'en-tête). */
  avanceMaxAns: z.number().int().min(0).max(10).default(0),
  /** Report maximal après l'année prévue. */
  reportMaxAns: z.number().int().min(0).max(10).default(2),
});
export type ContraintesOptimiseur = z.infer<typeof zContraintesOptimiseur>;
export type ContraintesOptimiseurEntree = z.input<typeof zContraintesOptimiseur>;

export const TECHNOS_PAR_DEFAUT: TechnoAlternative[] = ["diesel", "BEV"];

// ---------------------------------------------------------------------------
// Résultat
// ---------------------------------------------------------------------------

export type Violation =
  | { code: "budget_investissement"; annee: number; montant: number; budget: number; depassement: number }
  | { code: "budget_reste"; annee: number; montant: number; budget: number; depassement: number }
  | { code: "capacite_kw"; garage: string | null; annee: number; demande: number; capacite: number; depassement: number }
  | { code: "capacite_places"; garage: string | null; annee: number; demande: number; places: number; depassement: number }
  | { code: "cible_ze"; annee: number; demande: number; atteint: number; vehiculesManquants: number }
  | { code: "cible_ges"; annee: number; demande: number; atteint: number; tonnesManquantes: number }
  | { code: "aucune_techno"; vehiculeId: string };

export type FamilleContrainte = "budget" | "capacite" | "technologies" | "calendrier" | "vehicules_gardes";

/** Diagnostic d'infaisabilité : la famille de contraintes, une fois levée,
 *  suffit-elle à tout respecter ? (et avec quel résultat) */
export interface Levier {
  famille: FamilleContrainte;
  suffit: boolean;
  /** Violations restantes si cette famille est levée. */
  violationsRestantes: number;
  van: number | null;
}

export type RaisonDecision =
  | { code: "garde" }
  | { code: "electrifie_rentable"; economie: number }
  | { code: "electrifie_co2"; tonnes: number; cout: number }
  | { code: "electrifie_cible"; cout: number }
  | { code: "techno_imposee" }
  | { code: "subvention_avant_fin"; programme: string; dateFin: string }
  | { code: "avance_subvention"; programme: string; dateFin: string }
  | { code: "avance_avantageuse"; gain: number }
  | { code: "report_budget"; budget: "investissement" | "reste" }
  | { code: "report_capacite"; garage: string | null }
  | { code: "report_avantageux"; gain: number }
  | { code: "diesel_non_rentable"; surcout: number }
  | { code: "diesel_budget"; budget: "investissement" | "reste" }
  | { code: "diesel_capacite"; garage: string | null }
  | { code: "diesel_techno_non_autorisee" }
  | { code: "diesel_hiver" }
  | { code: "diesel_a_reporter" };

export interface DecisionVehicule {
  vehiculeId: string;
  unite: string | null;
  garage: string | null;
  anneePrevue: number;
  annee: number;
  techno: TechnoAlternative;
  /** Technologie cible actuelle du plan (diesel si aucune). */
  technoPrevue: TechnoAlternative;
  raisons: RaisonDecision[];
}

export interface IndicateursAnnee {
  annee: number;
  investissement: number;
  resteAFinancer: number;
  /** Part ZE (0..1) des véhicules du projet livrés au plus tard cette année. */
  partZe: number;
  /** Réduction (0..1) des GES cycle complet de l'année vs flotte diesel. */
  reductionGes: number;
}

export interface ResultatOptimisation {
  contraintes: ContraintesOptimiseur;
  /** Solution re-chiffrée en entier par le moteur (null si rien d'évaluable). */
  strategie: StrategieConstruite | null;
  /** Choix par véhicule évalué. */
  choix: Record<string, { annee: number; techno: TechnoAlternative; anneePrevue: number }>;
  decisions: DecisionVehicule[];
  realisable: boolean;
  violations: Violation[];
  /** Diagnostic (seulement si non réalisable). */
  leviers: Levier[];
  indicateurs: IndicateursAnnee[];
  /** Nombre de véhicules du projet (dénominateur de la part ZE). */
  nbVehiculesProjet: number;
  /** Écart entre la somme des contributions et le re-chiffrage complet ($) — contrôle d'intégrité (≈ 0). */
  ecartControle: number;
}

/** Ce que l'on enregistre au moment d'appliquer la stratégie optimisée. */
export interface AssignationOptimisee {
  calculeLe: string;
  vehicules: Record<string, { annee: number; techno: TechnoAlternative; anneePrevue: number }>;
}

// ---------------------------------------------------------------------------
// Préparation
// ---------------------------------------------------------------------------

/** Registre des programmes avec les dates limites saisies (la plus
 *  restrictive l'emporte ; le résolveur les applique à l'année d'achat). */
export function programmesAvecEcheances(
  echeances: Record<string, string>,
  programmes: ProgrammeSubvention[] = PROGRAMMES,
): ProgrammeSubvention[] {
  return programmes.map((p) => {
    const saisie = echeances[p.id];
    if (!saisie || (p.dateFin && p.dateFin <= saisie)) return p;
    return { ...p, dateFin: saisie };
  });
}

interface OptionChiffree {
  annee: number;
  k: number;
  techno: TechnoAlternative;
  van: number;
  co2: number;
  inv: number[];
  subv: number[];
  /** Émissions annuelles WTW (t) une fois le véhicule livré. */
  tauxAlt: number;
  /** Programmes retenus (id) pour cette option. */
  programmes: string[];
}

interface VehiculeOptim {
  v: VehiculeProjet;
  garage: string;
  depot: string | null;
  anneePrevue: number;
  technoPrevue: TechnoAlternative;
  garde: boolean;
  options: OptionChiffree[];
  /** Index de l'option « plan actuel » (année prévue, techno du plan, si autorisée). */
  tauxRef: number;
  technosRetirees: { hiver: boolean; aReporter: boolean; nonAutorisee: boolean };
  aucuneTechno: boolean;
}

function technoDuPlan(v: VehiculeProjet): TechnoAlternative {
  return v.target_technology === "bev" ? "BEV" : v.target_technology === "fcev" ? "FCEV" : "diesel";
}

interface Relaxations {
  budget?: boolean;
  capacite?: boolean;
  technologies?: boolean;
  calendrier?: boolean;
  vehicules_gardes?: boolean;
}

interface Contexte {
  options: OptionsStrategie;
  contraintes: ContraintesOptimiseur;
  relax: Relaxations;
  H: number;
  ref: number;
  parametres: ReturnType<typeof parametresParDefaut>;
  vehicules: VehiculeOptim[];
  /** Véhicule fictif diesel=diesel (VAN nulle) servant à chiffrer un site seul. */
  factice: VehiculePlan | null;
  cacheSite: Map<string, { van: number; inv: number[] }>;
  cacheGarage: Map<string, GarageEvalue>;
}

function preparer(
  vehicules: VehiculeProjet[],
  options: OptionsStrategie,
  contraintes: ContraintesOptimiseur,
  relax: Relaxations,
  anneesPrevues: Map<string, number | null> | undefined,
): Contexte {
  const H = options.horizonAns;
  const ref = options.anneeReference;
  const opts: OptionsStrategie = {
    ...options,
    programmes: programmesAvecEcheances(contraintes.echeancesSubventions, options.programmes ?? PROGRAMMES),
  };
  const parametres = parametresParDefaut(opts);
  const gardes = new Set(relax.vehicules_gardes ? [] : contraintes.vehiculesGardes);
  const avance = relax.calendrier ? H : contraintes.avanceMaxAns;
  const report = relax.calendrier ? H : contraintes.reportMaxAns;
  const liste: VehiculeOptim[] = [];
  let factice: VehiculePlan | null = null;

  const chiffrerOption = (v: VehiculeProjet, techno: TechnoAlternative, k: number): OptionChiffree => {
    const entree = entreeVehiculeMoteur(v, techno, k, opts)!;
    const r = calculerPlan({ parametres, vehicules: [entree.vehicule], sitesInfra: [] });
    const duree = H - k;
    return {
      annee: ref + k,
      k,
      techno,
      van: r.vanDifferentielle,
      co2: r.co2EviteWtwTonnes,
      inv: r.alternative.flux.investissement,
      subv: r.alternative.flux.subventions,
      tauxAlt: duree > 0 ? r.alternative.emissionsWtwTonnes / duree : 0,
      programmes: (entree.explications ?? []).filter((e) => e.statut !== "exclue").map((e) => e.programmeId),
    };
  };

  for (const v of vehicules) {
    if (!analyserDonneesVehicule(v).defauts) continue;
    const prevueBrute = anneesPrevues?.has(v.id) ? anneesPrevues.get(v.id)! : v.replacement_year;
    const anneePrevue = Math.max(prevueBrute ?? ref, ref);
    if (anneePrevue - ref >= H) continue; // hors horizon : signalé par chiffrerChoix
    const technoPrevue = technoDuPlan(v);
    const garde = gardes.has(v.id);

    // Technologies autorisées (contraintes + physique : catégorie à
    // reporter, autonomie hivernale insuffisante).
    let autorisees: TechnoAlternative[] = relax.technologies
      ? ["diesel", "BEV", "FCEV"]
      : contraintes.technologiesParCategorie[v.category] ?? TECHNOS_PAR_DEFAUT;
    const retirees = { hiver: false, aReporter: false, nonAutorisee: false };
    if (!autorisees.includes("BEV") || !autorisees.includes("FCEV")) retirees.nonAutorisee = true;
    if (raisonAReporter(v.category)) {
      retirees.aReporter = autorisees.some((t) => t !== "diesel");
      autorisees = ["diesel"];
    } else if (autorisees.includes("BEV")) {
      const f = evaluerFaisabiliteVehicule({ ...v, replacement_year: anneePrevue }, opts);
      if (f.hiver?.verdict === "ne_tient_pas") {
        retirees.hiver = true;
        autorisees = autorisees.filter((t) => t !== "BEV");
      }
    }
    let aucuneTechno = false;
    if (autorisees.length === 0) {
      aucuneTechno = true;
      autorisees = ["diesel"];
    }

    const options: OptionChiffree[] = [];
    if (garde) {
      options.push(chiffrerOption(v, technoPrevue, anneePrevue - ref));
    } else {
      const debut = Math.max(ref, anneePrevue - avance);
      const fin = Math.min(ref + H - 1, anneePrevue + report);
      for (let a = debut; a <= fin; a++) {
        for (const t of ["diesel", "BEV", "FCEV"] as const) {
          if (autorisees.includes(t)) options.push(chiffrerOption(v, t, a - ref));
        }
      }
    }
    // Référence (diesel neuf) : véhicule fictif des sites + taux d'émission annuel.
    const diesel0 = entreeVehiculeMoteur(v, "diesel", 0, opts)!.vehicule;
    if (!factice) factice = { ...diesel0, id: "__site__" };
    const r0 = calculerPlan({ parametres, vehicules: [diesel0], sitesInfra: [] });
    const tauxRef = r0.reference.emissionsWtwTonnes / H;

    liste.push({
      v,
      garage: cleGarage(v.depot ?? null),
      depot: v.depot?.trim().replace(/\s+/g, " ") || null,
      anneePrevue,
      technoPrevue,
      garde,
      options,
      tauxRef,
      technosRetirees: retirees,
      aucuneTechno,
    });
  }
  // Ordre stable (déterminisme) : unité puis id.
  liste.sort((a, b) =>
    (a.v.unit_number ?? "").localeCompare(b.v.unit_number ?? "", "fr") || a.v.id.localeCompare(b.v.id),
  );
  return {
    options: opts,
    contraintes,
    relax,
    H,
    ref,
    parametres,
    vehicules: liste,
    factice,
    cacheSite: new Map(),
    cacheGarage: new Map(),
  };
}

// ---------------------------------------------------------------------------
// Infrastructure d'un garage : chiffrée par le moteur (site seul)
// ---------------------------------------------------------------------------

interface GarageEvalue {
  van: number;
  inv: number[];
  infra: InfraGarage | null;
}

function chiffrerSite(ctx: Contexte, capex: number, annee: number): { van: number; inv: number[] } {
  const cle = `${capex.toFixed(4)}|${annee}`;
  const enCache = ctx.cacheSite.get(cle);
  if (enCache) return enCache;
  const f = ctx.factice!;
  const avec = calculerPlan({
    parametres: ctx.parametres,
    vehicules: [f],
    sitesInfra: [{ id: "site", capexAvantTaxes: capex, vehiculeIds: [f.id], anneeMiseEnService: annee }],
  });
  const sans = calculerPlan({ parametres: ctx.parametres, vehicules: [f], sitesInfra: [] });
  const r = {
    van: avec.vanDifferentielle - sans.vanDifferentielle,
    inv: avec.alternative.flux.investissement.map((x, i) => x - sans.alternative.flux.investissement[i]),
  };
  ctx.cacheSite.set(cle, r);
  return r;
}

function evaluerGarage(ctx: Contexte, membres: VehiculeInfra[], signature: string): GarageEvalue {
  const enCache = ctx.cacheGarage.get(signature);
  if (enCache) return enCache;
  const plan = planifierInfrastructure(membres, {
    anneeReference: ctx.ref,
    devisRaccordementProjet: null,
    garages: ctx.options.garages,
  });
  let van = 0;
  const inv = new Array<number>(ctx.H + 1).fill(0);
  for (const site of sitesInfraMoteur(plan)) {
    const s = chiffrerSite(ctx, site.capexAvantTaxes, site.anneeMiseEnService);
    van += s.van;
    for (let n = 0; n <= ctx.H; n++) inv[n] += s.inv[n];
  }
  const r = { van, inv, infra: plan.garages[0] ?? null };
  ctx.cacheGarage.set(signature, r);
  return r;
}

// ---------------------------------------------------------------------------
// État de recherche (incrémental)
// ---------------------------------------------------------------------------

/** [contraintes dures, cibles, objectif, VAN, écart au calendrier prévu]. */
type Score = [dures: number, cibles: number, objectif: number, van: number, ecartCalendrier: number];

function meilleur(a: Score, b: Score): boolean {
  if (Math.abs(a[0] - b[0]) > 1e-9) return a[0] < b[0];
  if (Math.abs(a[1] - b[1]) > 1e-9) return a[1] < b[1];
  const tol = 1e-6 * Math.max(1, Math.abs(a[2]), Math.abs(b[2]));
  if (Math.abs(a[2] - b[2]) > tol) return a[2] > b[2];
  const tolVan = 1e-6 * Math.max(1, Math.abs(a[3]), Math.abs(b[3]));
  if (Math.abs(a[3] - b[3]) > tolVan) return a[3] > b[3];
  // À égalité, le calendrier prévu l'emporte : on ne déplace jamais un
  // remplacement sans raison chiffrée.
  return a[4] < b[4];
}

class Etat {
  idx: number[];
  vanVehicules = 0;
  co2 = 0;
  inv: number[];
  subv: number[];
  /** Émissions WTW de l'alternative par année du plan. */
  ges: number[];
  /** Nombre de véhicules ZE livrés à l'année k du plan. */
  zeParK: number[];
  membres = new Map<string, Map<string, VehiculeInfra>>();
  garages = new Map<string, GarageEvalue>();

  constructor(
    private ctx: Contexte,
    initial: number[],
  ) {
    const H = ctx.H;
    this.idx = new Array(ctx.vehicules.length).fill(-1);
    this.inv = new Array(H + 1).fill(0);
    this.subv = new Array(H + 1).fill(0);
    this.ges = new Array(H + 1).fill(0);
    this.zeParK = new Array(H).fill(0);
    ctx.vehicules.forEach((vo, i) => {
      // avant livraison : le véhicule actuel émet comme la référence
      for (let n = 0; n <= H; n++) this.ges[n] += vo.tauxRef;
      this.poser(i, initial[i]);
    });
  }

  private contribuer(i: number, o: OptionChiffree, signe: 1 | -1) {
    const ctx = this.ctx;
    const vo = ctx.vehicules[i];
    this.vanVehicules += signe * o.van;
    this.co2 += signe * o.co2;
    for (let n = 0; n <= ctx.H; n++) {
      this.inv[n] += signe * o.inv[n];
      this.subv[n] += signe * o.subv[n];
    }
    for (let n = o.k + 1; n <= ctx.H; n++) this.ges[n] += signe * (o.tauxAlt - vo.tauxRef);
    if (o.techno !== "diesel") {
      this.zeParK[o.k] += signe;
      const m = this.membres.get(vo.garage) ?? new Map<string, VehiculeInfra>();
      if (signe > 0) {
        m.set(vo.v.id, {
          id: vo.v.id,
          unit_number: vo.v.unit_number,
          category: vo.v.category,
          depot: vo.depot,
          technologie: o.techno,
          anneeAcquisition: o.k,
        });
      } else {
        m.delete(vo.v.id);
      }
      this.membres.set(vo.garage, m);
      this.garages.delete(vo.garage); // à réévaluer
    }
  }

  poser(i: number, j: number) {
    const vo = this.ctx.vehicules[i];
    if (this.idx[i] === j) return;
    if (this.idx[i] >= 0) this.contribuer(i, vo.options[this.idx[i]], -1);
    this.idx[i] = j;
    this.contribuer(i, vo.options[j], 1);
  }

  garage(cle: string): GarageEvalue {
    const enCache = this.garages.get(cle);
    if (enCache) return enCache;
    const membres = [...(this.membres.get(cle)?.values() ?? [])];
    let r: GarageEvalue;
    if (membres.length === 0) {
      r = { van: 0, inv: new Array(this.ctx.H + 1).fill(0), infra: null };
    } else {
      const sig =
        cle +
        "#" +
        membres
          .map((m) => `${m.category}:${m.technologie}:${m.anneeAcquisition}`)
          .sort()
          .join(",");
      r = evaluerGarage(this.ctx, membres, sig);
    }
    this.garages.set(cle, r);
    return r;
  }

  totaux() {
    const H = this.ctx.H;
    let vanInfra = 0;
    const invInfra = new Array<number>(H + 1).fill(0);
    for (const cle of this.membres.keys()) {
      const g = this.garage(cle);
      vanInfra += g.van;
      for (let n = 0; n <= H; n++) invInfra[n] += g.inv[n];
    }
    return { van: this.vanVehicules + vanInfra, invInfra };
  }

  /** Violations « dures » et « cibles », normalisées, + liste détaillée. */
  violations(detail = false): { dures: number; cibles: number; liste: Violation[]; van: number } {
    const ctx = this.ctx;
    const c = ctx.contraintes;
    const H = ctx.H;
    const { van, invInfra } = this.totaux();
    const liste: Violation[] = [];
    let dures = 0;
    let cibles = 0;
    if (!ctx.relax.budget) {
      const bi = c.budgetInvestissementAnnuel;
      const br = c.budgetResteAFinancerAnnuel;
      for (let n = 0; n < H; n++) {
        const inv = this.inv[n] + invInfra[n];
        if (bi != null && inv > bi + 0.5) {
          dures += (inv - bi) / Math.max(bi, 1);
          if (detail) liste.push({ code: "budget_investissement", annee: ctx.ref + n, montant: inv, budget: bi, depassement: inv - bi });
        }
        const reste = inv - this.subv[n];
        if (br != null && reste > br + 0.5) {
          dures += (reste - br) / Math.max(br, 1);
          if (detail) liste.push({ code: "budget_reste", annee: ctx.ref + n, montant: reste, budget: br, depassement: reste - br });
        }
      }
    }
    if (!ctx.relax.capacite) {
      for (const [cle, contrainte] of Object.entries(c.garages)) {
        if (!this.membres.get(cle)?.size) continue;
        const infra = this.garage(cle).infra;
        if (!infra) continue;
        let kw = 0;
        let bornes = 0;
        const phases = new Map(infra.phasage.map((p) => [p.annee, p]));
        for (let n = 0; n < H; n++) {
          const annee = ctx.ref + n;
          const p = phases.get(annee);
          if (p) {
            kw += p.puissanceAjouteeMaxKw;
            bornes += Object.values(p.bornes).reduce((a, b) => a + (b ?? 0), 0);
          }
          const aug = contrainte.augmentation && annee >= contrainte.augmentation.annee ? contrainte.augmentation : null;
          const capKw = aug?.capaciteKw ?? contrainte.capaciteKw;
          const places = aug?.places ?? contrainte.places;
          if (capKw != null && kw > capKw + 1e-6) {
            dures += (kw - capKw) / Math.max(capKw, 1);
            if (detail) liste.push({ code: "capacite_kw", garage: infra.depot, annee, demande: kw, capacite: capKw, depassement: kw - capKw });
          }
          if (places != null && bornes > places) {
            dures += (bornes - places) / Math.max(places, 1);
            if (detail) liste.push({ code: "capacite_places", garage: infra.depot, annee, demande: bornes, places, depassement: bornes - places });
          }
        }
      }
    }
    const total = this.nbProjet;
    for (const cz of c.ciblesZe) {
      const kMax = Math.min(cz.annee - ctx.ref, H - 1);
      let ze = 0;
      for (let k = 0; k <= kMax; k++) ze += this.zeParK[k];
      const requis = Math.ceil(cz.part * total - 1e-9);
      if (ze < requis) {
        cibles += (requis - ze) / Math.max(total, 1);
        if (detail) liste.push({ code: "cible_ze", annee: cz.annee, demande: cz.part, atteint: total > 0 ? ze / total : 0, vehiculesManquants: requis - ze });
      }
    }
    for (const cg of c.ciblesGes) {
      const n = Math.min(Math.max(cg.annee - ctx.ref, 0), H);
      const base = this.gesReference;
      const red = base > 0 ? 1 - this.ges[n] / base : 0;
      if (red < cg.reduction - 1e-9) {
        cibles += cg.reduction - red;
        if (detail) liste.push({ code: "cible_ges", annee: cg.annee, demande: cg.reduction, atteint: red, tonnesManquantes: (cg.reduction - red) * base });
      }
    }
    for (const vo of ctx.vehicules) {
      if (vo.aucuneTechno && detail) liste.push({ code: "aucune_techno", vehiculeId: vo.v.id });
    }
    return { dures, cibles, liste, van };
  }

  nbProjet = 0;
  get gesReference(): number {
    return this.ctx.vehicules.reduce((s, vo) => s + vo.tauxRef, 0);
  }

  score(): Score {
    const { dures, cibles, van } = this.violations();
    const objectif = this.ctx.contraintes.objectif === "co2" ? this.co2 : van;
    let ecart = 0;
    this.ctx.vehicules.forEach((vo, i) => {
      ecart += Math.abs(vo.options[this.idx[i]].annee - vo.anneePrevue);
    });
    return [dures, cibles, objectif, van, ecart];
  }
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------

function indexOption(vo: VehiculeOptim, annee: number, techno: TechnoAlternative): number {
  const exact = vo.options.findIndex((o) => o.annee === annee && o.techno === techno);
  if (exact >= 0) return exact;
  // Techno non autorisée ou année hors fenêtre : diesel à l'année la plus proche.
  let meilleurIdx = -1;
  let ecart = Infinity;
  vo.options.forEach((o, j) => {
    const e = Math.abs(o.annee - annee) + (o.techno === techno ? 0 : 0.5) + (o.techno === "diesel" ? 0 : 0.25);
    if (e < ecart) {
      ecart = e;
      meilleurIdx = j;
    }
  });
  return meilleurIdx;
}

function rechercheLocale(ctx: Contexte, depart: number[], nbProjet: number): Etat {
  const etat = new Etat(ctx, depart);
  etat.nbProjet = nbProjet;
  let courant = etat.score();
  const N = ctx.vehicules.length;
  const maxIterations = 4 * N + 20;
  for (let it = 0; it < maxIterations; it++) {
    let meilleurCoup: { changes: [number, number][]; score: Score } | null = null;
    const essayer = (changes: [number, number][]) => {
      const anciens = changes.map(([i]) => [i, etat.idx[i]] as [number, number]);
      for (const [i, j] of changes) etat.poser(i, j);
      const s = etat.score();
      for (const [i, j] of anciens.reverse()) etat.poser(i, j);
      if (meilleur(s, meilleurCoup?.score ?? courant)) meilleurCoup = { changes, score: s };
    };
    // 1) Un véhicule à la fois.
    for (let i = 0; i < N; i++) {
      const vo = ctx.vehicules[i];
      for (let j = 0; j < vo.options.length; j++) if (j !== etat.idx[i]) essayer([[i, j]]);
    }
    // 2) Ajout groupé par garage (coût fixe des bornes + raccordement) :
    //    les k meilleurs candidats électrifiés ensemble à leur meilleure année.
    const parGarage = new Map<string, { i: number; j: number; gain: number }[]>();
    for (let i = 0; i < N; i++) {
      const vo = ctx.vehicules[i];
      if (vo.garde || vo.options[etat.idx[i]].techno !== "diesel") continue;
      let best: { j: number; gain: number } | null = null;
      vo.options.forEach((o, j) => {
        if (o.techno === "diesel") return;
        const gain = ctx.contraintes.objectif === "co2" ? o.co2 : o.van;
        if (!best || gain > best.gain) best = { j, gain };
      });
      if (best) {
        const l = parGarage.get(vo.garage) ?? [];
        l.push({ i, ...(best as { j: number; gain: number }) });
        parGarage.set(vo.garage, l);
      }
    }
    for (const [cleG, l] of parGarage) {
      l.sort((a, b) => b.gain - a.gain || a.i - b.i);
      for (let k = 2; k <= l.length; k++) essayer(l.slice(0, k).map((x) => [x.i, x.j]));
      // 3) Meilleur sous-ensemble du garage par marche de raccordement
      //    (même recherche que « Économies d'abord », ./selectionGarage.ts) :
      //    gain du véhicule moins sa borne, sac à dos sur les kW.
      if (ctx.contraintes.objectif === "co2") continue;
      const garage = ctx.options.garages?.get(cleG);
      const bev = l.filter((x) => ctx.vehicules[x.i].options[x.j].techno === "BEV");
      const candidats = bev.map((x) => {
        const type = TYPE_BORNE_PAR_CATEGORIE[categorieMoteur(ctx.vehicules[x.i].v.category) ?? ctx.vehicules[x.i].v.category];
        const borne = type ? garage?.coutBorneDevis?.[type] ?? BORNES[type].capex : 0;
        return { id: String(x.i), kw: type ? BORNES[type].puissanceMaxKw : 0, net: x.gain - borne };
      });
      const devis = garage?.devisRaccordement ?? ctx.options.surchargesEnergie?.devisRaccordement ?? null;
      const marches = marchesRaccordement(calculerRaccordement(0, garage).kwDisponibles, PALIERS_RACCORDEMENT, devis);
      const parI = new Map(bev.map((x) => [String(x.i), x]));
      for (const p of proposerSousEnsembles(candidats, marches)) {
        if (p.ids.length >= 2) essayer(p.ids.map((id) => [parI.get(id)!.i, parI.get(id)!.j]));
      }
    }
    if (!meilleurCoup) break;
    const coup = meilleurCoup as { changes: [number, number][]; score: Score };
    for (const [i, j] of coup.changes) etat.poser(i, j);
    courant = coup.score;
  }
  return etat;
}

function amorces(
  ctx: Contexte,
  vehicules: VehiculeProjet[],
): number[][] {
  const statuQuo = ctx.vehicules.map((vo) => indexOption(vo, vo.anneePrevue, vo.garde ? vo.technoPrevue : "diesel"));
  const liste = [statuQuo];
  // Les 3 stratégies existantes, à l'année prévue (technos non autorisées → diesel).
  const base = ctx.options;
  // Le plan actuel tel quel (années ET technologies du plan, ex. une
  // solution optimisée déjà appliquée) : relancer ne fait jamais pire.
  liste.push(
    ctx.vehicules.map((vo) =>
      indexOption(vo, vo.garde ? vo.anneePrevue : Math.max(vo.v.replacement_year ?? ctx.ref, ctx.ref), vo.technoPrevue),
    ),
  );
  for (const cle of ["plan_actuel", "tout_electrique", "economies_d_abord"] as const) {
    const s = construireStrategie(vehicules, cle, base);
    const parId = new Map((s.plan?.vehicules ?? []).map((pv) => [pv.id, pv.alternative.technologie as TechnoAlternative]));
    liste.push(
      ctx.vehicules.map((vo) =>
        indexOption(vo, vo.anneePrevue, vo.garde ? vo.technoPrevue : parId.get(vo.v.id) ?? "diesel"),
      ),
    );
  }
  return liste;
}

function resoudre(
  ctx: Contexte,
  vehicules: VehiculeProjet[],
  nbProjet: number,
): Etat {
  let meilleurEtat: Etat | null = null;
  let meilleurScore: Score | null = null;
  const vus = new Set<string>();
  for (const depart of amorces(ctx, vehicules)) {
    const cle = depart.join(",");
    if (vus.has(cle)) continue;
    vus.add(cle);
    const e = rechercheLocale(ctx, depart, nbProjet);
    const s = e.score();
    if (!meilleurScore || meilleur(s, meilleurScore)) {
      meilleurEtat = e;
      meilleurScore = s;
    }
  }
  return meilleurEtat!;
}

// ---------------------------------------------------------------------------
// Explications
// ---------------------------------------------------------------------------

function expliquer(ctx: Contexte, etat: Etat): DecisionVehicule[] {
  const scoreActuel = etat.score();
  const vanActuelle = scoreActuel[3];
  const objectifActuel = scoreActuel[2];
  const nomsProgrammes = new Map((ctx.options.programmes ?? PROGRAMMES).map((p) => [p.id, p]));
  const decisions: DecisionVehicule[] = [];

  const essai = (i: number, j: number) => {
    const avant = etat.idx[i];
    etat.poser(i, j);
    const s = etat.score();
    const v = etat.violations(true);
    etat.poser(i, avant);
    return { s, v };
  };
  const causeDure = (liste: Violation[], garage: string): RaisonDecision | null => {
    const b = liste.find((x) => x.code === "budget_investissement" || x.code === "budget_reste");
    const c = liste.find((x) => (x.code === "capacite_kw" || x.code === "capacite_places") && cleGarage(x.garage) === garage);
    if (c && (c.code === "capacite_kw" || c.code === "capacite_places")) return { code: "report_capacite", garage: c.garage };
    if (b) return { code: "report_budget", budget: b.code === "budget_investissement" ? "investissement" : "reste" };
    return null;
  };

  ctx.vehicules.forEach((vo, i) => {
    const o = vo.options[etat.idx[i]];
    const raisons: RaisonDecision[] = [];
    if (vo.garde) {
      raisons.push({ code: "garde" });
    } else {
      // Année : pourquoi pas l'année prévue ?
      if (o.annee !== vo.anneePrevue) {
        const jPrevue = vo.options.findIndex((x) => x.annee === vo.anneePrevue && x.techno === o.techno);
        if (jPrevue >= 0) {
          const { s, v } = essai(i, jPrevue);
          const dureAvant = scoreActuel[0];
          if (s[0] > dureAvant + 1e-9 || s[1] > scoreActuel[1] + 1e-9) {
            const r = causeDure(v.liste, vo.garage);
            if (r) raisons.push(r);
          } else if (o.annee < vo.anneePrevue) {
            const perdus = o.programmes.filter((p) => !vo.options[jPrevue].programmes.includes(p));
            if (perdus.length > 0) {
              const p = nomsProgrammes.get(perdus[0]);
              raisons.push({ code: "avance_subvention", programme: p?.nom ?? perdus[0], dateFin: p?.dateFin ?? "" });
            } else {
              raisons.push({ code: "avance_avantageuse", gain: objectifActuel - s[2] });
            }
          } else {
            raisons.push({ code: "report_avantageux", gain: objectifActuel - s[2] });
          }
        }
      }
      if (o.techno !== "diesel") {
        const jDiesel = vo.options.findIndex((x) => x.annee === o.annee && x.techno === "diesel");
        if (jDiesel < 0) {
          raisons.push({ code: "techno_imposee" });
        } else {
          const { s } = essai(i, jDiesel);
          const gainVan = vanActuelle - s[3];
          if (s[1] > scoreActuel[1] + 1e-9 && gainVan < 0) {
            raisons.push({ code: "electrifie_cible", cout: -gainVan });
          } else if (ctx.contraintes.objectif === "co2" && gainVan < 0) {
            raisons.push({ code: "electrifie_co2", tonnes: objectifActuel - s[2], cout: -gainVan });
          } else {
            raisons.push({ code: "electrifie_rentable", economie: gainVan });
          }
        }
        // Le programme cesse-t-il l'année suivante (date limite) ?
        const suivante = entreeVehiculeMoteur(vo.v, o.techno, o.k + 1, ctx.options);
        const progSuivants = (suivante?.explications ?? []).filter((e) => e.statut !== "exclue").map((e) => e.programmeId);
        for (const pid of o.programmes) {
          const p = nomsProgrammes.get(pid);
          if (!progSuivants.includes(pid) && p?.dateFin && Number(p.dateFin.slice(0, 4)) === o.annee) {
            if (!raisons.some((r) => r.code === "avance_subvention")) {
              raisons.push({ code: "subvention_avant_fin", programme: p.nom, dateFin: p.dateFin });
            }
          }
        }
      } else {
        const ze = vo.options.map((x, j) => ({ x, j })).filter(({ x }) => x.techno !== "diesel");
        if (ze.length === 0) {
          if (vo.technosRetirees.aReporter || raisonAReporter(vo.v.category)) raisons.push({ code: "diesel_a_reporter" });
          else if (vo.technosRetirees.hiver) raisons.push({ code: "diesel_hiver" });
          else raisons.push({ code: "diesel_techno_non_autorisee" });
        } else {
          let meilleurEssai: { s: Score; v: ReturnType<Etat["violations"]> } | null = null;
          for (const { j } of ze) {
            const r = essai(i, j);
            if (!meilleurEssai || meilleur(r.s, meilleurEssai.s)) meilleurEssai = r;
          }
          const m = meilleurEssai!;
          if (m.s[0] > scoreActuel[0] + 1e-9) {
            const r = causeDure(m.v.liste, vo.garage);
            if (r?.code === "report_capacite") raisons.push({ code: "diesel_capacite", garage: r.garage });
            else if (r?.code === "report_budget") raisons.push({ code: "diesel_budget", budget: r.budget });
            else raisons.push({ code: "diesel_non_rentable", surcout: Math.max(0, vanActuelle - m.s[3]) });
          } else {
            raisons.push({ code: "diesel_non_rentable", surcout: Math.max(0, vanActuelle - m.s[3]) });
          }
        }
      }
    }
    decisions.push({
      vehiculeId: vo.v.id,
      unite: vo.v.unit_number ?? null,
      garage: vo.depot,
      anneePrevue: vo.anneePrevue,
      annee: o.annee,
      techno: o.techno,
      technoPrevue: vo.technoPrevue,
      raisons,
    });
  });
  return decisions;
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export interface EntreeOptimiseur {
  vehicules: VehiculeProjet[];
  options: OptionsStrategie;
  contraintes: ContraintesOptimiseurEntree;
  /** Années prévues de référence (assignation déjà appliquée) : la fenêtre
   *  de calendrier reste celle d'origine quand on relance l'optimiseur. */
  anneesPrevues?: Map<string, number | null>;
  /** Diagnostic d'infaisabilité (relances avec une famille levée). Défaut : oui. */
  diagnostic?: boolean;
}

function lancer(entree: EntreeOptimiseur, contraintes: ContraintesOptimiseur, relax: Relaxations) {
  const ctx = preparer(entree.vehicules, entree.options, contraintes, relax, entree.anneesPrevues);
  if (ctx.vehicules.length === 0 || !ctx.factice) return { ctx, etat: null as Etat | null };
  const etat = resoudre(ctx, entree.vehicules, entree.vehicules.length);
  return { ctx, etat };
}

export function optimiserCalendrier(entree: EntreeOptimiseur): ResultatOptimisation {
  const contraintes = zContraintesOptimiseur.parse(entree.contraintes);
  const { ctx, etat } = lancer(entree, contraintes, {});
  const nbVehiculesProjet = entree.vehicules.length;
  if (!etat) {
    return {
      contraintes,
      strategie: null,
      choix: {},
      decisions: [],
      realisable: true,
      violations: [],
      leviers: [],
      indicateurs: [],
      nbVehiculesProjet,
      ecartControle: 0,
    };
  }

  const choix: ResultatOptimisation["choix"] = {};
  ctx.vehicules.forEach((vo, i) => {
    const o = vo.options[etat.idx[i]];
    choix[vo.v.id] = { annee: o.annee, techno: o.techno, anneePrevue: vo.anneePrevue };
  });

  // Re-chiffrage COMPLET par le moteur : ce sont ces chiffres qui s'affichent.
  const strategie = chiffrerChoix(entree.vehicules, "optimisee", ctx.options, (v) => {
    const c = choix[v.id];
    return c ? { techno: c.techno, annee: c.annee } : { techno: "diesel", annee: v.replacement_year };
  });
  const viol = etat.violations(true);
  const devisProjet = entree.options.surchargesEnergie?.devisRaccordement ?? null;
  // Contrôle d'intégrité : somme des contributions = moteur complet (au
  // devis de raccordement de projet près, réparti entre garages).
  const ecartControle = devisProjet == null && strategie.resultat ? Math.abs(strategie.resultat.vanDifferentielle - viol.van) : 0;

  // Violations re-vérifiées sur le re-chiffrage complet (budgets).
  const violations: Violation[] = viol.liste.filter((x) => x.code !== "budget_investissement" && x.code !== "budget_reste");
  if (strategie.resultat) {
    for (const l of strategie.resultat.vueBudgetaire.slice(0, ctx.H)) {
      const bi = contraintes.budgetInvestissementAnnuel;
      const br = contraintes.budgetResteAFinancerAnnuel;
      if (bi != null && l.investissementAlt > bi + 0.5) {
        violations.push({ code: "budget_investissement", annee: l.annee, montant: l.investissementAlt, budget: bi, depassement: l.investissementAlt - bi });
      }
      if (br != null && l.resteAFinancerAlt > br + 0.5) {
        violations.push({ code: "budget_reste", annee: l.annee, montant: l.resteAFinancerAlt, budget: br, depassement: l.resteAFinancerAlt - br });
      }
    }
  }
  violations.sort((a, b) => ("annee" in a ? a.annee : 0) - ("annee" in b ? b.annee : 0) || a.code.localeCompare(b.code));

  const indicateurs: IndicateursAnnee[] = [];
  if (strategie.resultat) {
    const base = etat.gesReference;
    let ze = 0;
    for (let k = 0; k < ctx.H; k++) {
      ze += etat.zeParK[k];
      const l = strategie.resultat.vueBudgetaire[k];
      indicateurs.push({
        annee: ctx.ref + k,
        investissement: l.investissementAlt,
        resteAFinancer: l.resteAFinancerAlt,
        partZe: nbVehiculesProjet > 0 ? ze / nbVehiculesProjet : 0,
        reductionGes: base > 0 ? 1 - etat.ges[k] / base : 0,
      });
    }
  }

  const realisable = violations.length === 0;
  const leviers: Levier[] = [];
  if (!realisable && entree.diagnostic !== false) {
    const familles: FamilleContrainte[] = ["budget", "capacite", "technologies", "calendrier", "vehicules_gardes"];
    for (const famille of familles) {
      const pertinent =
        famille === "budget"
          ? contraintes.budgetInvestissementAnnuel != null || contraintes.budgetResteAFinancerAnnuel != null
          : famille === "capacite"
            ? Object.keys(contraintes.garages).length > 0
            : famille === "vehicules_gardes"
              ? contraintes.vehiculesGardes.length > 0
              : true;
      if (!pertinent) continue;
      const r = lancer(entree, contraintes, { [famille]: true });
      if (!r.etat) continue;
      const v = r.etat.violations(true);
      const restantes = v.liste.filter((x) => x.code !== "aucune_techno").length;
      leviers.push({ famille, suffit: restantes === 0, violationsRestantes: restantes, van: v.van });
    }
  }

  return {
    contraintes,
    strategie,
    choix,
    decisions: expliquer(ctx, etat),
    realisable,
    violations,
    leviers,
    indicateurs,
    nbVehiculesProjet,
    ecartControle,
  };
}

// ---------------------------------------------------------------------------
// Appliquer au plan
// ---------------------------------------------------------------------------

export interface ChangementOptimise {
  vehiculeId: string;
  anneeActuelle: number | null;
  anneeNouvelle: number;
  cibleActuelle: "diesel" | "bev" | "fcev" | null;
  cibleNouvelle: "diesel" | "bev" | "fcev";
}

const VERS_CIBLE: Record<TechnoAlternative, "diesel" | "bev" | "fcev"> = { diesel: "diesel", BEV: "bev", FCEV: "fcev" };

/** Changements (année ET technologie) qu'appliquerait la solution, limités
 *  aux véhicules qui changent — l'aperçu avant → après de la confirmation. */
export function changementsOptimises(
  vehicules: VehiculeProjet[],
  choix: ResultatOptimisation["choix"],
): ChangementOptimise[] {
  const out: ChangementOptimise[] = [];
  for (const v of vehicules) {
    const c = choix[v.id];
    if (!c) continue;
    const cibleNouvelle = VERS_CIBLE[c.techno];
    const cibleActuelle = (v.target_technology ?? null) as ChangementOptimise["cibleActuelle"];
    if (v.replacement_year !== c.annee || cibleActuelle !== cibleNouvelle) {
      out.push({ vehiculeId: v.id, anneeActuelle: v.replacement_year, anneeNouvelle: c.annee, cibleActuelle, cibleNouvelle });
    }
  }
  return out;
}

/** Nombre de véhicules dont le plan diffère aujourd'hui de l'assignation appliquée. */
export function ecartsAssignation(vehicules: VehiculeProjet[], a: AssignationOptimisee | null | undefined): number {
  if (!a) return 0;
  return changementsOptimises(vehicules, a.vehicules).length;
}

/** Années prévues d'origine d'une assignation déjà appliquée. */
export function anneesPrevuesDe(a: AssignationOptimisee | null | undefined): Map<string, number | null> | undefined {
  if (!a) return undefined;
  return new Map(Object.entries(a.vehicules).map(([id, c]) => [id, c.anneePrevue]));
}

export const zAssignationOptimisee = z.object({
  calculeLe: z.string(),
  vehicules: z.record(z.object({ annee: zAnnee, techno: zTechno, anneePrevue: zAnnee })),
});

/** Contraintes par défaut (aucune) : l'optimiseur maximise les économies
 *  sur la fenêtre de calendrier par défaut. */
export function contraintesParDefaut(): ContraintesOptimiseur {
  return zContraintesOptimiseur.parse({});
}

export type { PlanTcoEntree };

/** Contraintes enregistrées sur le projet (JSON) → validées, null si absentes ou invalides. */
export function lireContraintes(json: unknown): ContraintesOptimiseur | null {
  if (json == null) return null;
  const r = zContraintesOptimiseur.safeParse(json);
  return r.success ? r.data : null;
}

/** Assignation appliquée (JSON) → validée, null si absente ou invalide. */
export function lireAssignation(json: unknown): AssignationOptimisee | null {
  if (json == null) return null;
  const r = zAssignationOptimisee.safeParse(json);
  return r.success ? (r.data as AssignationOptimisee) : null;
}

/** Codes de raison (pour vérifier que chaque code a son texte fr/en). */
export const CODES_RAISONS: RaisonDecision["code"][] = [
  "garde",
  "electrifie_rentable",
  "electrifie_co2",
  "electrifie_cible",
  "techno_imposee",
  "subvention_avant_fin",
  "avance_subvention",
  "avance_avantageuse",
  "report_budget",
  "report_capacite",
  "report_avantageux",
  "diesel_non_rentable",
  "diesel_budget",
  "diesel_capacite",
  "diesel_techno_non_autorisee",
  "diesel_hiver",
  "diesel_a_reporter",
];
export const CODES_VIOLATIONS: Violation["code"][] = [
  "budget_investissement",
  "budget_reste",
  "capacite_kw",
  "capacite_places",
  "cible_ze",
  "cible_ges",
  "aucune_techno",
];
export const FAMILLES: FamilleContrainte[] = ["budget", "capacite", "technologies", "calendrier", "vehicules_gardes"];

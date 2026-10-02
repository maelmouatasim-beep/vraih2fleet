/**
 * Étape 3 du parcours — Stratégies : construit 2-3 stratégies de
 * remplacement à partir des véhicules du projet et les chiffre avec LE
 * moteur TCO (src/lib/tco), année d'acquisition par véhicule comprise
 * (§10.11). Aucune valeur inventée : véhicules et bornes viennent du
 * registre d'hypothèses ; les subventions du registre des programmes
 * (un programme échu avant l'année d'achat prévue n'est pas compté).
 *
 * Infrastructure : plan PAR GARAGE de ./infrastructure.ts (source
 * unique, aussi lue par Plan, Financement, Rapports et Excel) — un site
 * de recharge et/ou un site H2 par garage dans le moteur.
 */
import {
  calculerPlan,
  parametresParDefaut,
  resoudreSubventions,
  type OptionsParametres,
  type PlanTcoEntree,
  type ResultatPlan,
} from "@/lib/tco";
import {
  appliquerSubventionsConfirmees,
  type SubventionConfirmee,
} from "@/lib/confirmedSubsidies";
import {
  cleGarage,
  planifierInfrastructure,
  sitesInfraMoteur,
  type CaracteristiquesGarage,
  type PlanInfrastructure,
  type VehiculeInfra,
} from "./infrastructure";
import {
  analyserDonneesVehicule,
  classeEmission,
  evaluerFaisabiliteVehicule,
  type VehiculeFaisabilite,
} from "./feasibility";

export interface VehiculeProjet extends VehiculeFaisabilite {
  unit_number?: string;
  /** Garage (dépôt) du véhicule — regroupe bornes et raccordement. */
  depot?: string | null;
  replacement_year: number | null;
  target_technology: string | null; // 'diesel' | 'bev' | 'fcev' | null
  /** Subventions CONFIRMÉES par le client (lettre d'octroi…) : elles
   *  REMPLACENT la subvention résolue automatiquement du même
   *  programme et sont marquées « confirmée par le client (réf. …) ». */
  subventionsConfirmees?: SubventionConfirmee[];
}

/** Options du moteur + caractéristiques connues des garages (puissance
 *  disponible, devis de raccordement), indexées par cleGarage(nom). */
export type OptionsStrategie = OptionsParametres & {
  garages?: Map<string, CaracteristiquesGarage>;
};

/** « Économies d'abord » : ce que la sélection a retenu, garage par garage. */
export interface SelectionGarage {
  depot: string | null;
  /** Véhicules rentables SEULS (sans infrastructure). */
  candidats: number;
  /** Véhicules retenus une fois bornes + raccordement du garage comptés. */
  retenus: number;
  /** VAN différentielle du garage avec sa propre infrastructure (0 si rien retenu). */
  vanAvecInfra: number;
}

export type CleStrategie = "plan_actuel" | "tout_electrique" | "economies_d_abord";
export const CLES_STRATEGIES: CleStrategie[] = [
  "plan_actuel",
  "tout_electrique",
  "economies_d_abord",
];

export interface StrategieConstruite {
  cle: CleStrategie;
  /** null si aucun véhicule évaluable. */
  plan: PlanTcoEntree | null;
  resultat: ResultatPlan | null;
  nbVehicules: number;
  nbZeroEmission: number;
  /** = infra.totalCapex (le total affiché partout). */
  infraCapex: number;
  /** Plan d'infrastructure par garage (source unique). */
  infra: PlanInfrastructure;
  subventionsTotal: number;
  /** Véhicules de catégorie « autre », hors moteur. */
  exclusions: string[];
  /** Véhicules sans année de remplacement (traités à l'année 0). */
  sansAnnee: string[];
  /** Véhicules dont le remplacement tombe APRÈS l'horizon d'analyse
   *  (revue A5) : exclus des totaux, du budget et du financement,
   *  signalés en clair (année prévue). */
  horsHorizon: { id: string; anneeRemplacement: number }[];
  /** Conditions et prudences du résolveur de subventions (classe de
   *  poids inconnue, % à valider, limites par organisation…), dédupliquées. */
  avertissementsSubventions: string[];
  /** « Économies d'abord » seulement : détail de la sélection par garage. */
  selection?: SelectionGarage[];
  /** « Économies d'abord » : aucun véhicule ne rapporte, infrastructure
   *  comprise, avec les hypothèses actuelles. */
  aucuneElectrificationRentable?: boolean;
}

type TechnoAlternative = "diesel" | "BEV" | "FCEV";

function technoCible(
  cle: CleStrategie,
  vehicule: VehiculeProjet,
  selection: Set<string> | null,
): TechnoAlternative {
  if (cle === "tout_electrique") return "BEV";
  if (cle === "plan_actuel") {
    if (vehicule.target_technology === "bev") return "BEV";
    if (vehicule.target_technology === "fcev") return "FCEV";
    return "diesel";
  }
  return selection?.has(vehicule.id) ? "BEV" : "diesel";
}

/** Le remplacement tombe-t-il dans l'horizon (ou sans année → année 0) ? */
function dansHorizon(v: VehiculeProjet, options: OptionsParametres): boolean {
  return (
    v.replacement_year == null ||
    Math.max(v.replacement_year - options.anneeReference, 0) < options.horizonAns
  );
}

const cacheSelection = new WeakMap<VehiculeProjet[], WeakMap<object, ResultatSelection>>();
interface ResultatSelection {
  ids: Set<string>;
  detail: SelectionGarage[];
}

/**
 * 1.3 — « Économies d'abord » : sélection PAR GARAGE, infrastructure
 * comprise AVANT de choisir. Pour chaque garage, les véhicules rentables
 * seuls (économie BEV > 0 sans infrastructure, moteur) sont triés par
 * économie décroissante ; on chiffre avec le moteur les k premiers AVEC
 * les bornes et le raccordement que ce sous-ensemble exige au garage
 * (planifierInfrastructure, source unique) et on retient le k de VAN
 * maximale, 0 si aucune n'est positive : un garage dont l'infrastructure
 * mange l'économie reste au diesel. Un devis de raccordement saisi au
 * niveau du projet est compté en entier pour chaque garage (prudent).
 */
function selectionEconomiesDAbord(
  vehicules: VehiculeProjet[],
  options: OptionsStrategie,
): ResultatSelection {
  const enCache = cacheSelection.get(vehicules)?.get(options);
  if (enCache) return enCache;

  const parGarage = new Map<string, { depot: string | null; liste: { v: VehiculeProjet; eco: number }[] }>();
  for (const v of vehicules) {
    if (!analyserDonneesVehicule(v).defauts || !dansHorizon(v, options)) continue;
    const bev = evaluerFaisabiliteVehicule(v, options).evaluations?.find((e) => e.technologie === "BEV");
    const cle = cleGarage(v.depot ?? null);
    const entree = parGarage.get(cle) ?? { depot: v.depot?.trim() || null, liste: [] };
    if (bev && bev.economieActualisee > 0) entree.liste.push({ v, eco: bev.economieActualisee });
    parGarage.set(cle, entree);
  }

  const ids = new Set<string>();
  const detail: SelectionGarage[] = [];
  for (const { depot, liste } of parGarage.values()) {
    liste.sort((a, b) => b.eco - a.eco);
    let meilleurK = 0;
    let meilleureVan = 0;
    for (let k = 1; k <= liste.length; k++) {
      const sousEnsemble = liste.slice(0, k).map((x) => x.v);
      const r = chiffrer(sousEnsemble, "economies_d_abord", options, new Set(sousEnsemble.map((v) => v.id)));
      const van = r.resultat?.vanDifferentielle ?? 0;
      if (van > meilleureVan + 1e-6) {
        meilleureVan = van;
        meilleurK = k;
      }
    }
    for (const x of liste.slice(0, meilleurK)) ids.add(x.v.id);
    detail.push({ depot, candidats: liste.length, retenus: meilleurK, vanAvecInfra: meilleureVan });
  }
  detail.sort((a, b) => (a.depot ?? "\uffff").localeCompare(b.depot ?? "\uffff", "fr"));

  const resultat = { ids, detail };
  const parOptions = cacheSelection.get(vehicules) ?? new WeakMap<object, ResultatSelection>();
  parOptions.set(options, resultat);
  cacheSelection.set(vehicules, parOptions);
  return resultat;
}

export function construireStrategie(
  vehicules: VehiculeProjet[],
  cle: CleStrategie,
  options: OptionsStrategie,
): StrategieConstruite {
  if (cle !== "economies_d_abord") return chiffrer(vehicules, cle, options, null);
  const selection = selectionEconomiesDAbord(vehicules, options);
  const s = chiffrer(vehicules, cle, options, selection.ids);
  return {
    ...s,
    selection: selection.detail,
    aucuneElectrificationRentable: s.nbVehicules > 0 && selection.ids.size === 0,
  };
}

function chiffrer(
  vehicules: VehiculeProjet[],
  cle: CleStrategie,
  options: OptionsStrategie,
  selection: Set<string> | null,
): StrategieConstruite {
  const parametres = parametresParDefaut(options);
  const exclusions: string[] = [];
  const sansAnnee: string[] = [];
  const horsHorizon: { id: string; anneeRemplacement: number }[] = [];
  const avertissementsSubventions = new Set<string>();
  const plansVehicules: NonNullable<PlanTcoEntree["vehicules"]> = [];
  const vehiculesInfra: VehiculeInfra[] = [];

  for (const v of vehicules) {
    const { defauts, kmParAn, consoReference } = analyserDonneesVehicule(v);
    if (!defauts) {
      exclusions.push(v.id);
      continue;
    }
    let k = 0;
    if (v.replacement_year == null) {
      sansAnnee.push(v.id);
    } else {
      k = Math.max(v.replacement_year - options.anneeReference, 0);
      // Remplacement APRÈS l'horizon d'analyse (revue A5) : le véhicule
      // n'a aucun effet dans la fenêtre — exclu des totaux et signalé
      // en clair (jamais un identifiant technique à l'écran).
      if (k >= options.horizonAns) {
        horsHorizon.push({ id: v.id, anneeRemplacement: options.anneeReference + k });
        continue;
      }
    }

    const techno = technoCible(cle, v, selection);
    const reference = {
      technologie: "diesel" as const,
      prixAvantTaxes: defauts.prixAchat.diesel.valeur,
      consommationPar100km: consoReference,
      entretienParKm: defauts.entretien.diesel.valeur,
    };
    // Techno « diesel » = statu quo pour ce véhicule : alternative
    // identique à la référence, différentiel nul, mais le véhicule reste
    // dans les totaux (budget, émissions) des deux scénarios.
    const alternative =
      techno === "diesel"
        ? reference
        : {
            technologie: techno,
            prixAvantTaxes: defauts.prixAchat[techno].valeur,
            consommationPar100km: defauts.consommation[techno].valeur,
            entretienParKm: defauts.entretien[techno].valeur,
          };

    let subventions: { libelle: string; montant: number; annee: number }[] = [];
    if (techno !== "diesel") {
      const resolution = resoudreSubventions({
        categorie: defauts.categorie,
        technologie: techno,
        prixAvantTaxes: alternative.prixAvantTaxes,
        typeOrganisme: options.typeOrganisme,
        anneeAchatCalendaire: options.anneeReference + k,
      });
      subventions = resolution.subventions.map((s) => ({
        libelle: s.libelle,
        montant: s.montant,
        annee: s.annee + k,
      }));
      for (const a of resolution.avertissements) avertissementsSubventions.add(a);
      // PRIORITÉ AU CLIENT : un montant confirmé par document remplace
      // la subvention résolue du même programme ; les autres s'ajoutent.
      subventions = appliquerSubventionsConfirmees(
        subventions,
        v.subventionsConfirmees,
        k,
        options.anneeReference,
      );
    }

    plansVehicules.push({
      id: v.id,
      kmParAn,
      classeEmissionDiesel: classeEmission(v.category),
      reference,
      alternative,
      subventionsAlternative: subventions,
      dureeVieAns: defauts.dureeVieAns,
      anneeAcquisition: k,
    });

    if (techno !== "diesel") {
      vehiculesInfra.push({
        id: v.id,
        unit_number: v.unit_number,
        category: v.category,
        depot: v.depot ?? null,
        technologie: techno,
        anneeAcquisition: k,
      });
    }
  }

  const infra = planifierInfrastructure(vehiculesInfra, {
    anneeReference: options.anneeReference,
    devisRaccordementProjet: options.surchargesEnergie?.devisRaccordement ?? null,
    garages: options.garages,
  });

  if (plansVehicules.length === 0) {
    return {
      cle,
      plan: null,
      resultat: null,
      nbVehicules: 0,
      nbZeroEmission: 0,
      infraCapex: 0,
      infra,
      subventionsTotal: 0,
      exclusions,
      sansAnnee,
      horsHorizon,
      avertissementsSubventions: [...avertissementsSubventions],
    };
  }

  // Sites du moteur = plan d'infrastructure par garage (payé l'année
  // d'ARRIVÉE des premiers véhicules de chaque garage, §3.5).
  const sitesInfra = sitesInfraMoteur(infra);

  const plan: PlanTcoEntree = { parametres, vehicules: plansVehicules, sitesInfra };
  const resultat = calculerPlan(plan);
  const subventionsTotal = resultat.alternative.flux.subventions.reduce((a, b) => a + b, 0);

  return {
    cle,
    plan,
    resultat,
    nbVehicules: plansVehicules.length,
    nbZeroEmission: vehiculesInfra.length,
    infraCapex: infra.totalCapex,
    infra,
    subventionsTotal,
    exclusions,
    sansAnnee,
    horsHorizon,
    avertissementsSubventions: [...avertissementsSubventions],
  };
}

export type CibleVehicule = "diesel" | "bev" | "fcev";

export interface ChangementCible {
  vehiculeId: string;
  cibleActuelle: CibleVehicule | null;
  cibleNouvelle: CibleVehicule;
}

/**
 * C3 — « Appliquer cette stratégie au plan » : liste PURE des
 * technologies cibles que la stratégie donnerait à chaque véhicule du
 * projet, limitée aux véhicules qui CHANGENT. Les véhicules de
 * catégorie inconnue (« autre ») et ceux dont le remplacement tombe
 * après l'horizon ne sont jamais modifiés (ils sont exclus du calcul
 * de la stratégie elle-même).
 */
export function changementsStrategie(
  vehicules: VehiculeProjet[],
  cle: CleStrategie,
  options: OptionsStrategie,
): ChangementCible[] {
  const selection = cle === "economies_d_abord" ? selectionEconomiesDAbord(vehicules, options).ids : null;
  const changements: ChangementCible[] = [];
  for (const v of vehicules) {
    const { defauts } = analyserDonneesVehicule(v);
    if (!defauts || !dansHorizon(v, options)) continue;
    const techno = technoCible(cle, v, selection);
    const nouvelle: CibleVehicule = techno === "BEV" ? "bev" : techno === "FCEV" ? "fcev" : "diesel";
    const actuelle = (v.target_technology ?? null) as CibleVehicule | null;
    if (actuelle !== nouvelle) {
      changements.push({ vehiculeId: v.id, cibleActuelle: actuelle, cibleNouvelle: nouvelle });
    }
  }
  return changements;
}

export function construireStrategies(
  vehicules: VehiculeProjet[],
  options: OptionsStrategie,
): StrategieConstruite[] {
  return CLES_STRATEGIES.map((cle) => construireStrategie(vehicules, cle, options));
}

/**
 * 1.5 — Badge « Meilleure économie » : la stratégie de VAN la plus
 * élevée, à condition qu'elle électrifie au moins un véhicule et que sa
 * VAN centrale (= scénario central du stress test, même moteur) soit
 * STRICTEMENT positive. Jamais sur un plan vide, sur 0 $ ou sur un
 * surcoût ; null si aucune ne remplit ces conditions.
 */
export function strategieMeilleureEconomie(strategies: StrategieConstruite[]): CleStrategie | null {
  let meilleure: StrategieConstruite | null = null;
  for (const s of strategies) {
    const van = s.resultat?.vanDifferentielle;
    if (van == null || s.nbZeroEmission === 0 || van < 0.5) continue;
    if (!meilleure || van > meilleure.resultat!.vanDifferentielle) meilleure = s;
  }
  return meilleure?.cle ?? null;
}

/** 1.5 — Plan sans aucune technologie cible zéro émission (rien à chiffrer). */
export function estPlanVide(s: StrategieConstruite): boolean {
  return s.nbVehicules > 0 && s.nbZeroEmission === 0 && !s.aucuneElectrificationRentable;
}

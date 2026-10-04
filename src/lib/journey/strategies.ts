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
import { classePourSubventions } from "@/lib/fleet/gvwr";
import { categorieMoteur, raisonAReporter } from "./categories";
import {
  calculerPlan,
  HYPOTHESES,
  parametresParDefaut,
  resoudreSubventions,
  type ExplicationSubvention,
  type OptionsParametres,
  type PlanTcoEntree,
  type ResultatPlan,
  type VehiculePlan,
} from "@/lib/tco";
import type { ProgrammeSubvention } from "@/lib/tco/subsidy-programs";
import {
  appliquerSubventionsConfirmees,
  type SubventionConfirmee,
} from "@/lib/confirmedSubsidies";
import {
  BORNES,
  calculerRaccordement,
  cleGarage,
  PALIERS_RACCORDEMENT,
  planifierInfrastructure,
  sitesInfraMoteur,
  TYPE_BORNE_PAR_CATEGORIE,
  type CaracteristiquesGarage,
  type PlanInfrastructure,
  type VehiculeInfra,
} from "./infrastructure";
import { marchesRaccordement, proposerSousEnsembles, type CandidatGarage } from "./selectionGarage";
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
  /** Registre des programmes à utiliser (défaut : registre officiel).
   *  L'optimiseur y reporte les dates limites saisies par l'utilisateur. */
  programmes?: ProgrammeSubvention[];
};

/** Pourquoi un véhicule rentable seul n'est pas retenu dans son garage. */
export type RaisonExclusion = "borne" | "raccordement";

/** « Économies d'abord » : ce que la sélection a retenu, garage par garage. */
export interface SelectionGarage {
  depot: string | null;
  /** Véhicules rentables SEULS (sans infrastructure). */
  candidats: number;
  /** Véhicules retenus une fois bornes + raccordement du garage comptés. */
  retenus: number;
  /** VAN différentielle du garage avec sa propre infrastructure (0 si rien retenu). */
  vanAvecInfra: number;
  /** Infrastructure du sous-ensemble retenu (null si rien retenu). */
  infra: {
    capexBornes: number;
    kwDemandes: number;
    kwDisponibles: number;
    kwDisponiblesSource: "garage" | "presumee";
    coutRaccordement: number;
    palier: 0 | 1 | 2 | 3;
  } | null;
  /** Candidats écartés et raison : « borne » = la borne coûte plus que
   *  l'économie du véhicule ; « raccordement » = ajouter ce véhicule ferait
   *  monter le raccordement plus que ce qu'il rapporte. */
  exclus: { id: string; unit_number?: string; raison: RaisonExclusion }[];
}

/** Les trois stratégies construites automatiquement. */
export type CleStrategieAuto = "plan_actuel" | "tout_electrique" | "economies_d_abord";
/** + « optimisee » : calendrier et technologies proposés par l'optimiseur
 *  (./optimizer.ts) sous les contraintes saisies par l'utilisateur. */
export type CleStrategie = CleStrategieAuto | "optimisee";
export const CLES_STRATEGIES: CleStrategieAuto[] = [
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
  /** Règle appliquée et raison (0 $ / réduit), programme par programme,
   *  pour chaque véhicule zéro émission (revue 1.7). */
  explicationsSubventions: Record<string, ExplicationSubvention[]>;
  /** « Économies d'abord » seulement : détail de la sélection par garage. */
  selection?: SelectionGarage[];
  /** « Économies d'abord » : aucun véhicule ne rapporte, infrastructure
   *  comprise, avec les hypothèses actuelles. */
  aucuneElectrificationRentable?: boolean;
}

export type TechnoAlternative = "diesel" | "BEV" | "FCEV";

function technoCible(
  cle: CleStrategieAuto,
  vehicule: VehiculeProjet,
  selection: Set<string> | null,
): TechnoAlternative {
  if (cle === "plan_actuel") {
    if (vehicule.target_technology === "bev") return "BEV";
    if (vehicule.target_technology === "fcev") return "FCEV";
    return "diesel";
  }
  // Catégorie « à reporter » (bloc 2.3) : jamais électrifiée par une
  // stratégie automatique — seul un choix explicite du plan le fait.
  if (raisonAReporter(vehicule.category)) return "diesel";
  if (cle === "tout_electrique") return "BEV";
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
 * 1.3 — « Économies d'abord » : MEILLEUR SOUS-ENSEMBLE PAR GARAGE,
 * bornes et raccordement compris AVANT de choisir (méthodologie §11.1).
 *
 * 1. Candidats : véhicules rentables seuls (économie BEV > 0 sans
 *    infrastructure, moteur) dont l'autonomie hivernale tient.
 * 2. Valeur nette de chaque candidat = VAN du moteur pour ce véhicule SEUL
 *    avec SA borne, sans raccordement (capacité du garage supposée
 *    suffisante pour ce calcul seulement).
 * 3. Pour chaque marche du raccordement (capacité existante, paliers 1 à
 *    3, ou devis), le sous-ensemble de valeur nette maximale qui tient sous
 *    son plafond de kW (sac à dos exact, ./selectionGarage.ts).
 * 4. Chaque proposition est RE-CHIFFRÉE par le moteur avec l'infrastructure
 *    réelle du garage (planifierInfrastructure, source unique), puis
 *    améliorée véhicule par véhicule (ajout / retrait) tant que la VAN
 *    monte. On retient la meilleure VAN si elle est positive, sinon le
 *    garage reste au diesel.
 * Un devis de raccordement saisi au niveau du projet est compté en entier
 * pour chaque garage (prudent).
 */
function selectionEconomiesDAbord(
  vehicules: VehiculeProjet[],
  options: OptionsStrategie,
): ResultatSelection {
  const enCache = cacheSelection.get(vehicules)?.get(options);
  if (enCache) return enCache;

  const parGarage = new Map<string, { depot: string | null; liste: VehiculeProjet[] }>();
  for (const v of vehicules) {
    if (!analyserDonneesVehicule(v).defauts || !dansHorizon(v, options)) continue;
    const f = evaluerFaisabiliteVehicule(v, options);
    const bev = f.evaluations?.find((e) => e.technologie === "BEV");
    const cle = cleGarage(v.depot ?? null);
    const entree = parGarage.get(cle) ?? { depot: v.depot?.trim() || null, liste: [] };
    // Autonomie hivernale insuffisante (bloc 2.4) : jamais candidat.
    if (bev && bev.economieActualisee > 0 && f.hiver?.verdict !== "ne_tient_pas") entree.liste.push(v);
    parGarage.set(cle, entree);
  }

  // Valeur nette « véhicule + sa borne » : chaque garage est supposé avoir
  // la puissance nécessaire et aucun devis de raccordement n'est compté.
  const garagesSansRaccordement = new Map<string, CaracteristiquesGarage>();
  for (const cle of parGarage.keys()) {
    garagesSansRaccordement.set(cle, {
      ...options.garages?.get(cle),
      puissanceDisponibleKw: Number.POSITIVE_INFINITY,
      devisRaccordement: null,
    });
  }
  const optionsSansRaccordement: OptionsStrategie = {
    ...options,
    garages: garagesSansRaccordement,
    surchargesEnergie: options.surchargesEnergie
      ? { ...options.surchargesEnergie, devisRaccordement: undefined }
      : undefined,
  };
  const devisProjet = options.surchargesEnergie?.devisRaccordement ?? null;

  const ids = new Set<string>();
  const detail: SelectionGarage[] = [];
  for (const [cleG, { depot, liste }] of parGarage) {
    const parId = new Map(liste.map((v) => [v.id, v]));
    const vanDe = (sousEnsemble: string[]) => {
      if (sousEnsemble.length === 0) return { van: 0, strategie: null as StrategieConstruite | null };
      const vs = sousEnsemble.map((id) => parId.get(id)!);
      const r = chiffrer(vs, "economies_d_abord", options, new Set(sousEnsemble));
      return { van: r.resultat?.vanDifferentielle ?? 0, strategie: r };
    };

    const candidats: CandidatGarage[] = liste.map((v) => {
      const seul = chiffrer([v], "economies_d_abord", optionsSansRaccordement, new Set([v.id]));
      const type = TYPE_BORNE_PAR_CATEGORIE[categorieMoteur(v.category) ?? v.category];
      return { id: v.id, kw: type ? BORNES[type].puissanceMaxKw : 0, net: seul.resultat?.vanDifferentielle ?? 0 };
    });
    const garage = options.garages?.get(cleG);
    const kwDisponibles = calculerRaccordement(0, garage).kwDisponibles;
    const devis = garage?.devisRaccordement ?? devisProjet;
    const propositions = proposerSousEnsembles(candidats, marchesRaccordement(kwDisponibles, PALIERS_RACCORDEMENT, devis));

    // Re-chiffrage exact des propositions, puis amélioration locale.
    let meilleur: string[] = [];
    let meilleureVan = 0;
    for (const p of propositions) {
      const { van } = vanDe(p.ids);
      if (van > meilleureVan + 1e-6) {
        meilleureVan = van;
        meilleur = p.ids;
      }
    }
    const utiles = candidats.filter((c) => c.net > 0).map((c) => c.id);
    for (let tour = 0; tour < utiles.length; tour++) {
      let coup: { ensemble: string[]; van: number } | null = null;
      for (const id of utiles) {
        const ensemble = meilleur.includes(id) ? meilleur.filter((x) => x !== id) : [...meilleur, id];
        const { van } = vanDe(ensemble);
        if (van > (coup?.van ?? meilleureVan) + 1e-6) coup = { ensemble, van };
      }
      if (!coup) break;
      meilleur = coup.ensemble;
      meilleureVan = coup.van;
    }
    if (meilleureVan <= 1e-6) meilleur = [];

    const retenus = new Set(meilleur);
    for (const id of retenus) ids.add(id);
    const infraRetenue = meilleur.length > 0 ? vanDe(meilleur).strategie?.infra.garages[0] : undefined;
    detail.push({
      depot,
      candidats: liste.length,
      retenus: retenus.size,
      vanAvecInfra: retenus.size > 0 ? meilleureVan : 0,
      infra: infraRetenue
        ? {
            capexBornes: infraRetenue.capexBornes,
            kwDemandes: infraRetenue.raccordement.kwDemandes,
            kwDisponibles: infraRetenue.raccordement.kwDisponibles,
            kwDisponiblesSource: infraRetenue.raccordement.kwDisponiblesSource,
            coutRaccordement: infraRetenue.raccordement.cout,
            palier: infraRetenue.raccordement.palier,
          }
        : null,
      exclus: candidats
        .filter((c) => !retenus.has(c.id))
        .map((c) => ({
          id: c.id,
          unit_number: parId.get(c.id)?.unit_number,
          raison: c.net > 0 ? ("raccordement" as const) : ("borne" as const),
        })),
    });
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
  cle: CleStrategieAuto,
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

/** Choix d'un véhicule : technologie et année CALENDAIRE de remplacement
 *  (null = sans année, traité à l'année de référence). */
export interface ChoixVehicule {
  techno: TechnoAlternative;
  annee: number | null;
}

function chiffrer(
  vehicules: VehiculeProjet[],
  cle: CleStrategieAuto,
  options: OptionsStrategie,
  selection: Set<string> | null,
): StrategieConstruite {
  return chiffrerChoix(vehicules, cle, options, (v) => ({
    techno: technoCible(cle, v, selection),
    annee: v.replacement_year,
  }));
}

/** Entrée du moteur pour UN véhicule évaluable (catégorie connue), pour
 *  une technologie et une année du plan données : spécifications du
 *  registre, subventions résolues (avec explications) puis subventions
 *  confirmées par le client. Partagée par les stratégies et l'optimiseur. */
export function entreeVehiculeMoteur(
  v: VehiculeProjet,
  techno: TechnoAlternative,
  k: number,
  options: OptionsStrategie,
): { vehicule: VehiculePlan; avertissements: string[]; explications: ExplicationSubvention[] | null } | null {
  const { defauts, kmParAn, consoReference, carburant } = analyserDonneesVehicule(v);
  if (!defauts) return null;
  const reference = {
    technologie: "diesel" as const,
    prixAvantTaxes: defauts.prixAchat.diesel.valeur,
    consommationPar100km: consoReference,
    entretienParKm: defauts.entretien.diesel.valeur,
    assuranceParAn: 0,
    evenements: [],
  };
  // Techno « diesel » = statu quo pour ce véhicule : alternative
  // identique à la référence, différentiel nul, mais le véhicule reste
  // dans les totaux (budget, émissions) des deux scénarios.
  const alternative =
    techno === "diesel"
      ? reference
      : {
          technologie: techno,
          prixAvantTaxes: v.prixDevis?.technologie === techno ? v.prixDevis.prix : defauts.prixAchat[techno].valeur,
          consommationPar100km: defauts.consommation[techno].valeur,
          entretienParKm: defauts.entretien[techno].valeur,
          assuranceParAn: 0,
          evenements: [],
        };

  let subventions: { libelle: string; montant: number; annee: number }[] = [];
  let avertissements: string[] = [];
  let explications: ExplicationSubvention[] | null = null;
  if (techno !== "diesel") {
    const resolution = resoudreSubventions(
      {
        categorie: defauts.categorie,
        technologie: techno,
        prixAvantTaxes: alternative.prixAvantTaxes,
        typeOrganisme: options.typeOrganisme,
        anneeAchatCalendaire: options.anneeReference + k,
        classePoids: classePourSubventions(v.gvwr_class),
      },
      options.programmes,
    );
    subventions = resolution.subventions.map((s) => ({
      libelle: s.libelle,
      montant: s.montant,
      annee: s.annee + k,
    }));
    avertissements = resolution.avertissements;
    explications = resolution.explications;
    // PRIORITÉ AU CLIENT : un montant confirmé par document remplace
    // la subvention résolue du même programme ; les autres s'ajoutent.
    subventions = appliquerSubventionsConfirmees(subventions, v.subventionsConfirmees, k, options.anneeReference);
  }

  return {
    vehicule: {
      id: v.id,
      kmParAn,
      classeEmissionDiesel: classeEmission(v.category),
      ...(carburant === "essence" ? { carburantReference: "essence" as const } : {}),
      reference,
      alternative,
      subventionsAlternative: subventions,
      dureeVieAns: defauts.dureeVieAns,
      anneeAcquisition: k,
    },
    avertissements,
    explications,
  };
}

/**
 * Chiffre une assignation complète (technologie + année par véhicule)
 * avec LE moteur : véhicules hors catégorie ou hors horizon signalés,
 * infrastructure par garage (source unique), subventions résolues.
 */
export function chiffrerChoix(
  vehicules: VehiculeProjet[],
  cle: CleStrategie,
  options: OptionsStrategie,
  choisir: (v: VehiculeProjet) => ChoixVehicule,
): StrategieConstruite {
  const parametres = parametresParDefaut(options);
  const exclusions: string[] = [];
  const sansAnnee: string[] = [];
  const horsHorizon: { id: string; anneeRemplacement: number }[] = [];
  const avertissementsSubventions = new Set<string>();
  const explicationsSubventions: Record<string, ExplicationSubvention[]> = {};
  const plansVehicules: NonNullable<PlanTcoEntree["vehicules"]> = [];
  const vehiculesInfra: VehiculeInfra[] = [];

  for (const v of vehicules) {
    if (!analyserDonneesVehicule(v).defauts) {
      exclusions.push(v.id);
      continue;
    }
    const choix = choisir(v);
    let k = 0;
    if (choix.annee == null) {
      sansAnnee.push(v.id);
    } else {
      k = Math.max(choix.annee - options.anneeReference, 0);
      // Remplacement APRÈS l'horizon d'analyse (revue A5) : le véhicule
      // n'a aucun effet dans la fenêtre — exclu des totaux et signalé
      // en clair (jamais un identifiant technique à l'écran).
      if (k >= options.horizonAns) {
        horsHorizon.push({ id: v.id, anneeRemplacement: options.anneeReference + k });
        continue;
      }
    }

    const entree = entreeVehiculeMoteur(v, choix.techno, k, options)!;
    for (const a of entree.avertissements) avertissementsSubventions.add(a);
    if (entree.explications) explicationsSubventions[v.id] = entree.explications;
    plansVehicules.push(entree.vehicule);

    if (choix.techno !== "diesel") {
      vehiculesInfra.push({
        id: v.id,
        unit_number: v.unit_number,
        category: v.category,
        depot: v.depot ?? null,
        technologie: choix.techno,
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
      explicationsSubventions,
    };
  }

  // Station H2 EXTERNE (§3.5 v2.5) : prix livré propre au garage et km de
  // détour reportés sur chaque véhicule à hydrogène concerné.
  const jours = HYPOTHESES.jours_utilisation_an.valeur;
  for (const g of infra.garages) {
    const r = g.ravitaillementH2;
    if (r?.mode !== "externe" || (r.prixParKg == null && r.detourKmParJour <= 0)) continue;
    for (const id of g.vehiculesFcev) {
      const i = plansVehicules.findIndex((x) => x.id === id);
      if (i < 0) continue;
      plansVehicules[i] = {
        ...plansVehicules[i],
        ...(r.prixParKg != null ? { prixH2ParKg: r.prixParKg } : {}),
        ...(r.detourKmParJour > 0 ? { kmDetourParAn: r.detourKmParJour * jours } : {}),
      };
    }
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
    explicationsSubventions,
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
  cle: CleStrategieAuto,
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

/** 1.6 — Stratégie RÉELLEMENT retenue pour le plan (Plan, PDF, Excel, snapshot). */
export interface StrategieRetenue {
  /** null = aucune stratégie appliquée : choix faits véhicule par véhicule. */
  cle: CleStrategie | null;
  /** Nombre de véhicules dont la cible diffère aujourd'hui de la stratégie appliquée. */
  ecarts: number;
}

export function strategieRetenue(
  vehicules: VehiculeProjet[],
  selectionnee: string | null | undefined,
  options: OptionsStrategie,
  /** Assignation enregistrée quand la stratégie « optimisee » a été appliquée. */
  assignationOptimisee?: { vehicules: Record<string, { annee: number; techno: TechnoAlternative }> } | null,
): StrategieRetenue {
  if (selectionnee === "optimisee") {
    // Écarts = véhicules dont l'année OU la cible diffère de l'assignation appliquée.
    const VERS: Record<TechnoAlternative, string> = { diesel: "diesel", BEV: "bev", FCEV: "fcev" };
    const ecarts = vehicules.filter((v) => {
      const c = assignationOptimisee?.vehicules[v.id];
      return c && (v.replacement_year !== c.annee || (v.target_technology ?? null) !== VERS[c.techno]);
    }).length;
    return { cle: "optimisee", ecarts };
  }
  const cle = CLES_STRATEGIES.find((c) => c === selectionnee);
  if (!cle) return { cle: null, ecarts: 0 };
  return { cle, ecarts: changementsStrategie(vehicules, cle, options).length };
}

const NOMS_STRATEGIES: Record<"fr" | "en", Record<CleStrategie, string>> = {
  fr: { plan_actuel: "Plan actuel", tout_electrique: "Tout électrique", economies_d_abord: "Économies d'abord", optimisee: "Optimisée" },
  en: { plan_actuel: "Current plan", tout_electrique: "All electric", economies_d_abord: "Savings first", optimisee: "Optimized" },
};

/** Libellé du rapport (PDF, Excel) ; l'écran utilise les clés i18n équivalentes. */
export function libelleStrategieRetenue(r: StrategieRetenue, langue: "fr" | "en"): string {
  const en = langue === "en";
  if (!r.cle) return en ? "Choices made vehicle by vehicle (Fleet step)" : "Choix faits véhicule par véhicule (étape Flotte)";
  const nom = NOMS_STRATEGIES[langue][r.cle];
  if (r.ecarts === 0) return nom;
  return en
    ? `${nom}, modified since it was applied (${r.ecarts} ${r.ecarts === 1 ? "vehicle" : "vehicles"} changed)`
    : `${nom}, modifiée depuis son application (${r.ecarts} ${r.ecarts === 1 ? "véhicule changé" : "véhicules changés"})`;
}

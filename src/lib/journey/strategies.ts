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
  planifierInfrastructure,
  sitesInfraMoteur,
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
}

type TechnoAlternative = "diesel" | "BEV" | "FCEV";

function technoCible(
  cle: CleStrategie,
  vehicule: VehiculeProjet,
  options: OptionsParametres,
): TechnoAlternative {
  if (cle === "tout_electrique") return "BEV";
  if (cle === "plan_actuel") {
    if (vehicule.target_technology === "bev") return "BEV";
    if (vehicule.target_technology === "fcev") return "FCEV";
    return "diesel";
  }
  // economies_d_abord : BEV seulement là où le moteur trouve une économie
  const bev = evaluerFaisabiliteVehicule(vehicule, options).evaluations?.[0];
  return bev && bev.economieActualisee > 0 ? "BEV" : "diesel";
}

export function construireStrategie(
  vehicules: VehiculeProjet[],
  cle: CleStrategie,
  options: OptionsParametres,
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

    const techno = technoCible(cle, v, options);
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
  options: OptionsParametres,
): ChangementCible[] {
  const changements: ChangementCible[] = [];
  for (const v of vehicules) {
    const { defauts } = analyserDonneesVehicule(v);
    if (!defauts) continue;
    if (
      v.replacement_year != null &&
      Math.max(v.replacement_year - options.anneeReference, 0) >= options.horizonAns
    ) {
      continue;
    }
    const techno = technoCible(cle, v, options);
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
  options: OptionsParametres,
): StrategieConstruite[] {
  return CLES_STRATEGIES.map((cle) => construireStrategie(vehicules, cle, options));
}

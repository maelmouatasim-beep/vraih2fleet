/**
 * Étape 3 du parcours — Stratégies : construit 2-3 stratégies de
 * remplacement à partir des véhicules du projet et les chiffre avec LE
 * moteur TCO (src/lib/tco), année d'acquisition par véhicule comprise
 * (§10.11). Aucune valeur inventée : véhicules et bornes viennent du
 * registre d'hypothèses ; les subventions du registre des programmes
 * (un programme échu avant l'année d'achat prévue n'est pas compté).
 *
 * Infrastructure v1 : un site de recharge (bornes par catégorie +
 * raccordement du dépôt) et, s'il y a des FCEV, un site H2 distinct —
 * sites homogènes pour une répartition au prorata de l'énergie.
 */
import {
  HYPOTHESES,
  calculerPlan,
  parametresParDefaut,
  resoudreSubventionsVehicule,
  type OptionsParametres,
  type PlanTcoEntree,
  type ResultatPlan,
} from "@/lib/tco";
import {
  analyserDonneesVehicule,
  classeEmission,
  evaluerFaisabiliteVehicule,
  type VehiculeFaisabilite,
} from "./feasibility";

export interface VehiculeProjet extends VehiculeFaisabilite {
  replacement_year: number | null;
  target_technology: string | null; // 'diesel' | 'bev' | 'fcev' | null
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
  infraCapex: number;
  subventionsTotal: number;
  /** Véhicules de catégorie « autre », hors moteur. */
  exclusions: string[];
  /** Véhicules sans année de remplacement (traités à l'année 0). */
  sansAnnee: string[];
}

/** Borne de recharge par catégorie (hypothèses du registre). */
const BORNE_PAR_CATEGORIE: Record<string, number> = {
  vehicule_leger: HYPOTHESES.borne_niveau2_installee.valeur,
  camionnette: HYPOTHESES.borne_niveau2_installee.valeur,
  camion_moyen: HYPOTHESES.borne_rapide_50kw_installee.valeur,
  camion_lourd: HYPOTHESES.borne_rapide_150kw_installee.valeur,
  autobus_urbain_12m: HYPOTHESES.borne_rapide_150kw_installee.valeur,
};

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
  const plansVehicules: NonNullable<PlanTcoEntree["vehicules"]> = [];
  const bevIds: string[] = [];
  const fcevIds: string[] = [];
  let infraRecharge = 0;

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
      k = Math.min(Math.max(v.replacement_year - options.anneeReference, 0), options.horizonAns);
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

    const subventions =
      techno === "diesel"
        ? []
        : resoudreSubventionsVehicule({
            categorie: defauts.categorie,
            technologie: techno,
            prixAvantTaxes: alternative.prixAvantTaxes,
            typeOrganisme: options.typeOrganisme,
            anneeAchatCalendaire: options.anneeReference + k,
          }).map((s) => ({ ...s, annee: s.annee + k }));

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

    if (techno === "BEV") {
      bevIds.push(v.id);
      infraRecharge += BORNE_PAR_CATEGORIE[v.category] ?? 0;
    } else if (techno === "FCEV") {
      fcevIds.push(v.id);
    }
  }

  if (plansVehicules.length === 0) {
    return {
      cle,
      plan: null,
      resultat: null,
      nbVehicules: 0,
      nbZeroEmission: 0,
      infraCapex: 0,
      subventionsTotal: 0,
      exclusions,
      sansAnnee,
    };
  }

  const sitesInfra: NonNullable<PlanTcoEntree["sitesInfra"]> = [];
  if (bevIds.length > 0) {
    infraRecharge += HYPOTHESES.raccordement_depot.valeur;
    sitesInfra.push({ id: "depot-recharge", capexAvantTaxes: infraRecharge, vehiculeIds: bevIds });
  }
  if (fcevIds.length > 0) {
    sitesInfra.push({
      id: "depot-h2",
      capexAvantTaxes: HYPOTHESES.station_h2_depot.valeur,
      vehiculeIds: fcevIds,
    });
  }

  const plan: PlanTcoEntree = { parametres, vehicules: plansVehicules, sitesInfra };
  const resultat = calculerPlan(plan);
  const infraCapex = sitesInfra.reduce((a, s) => a + s.capexAvantTaxes, 0);
  const subventionsTotal = resultat.alternative.flux.subventions.reduce((a, b) => a + b, 0);

  return {
    cle,
    plan,
    resultat,
    nbVehicules: plansVehicules.length,
    nbZeroEmission: bevIds.length + fcevIds.length,
    infraCapex,
    subventionsTotal,
    exclusions,
    sansAnnee,
  };
}

export function construireStrategies(
  vehicules: VehiculeProjet[],
  options: OptionsParametres,
): StrategieConstruite[] {
  return CLES_STRATEGIES.map((cle) => construireStrategie(vehicules, cle, options));
}

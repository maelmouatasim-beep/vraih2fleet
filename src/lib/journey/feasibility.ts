/**
 * Étape 2 du parcours — Faisabilité : verdict par véhicule avec raison
 * CHIFFRÉE par le vrai moteur TCO (src/lib/tco), jamais par des règles
 * de pouce. Pour chaque véhicule du projet, on compare un diesel neuf
 * équivalent à l'alternative BEV et FCEV de sa catégorie (défauts du
 * registre, consommation réelle utilisée quand elle est connue), avec
 * les subventions résolues par le registre des programmes.
 *
 * Limites assumées en v1 (affichées à l'écran) :
 * - l'infrastructure du dépôt n'est PAS incluse ici (elle est répartie
 *   à l'étape Stratégies/Plan, quand la flotte retenue est connue) ;
 * - l'autonomie n'est pas modélisée : les usages longue distance et
 *   hors route sont signalés comme réserves, pas chiffrés.
 */
import { classePourSubventions } from "@/lib/fleet/gvwr";
import { categorieMoteur, estCategorieMunicipale, raisonAReporter } from "./categories";
import { cleGarage, type CaracteristiquesGarage } from "./infrastructure";
import { diagnostiquerHiver, type DiagnosticHiver } from "./winter";
import {
  DEFAUTS_CATEGORIES,
  calculerPlan,
  parametresParDefaut,
  resoudreSubventionsVehicule,
  type OptionsParametres,
  type SubventionAppliquee,
} from "@/lib/tco";

export interface VehiculeFaisabilite {
  id: string;
  category: string;
  fuel_type: string;
  annual_km: number | null;
  consumption_per_100km: number | null;
  consumption_source: string; // saisie | telematique | estimation
  usage_profile: string | null;
  /** Année CALENDAIRE de remplacement prévue au plan. La Faisabilité
   *  calcule avec la MÊME année d'acquisition que le Plan (revue A5) ;
   *  absente = remplacement immédiat (année de référence). */
  replacement_year?: number | null;
  /** Classe de poids PNBV confirmée (1, 2a, 2b, 3-8) — barème exact des
   *  subventions par classe (bloc 2.2) ; absente = barème le plus bas. */
  gvwr_class?: string | null;
  /** Garage (dépôt) : fenêtre de recharge du diagnostic hiver (bloc 2.4). */
  depot?: string | null;
  /** Kilométrage journalier MAXIMAL (bloc 2.4) ; absent = estimé. */
  max_daily_km?: number | null;
}

export type VerdictFaisabilite = "favorable" | "conditionnel" | "defavorable";

export type ReserveFaisabilite =
  | "longue_distance"
  | "hors_route"
  | "ravitaillement_h2"
  | "recharge_journee"
  | "autonomie_hiver";
export type DonneeEstimee = "km" | "consommation" | "categorie";

export interface EvaluationTechno {
  technologie: "BEV" | "FCEV";
  verdict: VerdictFaisabilite;
  /** vanDifferentielle du moteur : POSITIF = économie vs diesel neuf. */
  economieActualisee: number;
  paybackActualiseAns: number | null;
  /** Raison quand la récupération n'arrive jamais sur l'horizon (null sinon). */
  paybackJamaisCode: "economies_negatives" | "surcout_non_resorbe" | null;
  /** CO2e évité au pot d'échappement (réservoir-à-roue). */
  co2EviteTtwTonnes: number;
  /** CO2e évité sur le cycle complet (puits-à-roue) — celui des totaux. */
  co2EviteWtwTonnes: number;
  coutParTonneWtw: number | null;
  subventions: SubventionAppliquee[];
  reserves: ReserveFaisabilite[];
}

export interface FaisabiliteVehicule {
  vehiculeId: string;
  /** null quand la catégorie n'est pas connue du moteur (« autre »)
   *  ou quand le remplacement tombe APRÈS l'horizon d'analyse. */
  evaluations: EvaluationTechno[] | null;
  kmParAnRetenu: number | null;
  donneesEstimees: DonneeEstimee[];
  /** Remplacement prévu après la fin de l'horizon d'analyse (revue A5) :
   *  véhicule exclu des calculs et des totaux, signalé en clair. */
  horsHorizon?: { anneeRemplacement: number; horizonAns: number };
  /** Catégorie sans véhicule électrique crédible aujourd'hui (bloc 2.3) :
   *  pas de verdict chiffré, jamais électrifiée automatiquement. */
  aReporter?: "pas_de_ve_credible" | "disponibilite_critique" | "cas_par_cas";
  /** Diagnostic hiver / autonomie d'un modèle électrique à batterie (bloc 2.4). */
  hiver?: DiagnosticHiver | null;
}

export function classeEmission(category: string): "legers" | "lourds" {
  const c = categorieMoteur(category) ?? category;
  return c === "vehicule_leger" || c === "camionnette" ? "legers" : "lourds";
}

export interface DonneesVehicule {
  /** null quand la catégorie n'est pas connue du moteur (« autre »). */
  defauts: (typeof DEFAUTS_CATEGORIES)[keyof typeof DEFAUTS_CATEGORIES] | null;
  kmParAn: number;
  /** Consommation du véhicule thermique neuf de référence (réelle si utilisable). */
  consoReference: number;
  /** Carburant de la référence : essence pour un véhicule actuel à
   *  essence ou hybride non rechargeable (1.8), diesel sinon. */
  carburant: "diesel" | "essence";
  donneesEstimees: DonneeEstimee[];
}

/** Prépare les données d'un véhicule pour le moteur : défauts de sa
 *  catégorie, km retenus et consommation de référence, avec la liste de
 *  ce qui relève de l'estimation. Partagé par Faisabilité et Stratégies. */
export function analyserDonneesVehicule(vehicule: VehiculeFaisabilite): DonneesVehicule {
  // Catégorie municipale (bloc 2.3) : défauts EMPRUNTÉS à une catégorie
  // du moteur, signalés comme estimation.
  const cleMoteur = categorieMoteur(vehicule.category);
  const defauts = cleMoteur ? DEFAUTS_CATEGORIES[cleMoteur] : undefined;
  if (!defauts) return { defauts: null, kmParAn: 0, consoReference: 0, carburant: "diesel", donneesEstimees: [] };

  const donneesEstimees: DonneeEstimee[] = [];
  if (estCategorieMunicipale(vehicule.category)) donneesEstimees.push("categorie");
  const kmParAn = vehicule.annual_km != null && vehicule.annual_km > 0
    ? vehicule.annual_km
    : defauts.kmParAnDefaut;
  if (vehicule.annual_km == null || vehicule.annual_km <= 0) donneesEstimees.push("km");

  // Référence = véhicule thermique NEUF équivalent, du MÊME carburant que
  // le véhicule actuel (1.8 : une Corolla à essence n'est plus comptée
  // comme un diesel). La consommation réelle (saisie/télématique) sert de
  // meilleur proxy ; sinon, défaut diesel de la catégorie (estimation).
  const carburant: "diesel" | "essence" =
    vehicule.fuel_type === "essence" || vehicule.fuel_type === "hybride" ? "essence" : "diesel";
  const consoReelleUtilisable =
    (vehicule.fuel_type === "diesel" || carburant === "essence") &&
    vehicule.consumption_per_100km != null &&
    vehicule.consumption_per_100km > 0 &&
    vehicule.consumption_source !== "estimation";
  const consoReference = consoReelleUtilisable
    ? vehicule.consumption_per_100km!
    : defauts.consommation.diesel.valeur;
  if (!consoReelleUtilisable) donneesEstimees.push("consommation");

  return { defauts, kmParAn, consoReference, carburant, donneesEstimees };
}

/**
 * Cible PRÉ-SUGGÉRÉE par la Faisabilité pour l'étape Flotte : la
 * meilleure technologie au verdict non défavorable (économie actualisée
 * la plus élevée) ; null quand aucune n'est favorable/conditionnelle ou
 * que le véhicule n'est pas évaluable (catégorie inconnue, hors horizon).
 */
export function cibleSuggeree(f: FaisabiliteVehicule): "bev" | "fcev" | null {
  if (!f.evaluations) return null;
  const candidates = f.evaluations.filter((e) => e.verdict !== "defavorable");
  if (candidates.length === 0) return null;
  const meilleure = candidates.reduce((a, b) =>
    b.economieActualisee > a.economieActualisee ? b : a,
  );
  return meilleure.technologie === "BEV" ? "bev" : "fcev";
}

export function evaluerFaisabiliteVehicule(
  vehicule: VehiculeFaisabilite,
  options: OptionsParametres & { garages?: Map<string, CaracteristiquesGarage> },
): FaisabiliteVehicule {
  const { defauts, kmParAn, consoReference, carburant, donneesEstimees } = analyserDonneesVehicule(vehicule);
  if (!defauts) {
    return { vehiculeId: vehicule.id, evaluations: null, kmParAnRetenu: null, donneesEstimees: [] };
  }

  // MÊME année d'acquisition que le Plan (revue A5) : la Faisabilité et
  // le Plan chiffrent le même calendrier. Remplacement après l'horizon :
  // aucun calcul possible dans la fenêtre — exclu et signalé en clair.
  const k =
    vehicule.replacement_year != null
      ? Math.max(vehicule.replacement_year - options.anneeReference, 0)
      : 0;
  const reporter = raisonAReporter(vehicule.category);
  if (reporter) {
    return { vehiculeId: vehicule.id, evaluations: null, kmParAnRetenu: kmParAn, donneesEstimees, aReporter: reporter };
  }
  if (k >= options.horizonAns) {
    return {
      vehiculeId: vehicule.id,
      evaluations: null,
      kmParAnRetenu: kmParAn,
      donneesEstimees,
      horsHorizon: {
        anneeRemplacement: options.anneeReference + k,
        horizonAns: options.horizonAns,
      },
    };
  }

  const parametres = parametresParDefaut(options);
  const hiver = diagnostiquerHiver({
    category: vehicule.category,
    annual_km: vehicule.annual_km,
    max_daily_km: vehicule.max_daily_km,
    fenetre: options.garages?.get(cleGarage(vehicule.depot ?? null))?.fenetreRecharge,
  });

  const evaluations = (["BEV", "FCEV"] as const).map((technologie): EvaluationTechno => {
    const prixAlternative = defauts.prixAchat[technologie].valeur;
    const subventions = resoudreSubventionsVehicule({
      categorie: defauts.categorie,
      technologie,
      prixAvantTaxes: prixAlternative,
      typeOrganisme: options.typeOrganisme,
      anneeAchatCalendaire: options.anneeReference + k,
      classePoids: classePourSubventions(vehicule.gvwr_class),
    }).map((s) => ({ ...s, annee: s.annee + k }));

    const resultat = calculerPlan({
      parametres,
      vehicules: [
        {
          id: vehicule.id,
          kmParAn,
          classeEmissionDiesel: classeEmission(vehicule.category),
          ...(carburant === "essence" ? { carburantReference: "essence" as const } : {}),
          reference: {
            technologie: "diesel",
            prixAvantTaxes: defauts.prixAchat.diesel.valeur,
            consommationPar100km: consoReference,
            entretienParKm: defauts.entretien.diesel.valeur,
          },
          alternative: {
            technologie,
            prixAvantTaxes: prixAlternative,
            consommationPar100km: defauts.consommation[technologie].valeur,
            entretienParKm: defauts.entretien[technologie].valeur,
          },
          subventionsAlternative: subventions,
          dureeVieAns: defauts.dureeVieAns,
          anneeAcquisition: k,
        },
      ],
      sitesInfra: [],
    });

    const reserves: ReserveFaisabilite[] = [];
    if (technologie === "BEV") {
      if (vehicule.usage_profile === "longue_distance") reserves.push("longue_distance");
      if (vehicule.usage_profile === "hors_route") reserves.push("hors_route");
      if (hiver?.verdict === "recharge_journee") reserves.push("recharge_journee");
      if (hiver?.verdict === "ne_tient_pas") reserves.push("autonomie_hiver");
    } else {
      // Réseau public de ravitaillement H2 embryonnaire au Québec
      // (note de l'hypothèse prix_h2_livre) : toujours signalé.
      reserves.push("ravitaillement_h2");
      if (vehicule.usage_profile === "hors_route") reserves.push("hors_route");
    }

    const economie = resultat.vanDifferentielle;
    // Autonomie hivernale insuffisante même avec une recharge en journée :
    // l'économie ne suffit pas, le BEV n'est pas faisable en l'état.
    const verdict: VerdictFaisabilite =
      economie > 0 && !reserves.includes("autonomie_hiver")
        ? reserves.length > 0
          ? "conditionnel"
          : "favorable"
        : "defavorable";

    return {
      technologie,
      verdict,
      economieActualisee: economie,
      paybackActualiseAns: resultat.paybackActualise.annees,
      paybackJamaisCode: resultat.paybackActualise.code,
      co2EviteTtwTonnes: resultat.co2EviteTtwTonnes,
      co2EviteWtwTonnes: resultat.co2EviteWtwTonnes,
      coutParTonneWtw: resultat.coutParTonneWtw,
      subventions,
      reserves,
    };
  });

  return { vehiculeId: vehicule.id, evaluations, kmParAnRetenu: kmParAn, donneesEstimees, hiver };
}

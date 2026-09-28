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
}

export type VerdictFaisabilite = "favorable" | "conditionnel" | "defavorable";

export type ReserveFaisabilite = "longue_distance" | "hors_route" | "ravitaillement_h2";
export type DonneeEstimee = "km" | "consommation";

export interface EvaluationTechno {
  technologie: "BEV" | "FCEV";
  verdict: VerdictFaisabilite;
  /** vanDifferentielle du moteur : POSITIF = économie vs diesel neuf. */
  economieActualisee: number;
  paybackActualiseAns: number | null;
  co2EviteWtwTonnes: number;
  coutParTonneWtw: number | null;
  subventions: SubventionAppliquee[];
  reserves: ReserveFaisabilite[];
}

export interface FaisabiliteVehicule {
  vehiculeId: string;
  /** null quand la catégorie n'est pas connue du moteur (« autre »). */
  evaluations: EvaluationTechno[] | null;
  kmParAnRetenu: number | null;
  donneesEstimees: DonneeEstimee[];
}

function classeEmission(category: string): "legers" | "lourds" {
  return category === "vehicule_leger" || category === "camionnette" ? "legers" : "lourds";
}

export function evaluerFaisabiliteVehicule(
  vehicule: VehiculeFaisabilite,
  options: OptionsParametres,
): FaisabiliteVehicule {
  const defauts = DEFAUTS_CATEGORIES[vehicule.category as keyof typeof DEFAUTS_CATEGORIES];
  if (!defauts) {
    return { vehiculeId: vehicule.id, evaluations: null, kmParAnRetenu: null, donneesEstimees: [] };
  }

  const donneesEstimees: DonneeEstimee[] = [];
  const kmParAn = vehicule.annual_km != null && vehicule.annual_km > 0
    ? vehicule.annual_km
    : defauts.kmParAnDefaut;
  if (vehicule.annual_km == null || vehicule.annual_km <= 0) donneesEstimees.push("km");

  // Référence = diesel NEUF équivalent. La consommation réelle du
  // véhicule (saisie/télématique) sert de meilleur proxy quand le
  // véhicule actuel est diesel ; sinon, défaut de catégorie (estimation).
  const consoReelleUtilisable =
    vehicule.fuel_type === "diesel" &&
    vehicule.consumption_per_100km != null &&
    vehicule.consumption_per_100km > 0 &&
    vehicule.consumption_source !== "estimation";
  const consoReference = consoReelleUtilisable
    ? vehicule.consumption_per_100km!
    : defauts.consommation.diesel.valeur;
  if (!consoReelleUtilisable) donneesEstimees.push("consommation");

  const parametres = parametresParDefaut(options);

  const evaluations = (["BEV", "FCEV"] as const).map((technologie): EvaluationTechno => {
    const prixAlternative = defauts.prixAchat[technologie].valeur;
    const subventions = resoudreSubventionsVehicule({
      categorie: defauts.categorie,
      technologie,
      prixAvantTaxes: prixAlternative,
      typeOrganisme: options.typeOrganisme,
    });

    const resultat = calculerPlan({
      parametres,
      vehicules: [
        {
          id: vehicule.id,
          kmParAn,
          classeEmissionDiesel: classeEmission(vehicule.category),
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
        },
      ],
      sitesInfra: [],
    });

    const reserves: ReserveFaisabilite[] = [];
    if (technologie === "BEV") {
      if (vehicule.usage_profile === "longue_distance") reserves.push("longue_distance");
      if (vehicule.usage_profile === "hors_route") reserves.push("hors_route");
    } else {
      // Réseau public de ravitaillement H2 embryonnaire au Québec
      // (note de l'hypothèse prix_h2_livre) : toujours signalé.
      reserves.push("ravitaillement_h2");
      if (vehicule.usage_profile === "hors_route") reserves.push("hors_route");
    }

    const economie = resultat.vanDifferentielle;
    const verdict: VerdictFaisabilite =
      economie > 0 ? (reserves.length > 0 ? "conditionnel" : "favorable") : "defavorable";

    return {
      technologie,
      verdict,
      economieActualisee: economie,
      paybackActualiseAns: resultat.paybackActualise.annees,
      co2EviteWtwTonnes: resultat.co2EviteWtwTonnes,
      coutParTonneWtw: resultat.coutParTonneWtw,
      subventions,
      reserves,
    };
  });

  return { vehiculeId: vehicule.id, evaluations, kmParAnRetenu: kmParAn, donneesEstimees };
}

/**
 * Types et validation (zod) des entrées/sorties du moteur TCO.
 * Implémente docs/tco-methodologie.md. Fonctions PURES : aucune date
 * implicite, aucun accès réseau ou base ; toute entrée est validée,
 * NaN et Infinity sont rejetés (`finite()`).
 */

import { z } from 'zod';

export const zTechnologie = z.enum(['diesel', 'BEV', 'FCEV']);
export type TechnologieMoteur = z.infer<typeof zTechnologie>;

const zMontant = z.number().finite();
const zMontantPositif = z.number().finite().positive();
const zMontantNonNegatif = z.number().finite().nonnegative();
const zRatio = z.number().finite().gt(-1).lt(1);

export const zParametresProjet = z.object({
  anneeReference: z.number().int().min(2000).max(2100),
  horizonAns: z.number().int().min(1).max(40),
  /** Taux NOMINAL, en décimal (0.05 = 5 %). */
  tauxActualisationNominal: z.number().finite().min(0).max(0.5),
  inflations: z.object({
    diesel: zRatio,
    electricite: zRatio,
    hydrogene: zRatio,
    entretien: zRatio,
    generale: zRatio,
  }),
  /** Prix de l'énergie AVANT TPS/TVQ (§3.1 v2.2, taxes symétriques) :
   *  la part non récupérable est ajoutée par le moteur. Le diesel
   *  comprend les accises et le SPEDE (non récupérables). */
  prixAnnee0: z.object({
    dieselParL: zMontantPositif,
    /** Essence ordinaire avant TPS/TVQ — requis seulement si un véhicule
     *  a `carburantReference: 'essence'`. */
    essenceParL: zMontantPositif.optional(),
    /** Coût EFFECTIF au compteur du dépôt (énergie + prime de puissance amortie). */
    electriciteEffectiveParKwh: zMontantPositif,
    h2LivreParKg: zMontantPositif,
  }),
  rendementRecharge: z.number().finite().gt(0).lte(1),
  /** Majoration hivernale ANNUALISÉE (part hiver × majoration), BEV et FCEV. */
  majorationHivernaleAnnualisee: z.number().finite().min(0).max(1),
  /** Part non récupérable des taxes de vente (décimal), selon le type d'organisme. */
  tauxTaxesNonRecuperables: z.number().finite().min(0).max(0.3),
  depreciationAnnuelle: z.object({
    diesel: z.number().finite().min(0).max(0.6),
    BEV: z.number().finite().min(0).max(0.6),
    FCEV: z.number().finite().min(0).max(0.6),
  }),
  plancherResiduel: z.number().finite().min(0).max(0.5),
  infra: z.object({
    entretienAnnuelPctCapex: z.number().finite().min(0).max(0.2),
    dureeVieAns: z.number().int().min(1).max(40),
  }),
  facteursEmission: z.object({
    dieselTtwLegersKgParL: zMontantPositif,
    dieselTtwLourdsKgParL: zMontantPositif,
    /** WTW diesel = TTW × ratio (≥ 1). */
    ratioWtwDiesel: z.number().finite().min(1).max(2),
    /** Essence (véhicules à essence) : TTW en kg CO2e/L et ratio WTW/TTW. */
    essenceTtwKgParL: zMontantPositif.optional(),
    ratioWtwEssence: z.number().finite().min(1).max(2).optional(),
    electriciteGParKwh: zMontantNonNegatif,
    h2KgParKg: zMontantNonNegatif,
  }),
});
export type ParametresProjet = z.infer<typeof zParametresProjet>;

export const zEvenementMajeur = z.object({
  libelle: z.string().min(1),
  annee: z.number().int().min(1),
  coutAvantTaxes: zMontantNonNegatif,
});
export type EvenementMajeur = z.infer<typeof zEvenementMajeur>;

export const zSpecVehicule = z.object({
  technologie: zTechnologie,
  prixAvantTaxes: zMontantPositif,
  /** L/100 km (diesel), kWh/100 km (BEV), kg H2/100 km (FCEV) — valeur
   *  NOMINALE en conditions tempérées (§3.3) : la majoration hivernale
   *  du moteur s'applique par-dessus pour les BEV/FCEV. */
  consommationPar100km: zMontantPositif,
  entretienParKm: zMontantNonNegatif,
  /** Assurance et immatriculation, $/an, indexées à l'inflation générale
   *  (§3.6). 0 = non fournie (aucune heuristique). */
  assuranceParAn: zMontantNonNegatif.default(0),
  /** Événements majeurs datés (§3.4) — y compris un remplacement de
   *  batterie ou de pile à combustible (montant du devis). */
  evenements: z.array(zEvenementMajeur).default([]),
});
export type SpecVehicule = z.infer<typeof zSpecVehicule>;

export const zSubventionAppliquee = z.object({
  libelle: z.string().min(1),
  montant: zMontantNonNegatif,
  /** Année de versement ABSOLUE dans le plan (0 = année de référence).
   *  Pour un véhicule acquis en année k, un versement « au point de
   *  vente » se code k, un versement un an après la livraison k+1. */
  annee: z.number().int().min(0),
});
export type SubventionAppliquee = z.infer<typeof zSubventionAppliquee>;

export const zVehiculePlan = z.object({
  id: z.string().min(1),
  libelle: z.string().optional(),
  kmParAn: zMontantPositif,
  /** Classe pour le facteur d'émission diesel de la référence. */
  classeEmissionDiesel: z.enum(['legers', 'lourds']),
  /** Carburant du véhicule thermique (référence ET statu quo) : diesel par
   *  défaut (absent) ; « essence » pour un véhicule à essence (prix et facteur
   *  d'émission de l'essence, §3.3 v2.3). La technologie reste « diesel »
   *  au sens « thermique » dans le reste du moteur. */
  carburantReference: z.enum(['diesel', 'essence']).optional(),
  /** Diesel neuf équivalent (référence statu quo). */
  reference: zSpecVehicule.refine((s) => s.technologie === 'diesel', {
    message: 'la référence est toujours un diesel neuf équivalent',
  }),
  alternative: zSpecVehicule,
  /** Subventions résolues (montant, année) — voir subsidy-resolver.ts. */
  subventionsAlternative: z.array(zSubventionAppliquee).default([]),
  /** Durée de vie utile : re-remplacement si elle échoit avant l'horizon. */
  dureeVieAns: z.number().int().min(1).max(40),
  /** Année du plan où le véhicule est remplacé (0 = année de référence).
   *  Les DEUX scénarios achètent la même année (« même calendrier de fin
   *  de vie », §4) : avant l'acquisition, le véhicule actuel est
   *  identique des deux côtés et le différentiel est nul (§10.11). */
  anneeAcquisition: z.number().int().min(0).max(40).default(0),
  /** Ravitaillement à une station H2 EXTERNE (§3.5 v2.5) : prix livré
   *  propre à cette station ($/kg avant taxes), au lieu du prix du projet.
   *  Absent = prix du projet. Ne s'applique qu'à une alternative FCEV. */
  prixH2ParKg: zMontantPositif.optional(),
  /** Kilomètres de DÉTOUR par an pour rejoindre la station externe
   *  (énergie, entretien et émissions de l'alternative FCEV). */
  kmDetourParAn: zMontantNonNegatif.optional(),
});
export type VehiculePlan = z.infer<typeof zVehiculePlan>;

export const zSiteInfra = z.object({
  id: z.string().min(1),
  capexAvantTaxes: zMontantNonNegatif,
  vehiculeIds: z.array(z.string().min(1)).min(1),
  subventions: z.array(zSubventionAppliquee).default([]),
  /** Année du plan où le site est mis en service (§3.5) : capex payé
   *  cette année-là (indexé à l'inflation générale), opex ensuite,
   *  ré-investissement en fin de durée de vie si l'horizon la dépasse. */
  anneeMiseEnService: z.number().int().min(0).max(40).default(0),
});
export type SiteInfra = z.infer<typeof zSiteInfra>;

export const zPlanTco = z.object({
  parametres: zParametresProjet,
  vehicules: z.array(zVehiculePlan).min(1),
  sitesInfra: z.array(zSiteInfra).default([]),
});
export type PlanTco = z.infer<typeof zPlanTco>;
export type PlanTcoEntree = z.input<typeof zPlanTco>;

// ---------------------------------------------------------------------------
// Sorties
// ---------------------------------------------------------------------------

/** Flux nominaux par année (index 0..H), en CAD courants. Recettes en positif
 *  dans `subventions` et `residuels` ; `net` = coûts − recettes. */
export interface FluxAnnuels {
  investissement: number[];
  /** Part de `investissement`, `residuels` et `subventions` due à
   *  l'infrastructure (bornes, raccordement, station H2) — pour la
   *  décomposition par poste (déjà comprise dans les totaux). */
  investissementInfra: number[];
  residuelsInfra: number[];
  subventionsInfra: number[];
  subventions: number[];
  energie: number[];
  entretien: number[];
  assurance: number[];
  evenements: number[];
  opexInfra: number[];
  residuels: number[];
  net: number[];
}

export interface ResultatScenario {
  flux: FluxAnnuels;
  tcoActualise: number;
  emissionsTtwTonnes: number;
  emissionsWtwTonnes: number;
}

export interface Payback {
  /** Années entières depuis le premier investissement net ; null = jamais récupéré sur l'horizon. */
  annees: number | null;
  raison: string | null;
  /** Raison stable (traduite à l'affichage) quand `annees` est null.
   *  aucun_ecart = les deux scénarios sont identiques (aucun véhicule ne
   *  change de technologie) : la récupération est sans objet (« — »). */
  code: 'economies_negatives' | 'surcout_non_resorbe' | 'aucun_ecart' | null;
}

export interface LigneBudgetaire {
  annee: number;
  investissementAlt: number;
  fonctionnementAlt: number;
  subventionsAlt: number;
  residuelsAlt: number;
  resteAFinancerAlt: number;
  netAlt: number;
  netRef: number;
  ecart: number;
}

export interface PartInfraVehicule {
  vehiculeId: string;
  siteId: string;
  part: number;
}

/** VAN différentielle par poste (§6.4) : économie ACTUALISÉE de
 *  l'alternative sur la référence, poste par poste (positif = le plan coûte
 *  moins cher sur ce poste). Σ des postes = vanDifferentielle. */
export interface DecompositionVan {
  achat: number;
  energie: number;
  /** Entretien et événements datés (batterie, réparations majeures). */
  entretien: number;
  assurance: number;
  /** Bornes, raccordement, station H2 et leur entretien, nets de leur valeur résiduelle. */
  infrastructure: number;
  subventions: number;
  /** Valeurs résiduelles des véhicules (reprises et fin d'horizon). */
  valeurResiduelle: number;
}

export interface ResultatPlan {
  engineVersion: string;
  /** Hachage stable de l'entrée validée : même empreinte + même version ⇒ mêmes chiffres. */
  empreinteEntree: string;
  horizonAns: number;
  alternative: ResultatScenario;
  reference: ResultatScenario;
  vanDifferentielle: number;
  kmActualises: number;
  tcoParKmAlt: number;
  paybackSimple: Payback;
  paybackActualise: Payback;
  co2EviteTtwTonnes: number;
  co2EviteWtwTonnes: number;
  /** Négatif = gain net par tonne évitée ; null si aucune tonne évitée. */
  coutParTonneWtw: number | null;
  vueBudgetaire: LigneBudgetaire[];
  decompositionVan: DecompositionVan;
  partsInfra: PartInfraVehicule[];
  avertissements: string[];
}

/**
 * Types du registre d'hypothèses du moteur TCO.
 *
 * Règle d'honnêteté (voir docs/tco-methodologie.md §8) :
 * - « verifie »   : la source a été réellement ouverte et la valeur lue,
 *                   à la date indiquée dans `dateVerification`.
 * - « estimation »: ordre de grandeur professionnel, plage large, à
 *                   affiner (p. ex. avec la télématique ou un devis).
 * - « a_valider » : valeur probable, source NON consultée — l'URL exacte
 *                   à consulter est fournie. Un rapport qui repose sur de
 *                   telles hypothèses l'affiche explicitement.
 * Aucune valeur, URL ou montant ne doit être inventé.
 */

export type StatutHypothese = 'verifie' | 'estimation' | 'a_valider';

export type Region = 'QC' | 'CA';

/** Unités canoniques (voir docs/tco-methodologie.md §2.4). */
export type Unite =
  | '$/L'
  | '$/kWh'
  | '$/kW/mois'
  | '$/mois'
  | '$/kg'
  | '$/km'
  | '$/an'
  | '$'
  | '$/tCO2e'
  | 'L/100km'
  | 'kWh/100km'
  | 'kgH2/100km'
  | 'kgCO2e/L'
  | 'gCO2e/kWh'
  | 'kgCO2e/kgH2'
  | 'ratio' // taux, rendements, majorations… stockés en décimal (0.05 = 5 %)
  | 'annees'
  | 'kW'
  | 'jours'
  | 'h'
  | 'CAD/USD';

export interface SourceHypothese {
  organisme: string;
  document: string;
  annee: number;
  /** Tableau, article ou page précise dans le document. */
  tableauOuPage?: string;
  url: string;
}

export interface Hypothese {
  /** Identifiant stable (clé du registre). */
  id: string;
  description: string;
  valeur: number;
  unite: Unite;
  /** Plage basse/haute pour le stress test (§7.1) — jamais un ±20 % arbitraire. */
  plage: { basse: number; haute: number };
  region: Region;
  /** Année des dollars pour les montants (absent pour ratios et facteurs physiques). */
  anneeDollars?: number;
  source: SourceHypothese;
  /** Date ISO de la dernière lecture réelle de la source (statut « verifie »),
   *  ou de la dernière tentative documentée (autres statuts). */
  dateVerification: string;
  statut: StatutHypothese;
  notes?: string;
}

/** Catégories de véhicules de la version 1 (alignées sur la future table `vehicles`). */
export type CategorieVehicule =
  | 'vehicule_leger' // berline/VUS léger de service
  | 'camionnette' // pickup/fourgonnette de service (classes 2-3)
  | 'camion_moyen' // porteur classes 4-6
  | 'camion_lourd' // classes 7-8
  | 'autobus_urbain_12m';

export type Technologie = 'diesel' | 'BEV' | 'FCEV';

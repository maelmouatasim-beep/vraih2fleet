/**
 * Registre des programmes de subventions (véhicules et infrastructure).
 *
 * Règles du moteur (docs/tco-methodologie.md §3.2) :
 * - un programme dont le statut n'est pas « actif » n'est PAS compté par
 *   défaut ; il peut être inclus manuellement avec un marquage explicite ;
 * - montant fixe ou % d'un coût admissible, plafonné ;
 * - Σ subventions ≤ coût admissible, règles de cumul respectées ;
 * - chaque subvention est comptée l'année de son versement.
 *
 * Statuts de programme vérifiés le 2026-09-28 via le workflow
 * `.github/workflows/verify-tco-sources.yml` (extraits imprimés dans les
 * logs GitHub Actions), sauf mention « a_valider ».
 */

import type { CategorieVehicule, SourceHypothese, StatutHypothese, Technologie } from './assumption-types';

export type StatutProgramme = 'actif' | 'ferme' | 'suspendu';

export type TypeOrganisme = 'municipalite' | 'societe_transport' | 'entreprise';

/** Classe de poids réglementaire (PNBV) — les barèmes Écocamionnage sont
 *  définis PAR CLASSE, pas par catégorie produit (tableau 2 des
 *  modalités). '2b' = fourgonnette 3 856-4 535 kg. */
export type ClassePoids = '2b' | '3' | '4' | '5' | '6' | '7' | '8';

export interface BaremeSubvention {
  /** Catégories de véhicules admissibles à ce barème. */
  categories: CategorieVehicule[];
  technologies: Technologie[];
  /** Classes de poids (PNBV) couvertes par ce barème, si le programme
   *  distingue les classes. Sans classe connue côté demande, le
   *  résolveur retient le barème LE PLUS BAS des classes possibles de la
   *  catégorie (jamais le plus élevé) et l'indique en avertissement. */
  classesPoids?: ClassePoids[];
  /** Pourcentage du coût admissible (décimal), s'il y a lieu. */
  pourcentage?: number;
  /** Le pourcentage est une position prudente à valider (ex. cellule
   *  vide dans le tableau officiel) : avertissement à l'application. */
  pourcentageAValider?: boolean;
  /** Montant fixe ou plafond par véhicule, en CAD. */
  plafondParVehicule: number;
  /** Montant forfaitaire selon l'ANNÉE CALENDAIRE d'achat (barème
   *  dégressif). Convention prudente pour les barèmes en année
   *  financière (1er avril) : l'année calendaire N reçoit le montant de
   *  l'année financière N→N+1 (le plus bas des deux qu'elle chevauche,
   *  le barème étant décroissant). Année absente = 0 (non compté). */
  montantParAnneeAchat?: Record<number, number>;
  notes?: string;
}

export interface ProgrammeSubvention {
  id: string;
  nom: string;
  palier: 'federal' | 'provincial';
  cible: 'vehicule' | 'infrastructure';
  statut: StatutProgramme;
  organismesAdmissibles: TypeOrganisme[];
  baremes: BaremeSubvention[];
  /** Bonification multiplicative (ex. +15 % achat local Québec), décimal.
   *  Appliquée DANS le plafond du barème (lecture prudente : « bonification
   *  de 15 % de l'aide financière », modalités Écocamionnage 6.1.5). */
  bonificationAchatLocal?: number;
  /** Plafond de CUMUL des aides publiques (toutes sources) en fraction
   *  des dépenses admissibles ; l'excédent est déduit de l'aide de CE
   *  programme (ex. Écocamionnage art. 7.14.2 : 75 %). */
  plafondCumulAidePubliquePct?: number;
  /** Règles de cumul, en clair. */
  cumul: string;
  /** Limites par organisme (nombre d'incitatifs, plafonds). */
  limites?: string;
  /** Année de versement par défaut relative à l'acquisition (0 = point de vente / année d'achat). */
  anneeVersementDefaut: 0 | 1;
  dateFin?: string;
  source: SourceHypothese;
  dateVerification: string;
  statutVerification: StatutHypothese;
  notes?: string;
}

const V = '2026-09-28';

export const PROGRAMMES: ProgrammeSubvention[] = [
  {
    id: 'pave',
    nom: 'PAVÉ — Programme pour l’abordabilité des véhicules électriques (fédéral)',
    palier: 'federal',
    cible: 'vehicule',
    statut: 'actif',
    organismesAdmissibles: ['municipalite', 'societe_transport', 'entreprise'],
    baremes: [
      {
        categories: ['vehicule_leger'],
        technologies: ['BEV', 'FCEV'],
        plafondParVehicule: 5000,
        montantParAnneeAchat: { 2026: 5000, 2027: 4000, 2028: 3000, 2029: 3000, 2030: 2000, 2031: 2000 },
        notes:
          'Véhicules légers (< 8 500 lb) neufs, transaction ≤ 50 000 $ (sans plafond si fabriqué au Canada). ' +
          'Barème dégressif VÉRIFIÉ (tableau de la page Overview, archivée) : 5 000 $ (2026), 4 000 $ (2027), ' +
          '3 000 $ (2028 et 2029), 2 000 $ (2030 et 2031).',
      },
    ],
    cumul: 'Cumulable avec Roulez vert (programmes de paliers différents).',
    limites:
      'VÉRIFIÉ (page Overview archivée) : particuliers 1 incitatif ; organisations et entreprises max 10 ; ' +
      'gouvernements provinciaux, territoriaux et MUNICIPAUX max 10 sur les 5 ans du programme. ' +
      'Le montant dépend de la date de soumission de l’évaluation d’admissibilité par le concessionnaire, ' +
      'pas de la date d’achat.',
    anneeVersementDefaut: 0,
    dateFin: '2031-03-31',
    source: {
      organisme: 'Transports Canada',
      document: 'Electric Vehicle Affordability Program: Overview (page modifiée le 2026-09-10)',
      annee: 2026,
      url: 'https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/electric-vehicle-affordability-program',
    },
    dateVerification: V,
    statutVerification: 'verifie',
    notes:
      'Transactions à partir du 2026-02-16 ; jusqu’au 2031-03-31 ou épuisement des fonds ' +
      '(2,00 G$ restants au 2026-09-01 sur 2,275 G$ — vérifié). Appliqué au point de vente.',
  },
  {
    id: 'roulez_vert',
    nom: 'Roulez vert (Québec) — véhicule neuf',
    palier: 'provincial',
    cible: 'vehicule',
    statut: 'actif',
    organismesAdmissibles: ['municipalite', 'societe_transport', 'entreprise'],
    baremes: [
      {
        categories: ['vehicule_leger'],
        technologies: ['BEV'],
        plafondParVehicule: 2000,
        notes: 'PDSF < 65 000 $. Montant 2026 ; le programme prend fin le 2026-12-31.',
      },
      {
        categories: ['vehicule_leger'],
        technologies: ['FCEV'],
        plafondParVehicule: 2000,
      },
    ],
    cumul: 'Cumulable avec le PAVÉ fédéral.',
    anneeVersementDefaut: 0,
    dateFin: '2026-12-31',
    source: {
      organisme: 'Gouvernement du Québec',
      document: 'Montant de l’aide financière pour un véhicule électrique neuf (page officielle)',
      annee: 2026,
      url: 'https://www.quebec.ca/en/transports/electric-transportation/financial-assistance-electric-vehicle/new-vehicle/amount-financial-assistance',
    },
    dateVerification: V,
    statutVerification: 'verifie',
    notes:
      'Vérifié : 2 000 $ VE, 2 000 $ pile à combustible, 1 000 $/500 $ hybride rechargeable en 2026 ; ' +
      'les taxes se calculent sur le prix AVANT rabais ; aucune subvention provinciale après le 2027-01-01. ' +
      'Volet borne à domicile 600 $ (non pertinent flotte).',
  },
  {
    id: 'ecocamionnage_v1',
    nom: 'Écocamionnage volet 1 (Québec, MTMD) — acquisition de véhicules',
    palier: 'provincial',
    cible: 'vehicule',
    statut: 'actif',
    organismesAdmissibles: ['municipalite', 'entreprise'],
    baremes: [
      {
        categories: ['camionnette'],
        technologies: ['BEV', 'FCEV'],
        classesPoids: ['2b'],
        plafondParVehicule: 2500,
        montantParAnneeAchat: { 2025: 5000, 2026: 2500, 2027: 0, 2028: 0 },
        notes:
          'Fourgonnette classe 2b (PNBV 3 856-4 535 kg), non admissible à Roulez vert : montant forfaitaire ' +
          'DÉGRESSIF PAR ANNÉE FINANCIÈRE (bascule au 1er avril, date de la facture) — 5 000 $ (2025-2026), ' +
          '2 500 $ (2026-2027, en vigueur), 0 $ (2027-2028). Vérifié (tableau 1). Convention prudente : ' +
          'l’année calendaire N reçoit le montant de l’année financière N→N+1.',
      },
      {
        categories: ['camionnette'],
        technologies: ['BEV', 'FCEV'],
        classesPoids: ['3'],
        pourcentage: 0.25,
        plafondParVehicule: 30000,
        notes: 'Classe 3 (PNBV 4 536-6 350 kg) : 25 % du coût d’achat, max 30 000 $. Vérifié (tableau 2).',
      },
      {
        categories: ['camion_moyen'],
        technologies: ['BEV', 'FCEV'],
        classesPoids: ['4'],
        pourcentage: 0.35,
        plafondParVehicule: 75000,
        notes: 'Classe 4 (PNBV 6 351-7 257 kg) : 35 % du coût d’achat, max 75 000 $. Vérifié (tableau 2).',
      },
      {
        categories: ['camion_moyen', 'camion_lourd'],
        technologies: ['BEV', 'FCEV'],
        classesPoids: ['5', '6', '7'],
        pourcentage: 0.25,
        pourcentageAValider: true,
        plafondParVehicule: 100000,
        notes:
          'Classes 5-7 (PNBV 7 258-14 969 kg) : max 100 000 $ (vérifié). La cellule « Part du coût d’achat ' +
          '(%) » de ces classes est VIDE dans le tableau 2 du PDF officiel (constaté sur le document archivé, ' +
          'rendu image haute résolution) alors que l’intro 6.1.5.2 annonce des proportions — coquille ' +
          'probable. Position prudente : 25 % (borne basse du même tableau), plafonné — À VALIDER auprès du MTMD.',
      },
      {
        categories: ['camion_lourd'],
        technologies: ['BEV', 'FCEV'],
        classesPoids: ['8'],
        pourcentage: 0.25,
        pourcentageAValider: true,
        plafondParVehicule: 150000,
        notes:
          'Classe 8 (PNBV ≥ 14 970 kg) : max 150 000 $ (vérifié) ; % du coût d’achat À VALIDER (cellule vide, ' +
          'même raison que les classes 5-7) — 25 % retenu par prudence. La bonification achat local s’applique ' +
          'DANS le plafond : le maximum reste 150 000 $.',
      },
    ],
    bonificationAchatLocal: 0.15,
    plafondCumulAidePubliquePct: 0.75,
    cumul:
      '« Un véhicule ne peut obtenir qu’une seule aide financière » au sein du programme (vérifié, 6.1.6). ' +
      'Art. 7.14.2 (VÉRIFIÉ) : le cumul des aides publiques (gouvernements du Québec et du Canada, crédits ' +
      'd’impôt inclus) ne peut dépasser 75 % des dépenses admissibles ; tout excédent est déduit de l’aide ' +
      'du programme — la contribution minimale du demandeur est de 25 %.',
    limites:
      'VÉRIFIÉ : plafond de 3 M$ d’aide par demandeur par année financière pour les acquisitions de ' +
      'véhicules (7.10 ; 1 M$/an pour les autres volets). Municipalités ADMISSIBLES au volet 1 (6.1.2). ' +
      'Inscription au Registre des propriétaires et exploitants de véhicules lourds (RPEVL) avec cote de ' +
      'sécurité satisfaisante requise, SAUF pour les fourgonnettes classe 2b (6.1.2).',
    anneeVersementDefaut: 1,
    // Programme « 2025-2028 » (titre des modalités lues) ; fin posée au
    // 31 mars 2028 par convention d'année financière québécoise — date
    // exacte à confirmer au dépôt. Prudent : aucune aide promise après.
    dateFin: '2028-03-31',
    source: {
      organisme: 'MTMD (Québec)',
      document: 'Modalités d’application du programme Écocamionnage 2025-2028, section 6.1.5',
      annee: 2025,
      tableauOuPage: 'Tableaux 1 et 2',
      url: 'https://www.quebec.ca/transports/aide-financiere/electrification/ecocamionnage/volet-1',
    },
    dateVerification: V,
    statutVerification: 'verifie',
    notes:
      'Versement unique APRÈS livraison et approbation (vérifié, 6.1.6) → année de versement par défaut : 1. ' +
      'Conditions : inscription au Registre CTQ, établissement au Québec depuis 2 ans, achat chez un ' +
      'fournisseur québécois si disponible. Autobus urbains : programme distinct (PAGTCP), pas Écocamionnage.',
  },
  {
    id: 'imhzev',
    nom: 'iVMLZE / iMHZEV (fédéral) — véhicules moyens et lourds',
    palier: 'federal',
    cible: 'vehicule',
    statut: 'ferme',
    organismesAdmissibles: ['municipalite', 'societe_transport', 'entreprise'],
    baremes: [
      {
        categories: ['camionnette', 'camion_moyen', 'camion_lourd', 'autobus_urbain_12m'],
        technologies: ['BEV', 'FCEV'],
        plafondParVehicule: 200000,
        notes: 'Jusqu’à 200 000 $ selon la catégorie, du temps du programme.',
      },
    ],
    cumul: 'N/A (fermé).',
    anneeVersementDefaut: 0,
    dateFin: '2026-03-31',
    source: {
      organisme: 'Transports Canada',
      document: 'Page officielle : « Closed: Incentives for Medium- and Heavy-Duty Zero-Emission Vehicles »',
      annee: 2026,
      url: 'https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/medium-heavy-duty-zero-emission-vehicles',
    },
    dateVerification: V,
    statutVerification: 'verifie',
    notes:
      'VÉRIFIÉ FERMÉ : « Status: Closed — The iMHZEV Program has ended » (page lue le 2026-09-28). ' +
      'NON COMPTÉ par défaut. Conservé au registre parce que l’ancien contenu du produit le présentait ' +
      'encore comme actif.',
  },
  {
    id: 'pivez',
    nom: 'PIVEZ / ZEVIP (fédéral, RNCan) — infrastructure de recharge',
    palier: 'federal',
    cible: 'infrastructure',
    statut: 'suspendu',
    organismesAdmissibles: ['municipalite', 'societe_transport', 'entreprise'],
    baremes: [
      {
        categories: ['vehicule_leger', 'camionnette', 'camion_moyen', 'camion_lourd', 'autobus_urbain_12m'],
        technologies: ['BEV'],
        pourcentage: 0.5,
        plafondParVehicule: 2000000,
        notes: '50 % des coûts admissibles, max 2 M$ par projet (volet propriétaires/exploitants).',
      },
    ],
    cumul: 'Total de l’aide publique plafonné selon les modalités du programme (à confirmer par appel de propositions).',
    anneeVersementDefaut: 1,
    source: {
      organisme: 'RNCan',
      document: 'Page officielle PIVEZ : volets « Fermé aux demandes » (propriétaires/exploitants et organismes d’exécution)',
      annee: 2026,
      url: 'https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez',
    },
    dateVerification: V,
    statutVerification: 'verifie',
    notes:
      'VÉRIFIÉ : les volets affichent « Fermé aux demandes » (page lue le 2026-09-28) ; programme disponible ' +
      'jusqu’en 2027 — de nouveaux appels peuvent rouvrir. Statut « suspendu » : NON COMPTÉ par défaut.',
  },
  {
    id: 'ftcze',
    nom: 'FTCZE — Fonds pour le transport en commun à zéro émission (fédéral, LICC)',
    palier: 'federal',
    cible: 'vehicule',
    statut: 'suspendu',
    organismesAdmissibles: ['municipalite', 'societe_transport'],
    baremes: [
      {
        categories: ['autobus_urbain_12m'],
        technologies: ['BEV', 'FCEV'],
        plafondParVehicule: 0,
        notes:
          'Montants par projet (contribution + prêt BIC), pas de barème public par véhicule — ' +
          'saisir le montant réel du projet. Plafond 0 = jamais compté automatiquement.',
      },
    ],
    cumul: 'Se combine avec le financement de la Banque de l’infrastructure du Canada (prêts autobus).',
    anneeVersementDefaut: 1,
    source: {
      organisme: 'Logement, Infrastructures et Collectivités Canada',
      document: 'Fonds pour le transport en commun à zéro émission (2,75 G$, objectif 5 000 autobus ZE)',
      annee: 2026,
      url: 'https://logement-infrastructure.canada.ca/zero-emissions-trans-zero-emissions/index-fra.html',
    },
    dateVerification: V,
    statutVerification: 'verifie',
    notes:
      'VÉRIFIÉ (page officielle lue et archivée le 2026-09-28) : « La période de soumission des demandes ' +
      'pour les projets de planification et les projets d’immobilisations… est maintenant terminée » — ' +
      'guichet FERMÉ aux nouvelles demandes, résultats à venir. Statut « suspendu » : NON COMPTÉ par ' +
      'défaut ; saisir le montant réel si un projet a été retenu. Part contributive type non publiée.',
  },
  {
    id: 'pagtcp',
    nom: 'Programme d’aide gouvernementale au transport collectif (Québec, MTMD) — électrification des autobus',
    palier: 'provincial',
    cible: 'vehicule',
    statut: 'actif',
    organismesAdmissibles: ['municipalite', 'societe_transport'],
    baremes: [
      {
        categories: ['autobus_urbain_12m'],
        technologies: ['BEV', 'FCEV'],
        plafondParVehicule: 0,
        notes:
          'Aide au surcoût d’électrification des sociétés de transport (taux et enveloppes par décret) — ' +
          'saisir le montant réel du projet. Plafond 0 = jamais compté automatiquement.',
      },
    ],
    cumul: 'Se combine au FTCZE fédéral dans les projets récents (ex. commandes ATUQ).',
    anneeVersementDefaut: 1,
    source: {
      organisme: 'MTMD (Québec)',
      document: 'Programmes d’aide au transport collectif',
      annee: 2026,
      url: 'https://www.transports.gouv.qc.ca/fr/aide-finan/transport-collectif/Pages/transport-collectif.aspx',
    },
    dateVerification: V,
    statutVerification: 'a_valider',
    notes: 'Ni le statut ni les taux n’ont pu être lus depuis l’environnement — À VALIDER avant tout calcul autobus.',
  },
];

/** Programmes comptés automatiquement par le moteur (statut actif seulement). */
export function programmesActifs(): ProgrammeSubvention[] {
  return PROGRAMMES.filter((p) => p.statut === 'actif');
}

/**
 * Statut EFFECTIF à une date donnée (ISO AAAA-MM-JJ) : un programme dont
 * la date de fin est passée est « ferme », quel que soit le statut
 * stocké — le statut affiché est toujours calculé à partir des dates,
 * jamais lu tel quel (des registres périmés affichaient des programmes
 * échus comme actifs).
 */
export function statutEffectif(prog: ProgrammeSubvention, dateIso: string): StatutProgramme {
  if (prog.dateFin !== undefined && prog.dateFin < dateIso) return 'ferme';
  return prog.statut;
}

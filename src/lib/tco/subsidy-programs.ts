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

export interface BaremeSubvention {
  /** Catégories de véhicules admissibles à ce barème. */
  categories: CategorieVehicule[];
  technologies: Technologie[];
  /** Pourcentage du coût admissible (décimal), s'il y a lieu. */
  pourcentage?: number;
  /** Montant fixe ou plafond par véhicule, en CAD. */
  plafondParVehicule: number;
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
  /** Bonification multiplicative (ex. +15 % achat local Québec), décimal. */
  bonificationAchatLocal?: number;
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
        notes:
          'Véhicules légers (< 8 500 lb) neufs, transaction ≤ 50 000 $ (sans plafond si fabriqué au Canada). ' +
          'Dégressif : 5 000 $ (2026) → 4 000 $ (2027) → 3 000 $ (2028-2029) → 2 000 $ (2030-2031).',
      },
    ],
    cumul: 'Cumulable avec Roulez vert (programmes de paliers différents).',
    limites:
      'Administrations municipales : max 10 incitatifs sur les 5 ans du programme (vérifié). ' +
      'Le montant dépend de la date de soumission de la demande par le concessionnaire, pas de la date d’achat.',
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
        plafondParVehicule: 2500,
        notes:
          'Fourgonnette classe 2b (PNBV 3 856-4 535 kg), non admissible à Roulez vert : montant forfaitaire ' +
          'régressif — 5 000 $ (2025-2026), 2 500 $ (2026-2027, en vigueur), 0 $ (2027-2028). Vérifié (tableau 1).',
      },
      {
        categories: ['camion_moyen'],
        technologies: ['BEV', 'FCEV'],
        pourcentage: 0.25,
        plafondParVehicule: 30000,
        notes: 'Classe 3 (PNBV 4 536-6 350 kg) : 25 % du coût d’achat, max 30 000 $. Vérifié (tableau 2).',
      },
      {
        categories: ['camion_moyen'],
        technologies: ['BEV', 'FCEV'],
        pourcentage: 0.35,
        plafondParVehicule: 75000,
        notes: 'Classe 4 (PNBV 6 351-7 257 kg) : 35 % du coût d’achat, max 75 000 $. Vérifié (tableau 2).',
      },
      {
        categories: ['camion_moyen'],
        technologies: ['BEV', 'FCEV'],
        plafondParVehicule: 100000,
        notes:
          'Classes 5-7 (PNBV 7 258-14 969 kg) : max 100 000 $ (vérifié) ; le % du coût d’achat n’a pas pu ' +
          'être extrait du PDF (mise en page) — À VALIDER dans les modalités, section 6.1.5.2, tableau 2.',
      },
      {
        categories: ['camion_lourd'],
        technologies: ['BEV', 'FCEV'],
        plafondParVehicule: 150000,
        notes:
          'Classe 8 (PNBV ≥ 14 970 kg) : max 150 000 $ (vérifié) ; % du coût d’achat À VALIDER (même raison). ' +
          'Avec bonification achat local : max effectif 172 500 $.',
      },
    ],
    bonificationAchatLocal: 0.15,
    cumul:
      '« Un véhicule ne peut obtenir qu’une seule aide financière » au sein du programme (vérifié, 6.1.6). ' +
      'Cumul avec un programme fédéral : non interdit par les extraits lus — règle précise À VALIDER (modalités, art. 4).',
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
    statut: 'actif',
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
    statutVerification: 'a_valider',
    notes:
      'La page officielle n’a pas pu être lue (délai réseau des deux hôtes, 2026-09-28) ; activité ' +
      'récente attestée par un communiqué de mars 2026 (investissement Transdev). À VALIDER : statut du ' +
      'guichet, part contributive type.',
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

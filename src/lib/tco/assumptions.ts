/**
 * SOURCE UNIQUE des hypothèses par défaut du moteur TCO.
 *
 * Chaque valeur porte son unité, sa plage basse/haute (stress test), sa
 * source précise, sa date de vérification et son statut. Le document
 * docs/tco-hypotheses.md est GÉNÉRÉ depuis ce fichier (test CI de
 * fraîcheur) : ne pas éditer le document à la main.
 *
 * Vérification des sources : l'environnement de développement ne peut pas
 * atteindre les sites externes ; les lectures « verifie » ont été faites
 * via le workflow `.github/workflows/verify-tco-sources.yml`, qui imprime
 * des extraits des documents officiels dans les logs GitHub Actions
 * (runs des 2026-09-28). Voir docs/tco-methodologie.md §8.
 */

import type { CategorieVehicule, Hypothese, Technologie } from './assumption-types';
import DONNEES_ENERGIE from './energy-data.json';

export { DONNEES_ENERGIE };

// ---------------------------------------------------------------------------
// Sources fréquemment citées
// ---------------------------------------------------------------------------

const SRC_REGIE_BULLETIN = {
  organisme: 'Régie de l’énergie du Québec',
  document: 'Bulletin hebdomadaire — relevés des prix à la pompe, semaine du 21 septembre 2026 (vol. 29, no 38)',
  annee: 2026,
  tableauOuPage: 'Tableau 3 (carburant diesel)',
  url: 'https://www.regie-energie.qc.ca/storage/app/media/consommateurs/informations-pratiques/prix-petrole/publications/Publications-hebdomadaires/Bulletin/bulletin.pdf',
} as const;

const SRC_HQ_GRILLE = {
  organisme: 'Hydro-Québec',
  document: 'Grille des tarifs d’électricité, en vigueur le 1er avril 2026',
  annee: 2026,
  tableauOuPage: 'Articles 3.2 (tarif G) et 4.2 (tarif M)',
  url: 'https://www.hydroquebec.com/data/documents-donnees/pdf/grille-tarifaire.pdf',
} as const;

const SRC_GUIDE_QC_GES = {
  organisme: 'MELCCFP (Québec)',
  document: 'Guide de quantification des émissions de gaz à effet de serre, février 2025',
  annee: 2025,
  tableauOuPage: 'Tableaux 5-6 (reprend RIN 1990-2022, partie II, tableau A6.1-15)',
  url: 'https://www.environnement.gouv.qc.ca/changements/ges/guide-quantification/guide-quantification-ges.pdf',
} as const;

const SRC_SCC = {
  organisme: 'Environnement et Changement climatique Canada',
  document: 'Social Cost of Greenhouse Gas Estimates — Interim Updated Guidance',
  annee: 2022,
  tableauOuPage: 'Table 1 (C$2021, taux Ramsey 2 %)',
  url: 'https://www.canada.ca/en/environment-climate-change/services/climate-change/science-research-data/social-cost-ghg.html',
} as const;

const V = '2026-09-28'; // date des lectures faites via le workflow de vérification

// ---------------------------------------------------------------------------
// Registre
// ---------------------------------------------------------------------------

export const HYPOTHESES = {
  // ----- Énergie : prix ----------------------------------------------------
  prix_diesel: {
    id: 'prix_diesel',
    description:
      'Prix du diesel HORS TPS/TVQ (accises et SPEDE compris) — MOYENNE MOBILE 12 MOIS StatCan, Montréal/Québec',
    valeur: DONNEES_ENERGIE.diesel.moyenne12MoisAvantTpsTvqParL,
    unite: '$/L',
    plage: {
      basse: DONNEES_ENERGIE.diesel.minMensuelAvantTpsTvqParL,
      haute: DONNEES_ENERGIE.diesel.spotCriseAvantTpsTvqParL,
    },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'Statistique Canada',
      document:
        'Tableau 18-10-0001-01 — diesel libre-service, moyenne 12 mois (' +
        DONNEES_ENERGIE.diesel.periode +
        ') des villes de Montréal et de Québec, série archivée (' +
        DONNEES_ENERGIE.diesel.source.archive +
        ')',
      annee: 2026,
      url: 'https://www150.statcan.gc.ca/t1/tbl1/fr/tv.action?pid=1810000101',
    },
    dateVerification: DONNEES_ENERGIE.diesel.dateVerification,
    statut: 'verifie',
    notes:
      'Valeur et plage lues depuis src/lib/tco/energy-data.json, mis à jour par le workflow hebdomadaire ' +
      'update-energy-data.yml (variation > 20 % = mise en attente, jamais appliquée automatiquement). ' +
      'Moyenne 12 mois 2,0902 $ TTC ÷ 1,14975 = 1,8179 $ AVANT TPS/TVQ — le moteur ajoute la part non ' +
      'récupérable selon l’organisme (§3.1 v2.2). Le taux de TVQ de la conversion est à_valider (taux_tvq). ' +
      'Borne basse = mois le plus bas des 12 derniers ; borne haute = SPOT DE CRISE du bulletin de la Régie ' +
      'du 2026-09-21 (2,95 $ TTC → 2,5658 $), utilisé UNIQUEMENT comme borne du scénario Favorable.',
  },  prix_essence: {
    id: 'prix_essence',
    description:
      'Prix de l’essence ordinaire HORS TPS/TVQ (taxes sur les carburants et SPEDE compris) — moyenne 12 mois StatCan, Montréal/Québec',
    valeur: 1.4549,
    unite: '$/L',
    plage: { basse: 1.2503, haute: 1.6999 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'Statistique Canada',
      document:
        'Tableau 18-10-0001-01 — essence ordinaire sans plomb libre-service, moyenne 12 mois (2025-09 à 2026-08) ' +
        'des villes de Montréal et de Québec, série archivée (data/sources/2026-10-02/statcan-essence-12mois.json)',
      annee: 2026,
      url: 'https://www150.statcan.gc.ca/t1/tbl1/fr/tv.action?pid=1810000101',
    },
    dateVerification: '2026-10-02',
    statut: 'verifie',
    notes:
      'Moyenne TTC 1,6728 $/L ÷ 1,14975 (TPS + TVQ). Plage = mois le plus bas et le plus haut des 12 (avant ' +
      'TPS/TVQ). Inflation : celle des carburants (inflation_diesel). Saisie manuelle dans le registre : la ' +
      'collecte hebdomadaire automatisée ne couvre que le diesel.',
  },

  hq_tarif_m_energie: {
    id: 'hq_tarif_m_energie',
    description: 'Hydro-Québec tarif M — prix de l’énergie (première tranche, ≤ 210 000 kWh/mois)',
    valeur: 0.06292,
    unite: '$/kWh',
    plage: { basse: 0.06292, haute: 0.08 },
    region: 'QC',
    anneeDollars: 2026,
    source: SRC_HQ_GRILLE,
    dateVerification: V,
    statut: 'verifie',
    notes: '6,292 ¢/kWh au 2026-04-01 (2e tranche : 4,666 ¢/kWh). Hausse générale 3,8 % en 2026.',
  },
  hq_tarif_m_puissance: {
    id: 'hq_tarif_m_puissance',
    description: 'Hydro-Québec tarif M — prime de puissance mensuelle',
    valeur: 18.242,
    unite: '$/kW/mois',
    plage: { basse: 18.242, haute: 22 },
    region: 'QC',
    anneeDollars: 2026,
    source: SRC_HQ_GRILLE,
    dateVerification: V,
    statut: 'verifie',
    notes:
      'Puissance à facturer minimale : 65 % de la puissance maximale appelée en hiver ' +
      '(mécanisme de « ratchet », Tarifs d’électricité 2026, art. 2.17 et équivalents).',
  },
  hq_tarif_g_energie: {
    id: 'hq_tarif_g_energie',
    description: 'Hydro-Québec tarif G — prix de l’énergie (première tranche, ≤ 15 090 kWh/mois)',
    valeur: 0.12388,
    unite: '$/kWh',
    plage: { basse: 0.09534, haute: 0.12388 },
    region: 'QC',
    anneeDollars: 2026,
    source: SRC_HQ_GRILLE,
    dateVerification: V,
    statut: 'verifie',
    notes: '12,388 ¢/kWh ; reste 9,534 ¢/kWh ; prime 22,071 $/kW au-delà de 50 kW ; accès 15,426 $/mois.',
  },
  cout_effectif_elec_depot: {
    id: 'cout_effectif_elec_depot',
    description:
      'Coût effectif de l’électricité au dépôt (énergie + prime de puissance amortie), recharge nocturne étalée',
    valeur: 0.10,
    unite: '$/kWh',
    plage: { basse: 0.075, haute: 0.16 },
    region: 'QC',
    anneeDollars: 2026,
    source: SRC_HQ_GRILLE,
    dateVerification: V,
    statut: 'estimation',
    notes:
      'Dérivé du tarif M : énergie 6,292 ¢ + prime 18,242 $/kW×12 répartie sur les kWh du site. ' +
      'Exemple : 10 camions × 40 000 kWh/an, pointe 300 kW → ≈ 0,063 + 0,164×300×12/400 000 ≈ 0,079 $/kWh ; ' +
      'recharge rapide simultanée → 0,12-0,16 $/kWh. Un devis/facture HQ saisi dans le projet est prioritaire.',
  },
  prix_h2_livre: {
    id: 'prix_h2_livre',
    description: 'Prix de l’hydrogène livré à la pompe/au dépôt',
    valeur: 16.5,
    unite: '$/kg',
    plage: { basse: 12, haute: 20 },
    region: 'CA',
    anneeDollars: 2025,
    source: {
      organisme: 'HTEC (réseau C.-B.) / Propulsion Québec',
      document: 'FAQ HTEC (prix à la pompe C.-B.) ; étude « Potentiel d’adoption de l’hydrogène vert », 2023',
      annee: 2023,
      url: 'https://www.htec.ca/faqs/',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes:
      'Réseau public QC embryonnaire (stations Hydrolux 2025-2026) : pas de prix affiché officiel au QC. ' +
      '16,50 $/kg = prix pompe C.-B. (HTEC, non lu directement) ; >17 $/kg estimé au QC hors subventions.',
  },

  // ----- Énergie : rendements et conditions --------------------------------
  rendement_recharge: {
    id: 'rendement_recharge',
    description: 'Rendement de la recharge (kWh batterie ÷ kWh compteur)',
    valeur: 0.9,
    unite: 'ratio',
    plage: { basse: 0.85, haute: 0.95 },
    region: 'CA',
    source: {
      organisme: 'RNCan',
      document: 'Documentation efficacité énergétique des VE (pertes chargeur + batterie + conditionnement)',
      annee: 2024,
      url: 'https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports',
    },
    dateVerification: V,
    statut: 'estimation',
    notes: 'Le moteur facture kWh_compteur = kWh_véhicule ÷ rendement (méthodologie §3.3).',
  },
  majoration_hivernale_bev: {
    id: 'majoration_hivernale_bev',
    description: 'Majoration de la consommation électrique en conditions hivernales (pendant les mois d’hiver)',
    valeur: 0.25,
    unite: 'ratio',
    plage: { basse: 0.1, haute: 0.4 },
    region: 'QC',
    source: {
      organisme: 'Université Concordia (données STM)',
      document: 'Étude consommation autobus électriques Montréal : 1,4 kWh/km été → 1,7 kWh/km hiver (+26 %)',
      annee: 2025,
      url: 'https://techxplore.com/news/2025-11-montreal-electric-buses-energy-winter.html',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes: 'S’applique aussi aux FCEV (chauffage cabine), plage identique par défaut.',
  },
  part_km_hiver: {
    id: 'part_km_hiver',
    description: 'Part du kilométrage annuel parcourue en conditions hivernales',
    valeur: 0.33,
    unite: 'ratio',
    plage: { basse: 0.25, haute: 0.42 },
    region: 'QC',
    source: {
      organisme: 'H2Fleet',
      document: '≈ 4 mois d’hiver sur 12, kilométrage uniforme',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
  },

  // ----- Inflations et actualisation ---------------------------------------
  inflation_generale: {
    id: 'inflation_generale',
    description: 'Inflation générale (IPC) — indexation entretien, assurance, prix d’achat futurs',
    valeur: 0.021,
    unite: 'ratio',
    plage: { basse: 0.01, haute: 0.03 },
    region: 'CA',
    source: {
      organisme: 'Banque du Canada',
      document: 'Cible de maîtrise de l’inflation (fourchette 1-3 %, cible 2 %)',
      annee: 2026,
      url: 'https://www.banqueducanada.ca/grandes-fonctions/politique-monetaire/inflation/',
    },
    dateVerification: V,
    statut: 'a_valider',
  },
  inflation_diesel: {
    id: 'inflation_diesel',
    description: 'Inflation propre au prix du diesel',
    valeur: 0.03,
    unite: 'ratio',
    plage: { basse: 0.0, haute: 0.06 },
    region: 'QC',
    source: {
      organisme: 'H2Fleet',
      document: 'Hypothèse : IPC + tarification carbone/SPEDE croissante ; à étalonner sur la série de la Régie',
      annee: 2026,
      url: 'https://www.regie-energie.qc.ca/fr/prix-produits-petroliers',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  inflation_electricite: {
    id: 'inflation_electricite',
    description: 'Inflation propre au prix de l’électricité (tarifs généraux HQ)',
    valeur: 0.035,
    unite: 'ratio',
    plage: { basse: 0.02, haute: 0.05 },
    region: 'QC',
    source: SRC_HQ_GRILLE,
    dateVerification: V,
    statut: 'estimation',
    notes: 'Point de donnée vérifié : hausse 2026 de 3,8 % aux tarifs généraux (grille 2026).',
  },
  inflation_h2: {
    id: 'inflation_h2',
    description: 'Évolution annuelle du prix de l’hydrogène livré',
    valeur: 0.0,
    unite: 'ratio',
    plage: { basse: -0.04, haute: 0.04 },
    region: 'QC',
    source: {
      organisme: 'H2Fleet',
      document: 'Marché naissant : baisse attendue des coûts de production vs coûts de distribution ; neutre par défaut',
      annee: 2026,
      url: 'https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  inflation_entretien: {
    id: 'inflation_entretien',
    description: 'Inflation propre aux coûts d’entretien (main-d’œuvre + pièces)',
    valeur: 0.025,
    unite: 'ratio',
    plage: { basse: 0.015, haute: 0.04 },
    region: 'QC',
    source: {
      organisme: 'H2Fleet',
      document: 'Hypothèse : IPC + 0,5 pt (pression main-d’œuvre spécialisée)',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  taux_actualisation_nominal: {
    id: 'taux_actualisation_nominal',
    description: 'Taux d’actualisation NOMINAL par défaut (coût d’emprunt municipal long terme)',
    valeur: 0.05,
    unite: 'ratio',
    plage: { basse: 0.03, haute: 0.07 },
    region: 'QC',
    source: {
      organisme: 'H2Fleet',
      document: 'À remplacer par le taux d’emprunt réel de l’organisme (obligations municipales 10-20 ans)',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
    notes: 'Stocké en décimal ; cohérent avec des flux NOMINAUX (méthodologie §2.2-2.3).',
  },

  // ----- Facteurs d'émission ------------------------------------------------
  fe_diesel_ttw_lourds: {
    id: 'fe_diesel_ttw_lourds',
    description: 'Facteur d’émission réservoir-à-roue, diesel, véhicules lourds (CO2+CH4+N2O)',
    valeur: 2.724,
    unite: 'kgCO2e/L',
    plage: { basse: 2.705, haute: 2.741 },
    region: 'CA',
    source: SRC_GUIDE_QC_GES,
    dateVerification: V,
    statut: 'verifie',
    notes:
      'Lu au Tableau 6 : véhicules lourds diesel, dispositif perfectionné = 2 681 g CO2 + 0,11 g CH4 + ' +
      '0,151 g N2O = 2 724 g éq. CO2/L. Sans dispositif : 2 705 ; véhicules légers diesel : 2 741.',
  },
  fe_diesel_ttw_legers: {
    id: 'fe_diesel_ttw_legers',
    description: 'Facteur d’émission réservoir-à-roue, diesel, véhicules légers et camions légers',
    valeur: 2.741,
    unite: 'kgCO2e/L',
    plage: { basse: 2.726, haute: 2.741 },
    region: 'CA',
    source: SRC_GUIDE_QC_GES,
    dateVerification: V,
    statut: 'verifie',
  },
  fe_essence_ttw_legers: {
    id: 'fe_essence_ttw_legers',
    description: 'Facteur d’émission réservoir-à-roue, essence, véhicules et camions légers neufs (niveau 3)',
    valeur: 2.312,
    unite: 'kgCO2e/L',
    plage: { basse: 2.312, haute: 2.491 },
    region: 'CA',
    source: SRC_GUIDE_QC_GES,
    dateVerification: '2026-10-02',
    statut: 'verifie',
    notes:
      'Lu au Tableau 6 (archive data/sources/2026-10-02/guide-ges-tableaux-5-6.txt) : véhicules légers à ' +
      'essence, niveau 3 = 2 307 g CO2 + 0,11 g CH4 + 0,007 g N2O = 2 312 g éq. CO2/L (référence = véhicule ' +
      'NEUF). Plage jusqu’au niveau 0 (2 491). Sert aux véhicules actuels à essence ou hybrides (revue 1.8).',
  },
  fe_diesel_amont: {
    id: 'fe_diesel_amont',
    description: 'Majoration puits-au-réservoir du diesel (extraction, raffinage, transport), en part du TTW',
    valeur: 0.25,
    unite: 'ratio',
    plage: { basse: 0.15, haute: 0.35 },
    region: 'CA',
    source: {
      organisme: 'ECCC / GHGenius',
      document: 'Modèle d’analyse du cycle de vie des carburants (GHGenius) — intensité amont du diesel',
      annee: 2024,
      url: 'https://ghgenius.ca/',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes: 'WTW diesel = TTW × (1 + majoration).',
  },
  fe_reseau_qc: {
    id: 'fe_reseau_qc',
    description: 'Intensité GES du réseau électrique du Québec (consommation)',
    valeur: 1.2,
    unite: 'gCO2e/kWh',
    plage: { basse: 0.6, haute: 35 },
    region: 'QC',
    source: {
      organisme: 'ECCC',
      document: 'Québec : aperçu sur l’électricité propre (données RIN 2022)',
      annee: 2024,
      tableauOuPage: 'Section « Émissions et production d’électricité »',
      url: 'https://www.canada.ca/fr/services/environnement/meteo/changementsclimatiques/plan-climatique/electricite-propre/apercu-quebec.html',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes:
      'Page consultée via le workflow mais la valeur chiffrée n’a pas pu être extraite du HTML ; ' +
      '1,2 g éq. CO2/kWh (2022) d’après le résumé de recherche. Borne haute 35 g : approche marginale ' +
      '(importations/pointe) pour le stress test.',
  },
  fe_h2_electrolyse_qc: {
    id: 'fe_h2_electrolyse_qc',
    description: 'Facteur d’émission puits-à-roue, H2 par électrolyse au Québec',
    valeur: 1.0,
    unite: 'kgCO2e/kgH2',
    plage: { basse: 0.4, haute: 2.5 },
    region: 'QC',
    source: {
      organisme: 'Propulsion Québec / ECCC',
      document: 'Étude hydrogène vert 2023 (électrolyse alimentée par le réseau QC) ',
      annee: 2023,
      url: 'https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes: 'Inclut compression/distribution ; dépend du transport (camion vs pipeline).',
  },
  fe_h2_smr: {
    id: 'fe_h2_smr',
    description: 'Facteur d’émission puits-à-roue, H2 par reformage du méthane (SMR) sans captage',
    valeur: 10.0,
    unite: 'kgCO2e/kgH2',
    plage: { basse: 9, haute: 12 },
    region: 'CA',
    source: {
      organisme: 'RNCan / AIE',
      document: 'Stratégie canadienne pour l’hydrogène (intensités par filière)',
      annee: 2020,
      url: 'https://ressources-naturelles.canada.ca/production-denergie/lavenir-de-lhydrogene-au-canada',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes: 'SMR avec captage (bleu) : ~3-5 kg éq. CO2/kg, à saisir par projet selon le fournisseur.',
  },
  cout_social_carbone_2026: {
    id: 'cout_social_carbone_2026',
    description: 'Coût social du carbone (SC-CO2) pour 2026 — valorisation HORS TCO',
    valeur: 275,
    unite: '$/tCO2e',
    plage: { basse: 100, haute: 400 },
    region: 'CA',
    anneeDollars: 2021,
    source: SRC_SCC,
    dateVerification: V,
    statut: 'verifie',
    notes:
      'Lu à la Table 1 : 247 $ (2020) → 275 $ (2026) → 294 $ (2030), C$2021, taux Ramsey 2 %. ' +
      'Croît chaque année ; le moteur applique la valeur de l’année du flux.',
  },

  // ----- Taxes ---------------------------------------------------------------
  taux_tps: {
    id: 'taux_tps',
    description: 'Taux de la TPS',
    valeur: 0.05,
    unite: 'ratio',
    plage: { basse: 0.05, haute: 0.05 },
    region: 'CA',
    source: {
      organisme: 'ARC',
      document: 'Facturer ou percevoir la TPS/TVH — quel taux appliquer (page lue et archivée : TPS de 5 % dans les provinces non participantes)',
      annee: 2026,
      url: 'https://www.canada.ca/fr/agence-revenu/services/impot/entreprises/sujets/tps-tvh-entreprises/facturer-percevoir-quel-taux.html',
    },
    dateVerification: '2026-09-29',
    statut: 'verifie',
    notes: 'Archive : data/sources/2026-09-29/arc-taux.txt (« facture la TPS de 5 % », province non participante).',
  },
  taux_tvq: {
    id: 'taux_tvq',
    description: 'Taux de la TVQ',
    valeur: 0.09975,
    unite: 'ratio',
    plage: { basse: 0.09975, haute: 0.09975 },
    region: 'QC',
    source: {
      organisme: 'Revenu Québec',
      document: 'Taux de la TVQ en vigueur (art. 16, Loi sur la taxe de vente du Québec)',
      annee: 2026,
      url: 'https://www.revenuquebec.ca/fr/entreprises/taxes/tpstvh-et-tvq/perception-de-la-tps-et-de-la-tvq/calcul-des-taxes/',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes:
      'Aucune source officielle n’a pu être LUE depuis nos environnements (Revenu Québec = application ' +
      'JavaScript sans contenu serveur ; LégisQuébec art. 16 LTVQ = 403 CloudFront) — taux usuel depuis 2013, ' +
      'à faire valider manuellement sur la page Revenu Québec ci-dessus.',
  },
  taux_recup_tps_municipalite: {
    id: 'taux_recup_tps_municipalite',
    description: 'Part de la TPS remboursée aux municipalités',
    valeur: 1.0,
    unite: 'ratio',
    plage: { basse: 1.0, haute: 1.0 },
    region: 'CA',
    source: {
      organisme: 'ARC',
      document: 'RC4049 — Renseignements sur la TPS/TVH pour les municipalités (publication complète, lue et archivée)',
      annee: 2025,
      url: 'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/rc4049/renseignements-tps-tvh-municipalites.html',
    },
    dateVerification: '2026-09-29',
    statut: 'verifie',
    notes:
      'VÉRIFIÉ : « Remboursement municipal … dont le taux est de 100 % de la TPS et de la partie fédérale ' +
      'de la TVH » (archive : data/sources/2026-09-29/rc4049-complet.txt).',
  },
  taux_recup_tvq_municipalite: {
    id: 'taux_recup_tvq_municipalite',
    description: 'Part de la TVQ remboursée aux municipalités (factures depuis 2015)',
    valeur: 0.5,
    unite: 'ratio',
    plage: { basse: 0.5, haute: 0.628 },
    region: 'QC',
    source: {
      organisme: 'Finances Québec',
      document:
        'Dépenses fiscales 2025, fiche 310302 — Remboursement accordé aux écoles, collèges, universités, hôpitaux et municipalités (lue et archivée)',
      annee: 2025,
      url: 'https://www.budget.finances.gouv.qc.ca/budget/outils/depenses-fiscales/fiches/fiche-310302.asp',
    },
    dateVerification: '2026-09-28',
    statut: 'verifie',
    notes:
      'VÉRIFIÉ : « le taux de remboursement des municipalités … de 50 % depuis le 1er janvier 2015 » ' +
      '(62,8 % en 2014, 43 % avant l’abolition de 1997) — archive : ' +
      'data/sources/2026-09-28/qc-depenses-fiscales-310302.txt. Taux non récupérable municipal résultant ' +
      '≈ 0,5 × 9,975 % = 4,99 % du prix avant taxes. Entreprises : CTI/RTI complets → 0 %. Sociétés de ' +
      'transport : à confirmer (organismes désignés ou non selon leur statut).',
  },

  // ----- Valeur résiduelle et durées de vie ----------------------------------
  depreciation_diesel: {
    id: 'depreciation_diesel',
    description: 'Taux de dépréciation annuel (géométrique) — véhicules diesel',
    valeur: 0.15,
    unite: 'ratio',
    plage: { basse: 0.12, haute: 0.2 },
    region: 'CA',
    source: {
      organisme: 'H2Fleet',
      document: 'Pratique d’évaluation de flotte ; à étalonner sur les encans (Ritchie Bros) par catégorie',
      annee: 2026,
      url: 'https://www.rbauction.com/',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  depreciation_bev: {
    id: 'depreciation_bev',
    description: 'Taux de dépréciation annuel (géométrique) — véhicules électriques à batterie',
    valeur: 0.18,
    unite: 'ratio',
    plage: { basse: 0.13, haute: 0.25 },
    region: 'CA',
    source: {
      organisme: 'H2Fleet',
      document: 'Marché secondaire ZE lourd encore mince : décote d’incertitude vs diesel',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  depreciation_fcev: {
    id: 'depreciation_fcev',
    description: 'Taux de dépréciation annuel (géométrique) — véhicules à pile à combustible',
    valeur: 0.2,
    unite: 'ratio',
    plage: { basse: 0.15, haute: 0.28 },
    region: 'CA',
    source: {
      organisme: 'H2Fleet',
      document: 'Marché secondaire quasi inexistant : décote maximale',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  plancher_residuel: {
    id: 'plancher_residuel',
    description: 'Plancher de valeur résiduelle (valeur ferraille/pièces), en part du prix d’achat',
    valeur: 0.1,
    unite: 'ratio',
    plage: { basse: 0.05, haute: 0.15 },
    region: 'CA',
    source: {
      organisme: 'H2Fleet',
      document: 'Convention (méthodologie §3.7)',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
  },

  // ----- Infrastructure -------------------------------------------------------
  borne_niveau2_installee: {
    id: 'borne_niveau2_installee',
    description: 'Borne niveau 2 (7-19 kW) installée au dépôt (matériel + installation)',
    valeur: 15000,
    unite: '$',
    plage: { basse: 8000, haute: 25000 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'RNCan (PIVEZ)',
      document: 'Coûts types des projets PIVEZ ; à remplacer par soumissions',
      annee: 2024,
      url: 'https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  borne_rapide_50kw_installee: {
    id: 'borne_rapide_50kw_installee',
    description: 'Borne rapide CC ~50 kW installée (matériel + installation)',
    valeur: 60000,
    unite: '$',
    plage: { basse: 40000, haute: 90000 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'RNCan (PIVEZ)',
      document: 'Coûts types des projets PIVEZ ; à remplacer par soumissions',
      annee: 2024,
      url: 'https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  borne_rapide_150kw_installee: {
    id: 'borne_rapide_150kw_installee',
    description: 'Borne rapide CC ~150 kW installée (matériel + installation)',
    valeur: 150000,
    unite: '$',
    plage: { basse: 100000, haute: 220000 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'RNCan (PIVEZ)',
      document: 'Coûts types des projets PIVEZ ; à remplacer par soumissions',
      annee: 2024,
      url: 'https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/pivez',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  raccordement_depot: {
    id: 'raccordement_depot',
    description: 'Raccordement et mise à niveau électrique d’un dépôt (entrée, transformateur, distribution)',
    valeur: 100000,
    unite: '$',
    plage: { basse: 20000, haute: 500000 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'Hydro-Québec',
      document: 'Très variable selon la capacité disponible — UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE',
      annee: 2026,
      url: 'https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html',
    },
    dateVerification: V,
    statut: 'estimation',
    notes: 'Plage de référence et valeur proposée par défaut pour un devis saisi. Le calcul d’infrastructure n’applique plus ce forfait par garage : il retient un palier selon les kW supplémentaires (raccordement_palier1 à 3).',
  },
  puissance_disponible_garage_presumee: {
    id: 'puissance_disponible_garage_presumee',
    description: 'Puissance électrique résiduelle présumée d’un garage existant, quand la puissance disponible réelle n’est pas renseignée (fiche du garage)',
    valeur: 20,
    unite: 'kW',
    plage: { basse: 0, haute: 100 },
    region: 'QC',
    source: {
      organisme: 'Hydro-Québec',
      document: 'Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE',
      annee: 2026,
      url: 'https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html',
    },
    dateVerification: V,
    statut: 'estimation',
    notes:
      'Ordre de grandeur prudent (une borne niveau 2 tient sans travaux). À remplacer par la puissance réellement ' +
      'disponible : facture Hydro-Québec (puissance appelée vs puissance de l’entrée) ou relevé d’un électricien.',
  },
  raccordement_seuil_palier1_kw: {
    id: 'raccordement_seuil_palier1_kw',
    description: 'Raccordement — limite haute du palier 1 (puissance supplémentaire au-delà de la capacité disponible du garage)',
    valeur: 50,
    unite: 'kW',
    plage: { basse: 30, haute: 75 },
    region: 'QC',
    source: {
      organisme: 'Hydro-Québec',
      document: 'Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE',
      annee: 2026,
      url: 'https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  raccordement_seuil_palier2_kw: {
    id: 'raccordement_seuil_palier2_kw',
    description: 'Raccordement — limite haute du palier 2 (au-delà : palier 3)',
    valeur: 250,
    unite: 'kW',
    plage: { basse: 150, haute: 400 },
    region: 'QC',
    source: {
      organisme: 'Hydro-Québec',
      document: 'Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE',
      annee: 2026,
      url: 'https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  raccordement_palier1: {
    id: 'raccordement_palier1',
    description: 'Mise à niveau électrique — palier 1 : jusqu’à 50 kW supplémentaires (circuits et panneau, sans changement d’entrée)',
    valeur: 20000,
    unite: '$',
    plage: { basse: 10000, haute: 50000 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'Hydro-Québec',
      document: 'Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE',
      annee: 2026,
      url: 'https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html',
    },
    dateVerification: V,
    statut: 'estimation',
    notes: 'Borne basse de la plage du raccordement de dépôt (raccordement_depot : 20 000 $ à 500 000 $).',
  },
  raccordement_palier2: {
    id: 'raccordement_palier2',
    description: 'Mise à niveau électrique — palier 2 : de 50 à 250 kW supplémentaires (nouvelle entrée ou transformateur)',
    valeur: 100000,
    unite: '$',
    plage: { basse: 50000, haute: 200000 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'Hydro-Québec',
      document: 'Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE',
      annee: 2026,
      url: 'https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html',
    },
    dateVerification: V,
    statut: 'estimation',
    notes: 'Valeur centrale du raccordement de dépôt du registre (raccordement_depot).',
  },
  raccordement_palier3: {
    id: 'raccordement_palier3',
    description: 'Mise à niveau électrique — palier 3 : plus de 250 kW supplémentaires (alimentation dédiée, poste)',
    valeur: 500000,
    unite: '$',
    plage: { basse: 200000, haute: 500000 },
    region: 'QC',
    anneeDollars: 2026,
    source: {
      organisme: 'Hydro-Québec',
      document: 'Demande d’alimentation électrique — le coût réel dépend de la capacité disponible ; UN DEVIS HQ SAISI DANS LE PROJET EST PRIORITAIRE',
      annee: 2026,
      url: 'https://www.hydroquebec.com/affaires/demenagement-travaux/demande-alimentation.html',
    },
    dateVerification: V,
    statut: 'estimation',
    notes: 'Borne haute de la plage du raccordement de dépôt du registre (raccordement_depot) ; un devis Hydro-Québec est indispensable à ce niveau.',
  },
  entretien_infra_ratio: {
    id: 'entretien_infra_ratio',
    description: 'Entretien annuel de l’infrastructure de recharge, en part du capital',
    valeur: 0.03,
    unite: 'ratio',
    plage: { basse: 0.02, haute: 0.05 },
    region: 'CA',
    source: {
      organisme: 'H2Fleet',
      document: 'Pratique de l’industrie (contrats d’entretien réseaux de recharge)',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  duree_vie_infra: {
    id: 'duree_vie_infra',
    description: 'Durée de vie de l’infrastructure de recharge',
    valeur: 15,
    unite: 'annees',
    plage: { basse: 10, haute: 20 },
    region: 'CA',
    source: {
      organisme: 'H2Fleet',
      document: 'Convention d’amortissement (méthodologie §3.5)',
      annee: 2026,
      url: 'https://github.com/maelmouatasim-beep/vraih2fleet/blob/main/docs/tco-methodologie.md',
    },
    dateVerification: V,
    statut: 'estimation',
  },
  station_h2_depot: {
    id: 'station_h2_depot',
    description: 'Station de ravitaillement H2 au dépôt (capacité moyenne, clés en main)',
    valeur: 3500000,
    unite: '$',
    plage: { basse: 1500000, haute: 8000000 },
    region: 'CA',
    anneeDollars: 2026,
    source: {
      organisme: 'Propulsion Québec / Hydrolux',
      document: 'Étude 2023 + annonces de réseau 2025-2026 (aucun prix public normalisé)',
      annee: 2023,
      url: 'https://propulsionquebec.com/wp-content/uploads/2023/11/PropulsionQc_Hydrogene-vert_VF1.pdf',
    },
    dateVerification: V,
    statut: 'a_valider',
  },

  // ----- Trajectoires, change, douanes ----------------------------------------
  trajectoire_prix_batterie: {
    id: 'trajectoire_prix_batterie',
    description: 'Baisse annuelle attendue du prix des packs batterie (désactivée par défaut dans le moteur)',
    valeur: -0.05,
    unite: 'ratio',
    plage: { basse: -0.08, haute: 0 },
    region: 'CA',
    source: {
      organisme: 'BloombergNEF',
      document: 'Lithium-Ion Battery Price Survey 2025 : pack moyen 108 $US/kWh, −8 % vs 2024 ; BEV 99 $US/kWh',
      annee: 2025,
      url: 'https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef/',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes: 'Ne s’applique qu’à la part batterie du prix (≈ 30-40 % pour un camion lourd BEV).',
  },
  taux_change_usd_cad: {
    id: 'taux_change_usd_cad',
    description: 'Taux de change USD → CAD (véhicules importés des É.-U.)',
    valeur: 1.35,
    unite: 'CAD/USD',
    plage: { basse: 1.25, haute: 1.45 },
    region: 'CA',
    source: {
      organisme: 'Banque du Canada',
      document: 'Taux de change quotidiens',
      annee: 2026,
      url: 'https://www.banqueducanada.ca/taux/taux-de-change/',
    },
    dateVerification: V,
    statut: 'a_valider',
  },
  droits_douane_ve_chine: {
    id: 'droits_douane_ve_chine',
    description: 'Droits de douane sur les VE fabriqués en Chine (régime de quota de février 2026)',
    valeur: 0.061,
    unite: 'ratio',
    plage: { basse: 0.061, haute: 1.0 },
    region: 'CA',
    source: {
      organisme: 'Ministère des Finances du Canada',
      document: 'Surtaxe de 100 % (2024) remplacée en février 2026 par un quota de 49 000 unités/an à 6,1 % ; 100 % au-delà',
      annee: 2026,
      url: 'https://www.canada.ca/fr/ministere-finances/nouvelles/2024/08/surtaxe-sur-les-vehicules-electriques-fabriques-en-chine.html',
    },
    dateVerification: V,
    statut: 'a_valider',
    notes: 'Régime instable : vérifier avant tout calcul portant sur un véhicule d’origine chinoise.',
  },
} as const satisfies Record<string, Hypothese>;

// ---------------------------------------------------------------------------
// Défauts par catégorie de véhicule (consommations, prix, entretien, durées)
// Tous « estimation » : ils servent d'ordre de grandeur tant que la flotte
// réelle (télématique, devis) n'a pas fourni la vraie valeur.
// ---------------------------------------------------------------------------

export interface DefautsCategorie {
  categorie: CategorieVehicule;
  libelle: string;
  /** Consommations par technologie (unités canoniques : L/100km, kWh/100km, kgH2/100km). */
  /** Consommations NOMINALES en conditions tempérées (§3.3) : la
   *  majoration hivernale du moteur s'applique PAR-DESSUS pour BEV et
   *  FCEV — ne jamais y mettre une moyenne annuelle incluant l'hiver
   *  (double comptage). */
  consommation: Record<Technologie, { valeur: number; plage: { basse: number; haute: number } }>;
  /** Prix d'achat avant taxes, CAD 2026. */
  prixAchat: Record<Technologie, { valeur: number; plage: { basse: number; haute: number } }>;
  /** Entretien en $/km. */
  entretien: Record<Technologie, { valeur: number; plage: { basse: number; haute: number } }>;
  /** Durée de vie utile en années (même valeur pour toutes les technologies en v1). */
  dureeVieAns: number;
  kmParAnDefaut: number;
  statut: 'estimation';
  sources: string[];
}

export const DEFAUTS_CATEGORIES: Record<CategorieVehicule, DefautsCategorie> = {
  vehicule_leger: {
    categorie: 'vehicule_leger',
    libelle: 'Véhicule léger de service (berline, VUS compact)',
    consommation: {
      diesel: { valeur: 9, plage: { basse: 7, haute: 12 } },
      BEV: { valeur: 20, plage: { basse: 16, haute: 26 } },
      FCEV: { valeur: 1.0, plage: { basse: 0.8, haute: 1.3 } },
    },
    prixAchat: {
      diesel: { valeur: 45000, plage: { basse: 35000, haute: 55000 } },
      BEV: { valeur: 55000, plage: { basse: 45000, haute: 70000 } },
      FCEV: { valeur: 75000, plage: { basse: 60000, haute: 95000 } },
    },
    entretien: {
      diesel: { valeur: 0.1, plage: { basse: 0.07, haute: 0.14 } },
      BEV: { valeur: 0.07, plage: { basse: 0.05, haute: 0.1 } },
      FCEV: { valeur: 0.09, plage: { basse: 0.06, haute: 0.13 } },
    },
    dureeVieAns: 10,
    kmParAnDefaut: 25000,
    statut: 'estimation',
    sources: ['RNCan — Guide de consommation de carburant (à_valider : https://ressources-naturelles.canada.ca/efficacite-energetique/efficacite-energetique-transports/guide-consommation-carburant)'],
  },
  camionnette: {
    categorie: 'camionnette',
    libelle: 'Camionnette / fourgonnette de service (classes 2b-3)',
    consommation: {
      diesel: { valeur: 15, plage: { basse: 12, haute: 20 } },
      BEV: { valeur: 32, plage: { basse: 25, haute: 45 } },
      FCEV: { valeur: 1.6, plage: { basse: 1.2, haute: 2.2 } },
    },
    prixAchat: {
      diesel: { valeur: 68000, plage: { basse: 55000, haute: 85000 } },
      BEV: { valeur: 95000, plage: { basse: 75000, haute: 125000 } },
      FCEV: { valeur: 150000, plage: { basse: 110000, haute: 200000 } },
    },
    entretien: {
      diesel: { valeur: 0.14, plage: { basse: 0.1, haute: 0.2 } },
      BEV: { valeur: 0.1, plage: { basse: 0.07, haute: 0.14 } },
      FCEV: { valeur: 0.13, plage: { basse: 0.09, haute: 0.18 } },
    },
    dureeVieAns: 10,
    kmParAnDefaut: 30000,
    statut: 'estimation',
    sources: ['NREL Fleet DNA / RNCan (à_valider : https://www.nrel.gov/transportation/fleettest.html)'],
  },
  camion_moyen: {
    categorie: 'camion_moyen',
    libelle: 'Camion porteur moyen (classes 4-6)',
    consommation: {
      diesel: { valeur: 26, plage: { basse: 20, haute: 34 } },
      BEV: { valeur: 62, plage: { basse: 45, haute: 85 } },
      FCEV: { valeur: 4.5, plage: { basse: 3.2, haute: 6 } },
    },
    prixAchat: {
      diesel: { valeur: 140000, plage: { basse: 110000, haute: 180000 } },
      BEV: { valeur: 300000, plage: { basse: 220000, haute: 400000 } },
      FCEV: { valeur: 460000, plage: { basse: 350000, haute: 620000 } },
    },
    entretien: {
      diesel: { valeur: 0.25, plage: { basse: 0.18, haute: 0.35 } },
      BEV: { valeur: 0.18, plage: { basse: 0.12, haute: 0.26 } },
      FCEV: { valeur: 0.23, plage: { basse: 0.16, haute: 0.33 } },
    },
    dureeVieAns: 12,
    kmParAnDefaut: 35000,
    statut: 'estimation',
    sources: ['NREL / NACFE (à_valider : https://nacfe.org/)'],
  },
  camion_lourd: {
    categorie: 'camion_lourd',
    libelle: 'Camion lourd (classes 7-8)',
    consommation: {
      diesel: { valeur: 36, plage: { basse: 28, haute: 46 } },
      BEV: { valeur: 115, plage: { basse: 85, haute: 150 } },
      FCEV: { valeur: 8, plage: { basse: 6, haute: 10.5 } },
    },
    prixAchat: {
      diesel: { valeur: 200000, plage: { basse: 160000, haute: 260000 } },
      BEV: { valeur: 460000, plage: { basse: 350000, haute: 620000 } },
      FCEV: { valeur: 720000, plage: { basse: 520000, haute: 950000 } },
    },
    entretien: {
      diesel: { valeur: 0.35, plage: { basse: 0.25, haute: 0.5 } },
      BEV: { valeur: 0.25, plage: { basse: 0.17, haute: 0.36 } },
      FCEV: { valeur: 0.32, plage: { basse: 0.22, haute: 0.46 } },
    },
    dureeVieAns: 12,
    kmParAnDefaut: 60000,
    statut: 'estimation',
    sources: ['NACFE Run on Less Electric / constructeurs (à_valider)'],
  },
  autobus_urbain_12m: {
    categorie: 'autobus_urbain_12m',
    libelle: 'Autobus urbain 12 m',
    consommation: {
      diesel: { valeur: 45, plage: { basse: 35, haute: 58 } },
      // 140 = 1,4 kWh/km « été » (Concordia/STM) : valeur NOMINALE
      // TEMPÉRÉE — la majoration hivernale du moteur s'applique
      // par-dessus. L'ancienne valeur 150 (proche de la moyenne annuelle
      // incluant l'hiver) comptait l'hiver DEUX FOIS (revue externe, A4).
      BEV: { valeur: 140, plage: { basse: 120, haute: 170 } },
      FCEV: { valeur: 9, plage: { basse: 7, haute: 11.5 } },
    },
    prixAchat: {
      diesel: { valeur: 750000, plage: { basse: 650000, haute: 900000 } },
      BEV: { valeur: 1720000, plage: { basse: 1500000, haute: 2000000 } },
      FCEV: { valeur: 2400000, plage: { basse: 1900000, haute: 3100000 } },
    },
    entretien: {
      diesel: { valeur: 0.95, plage: { basse: 0.7, haute: 1.3 } },
      BEV: { valeur: 0.7, plage: { basse: 0.5, haute: 1.0 } },
      FCEV: { valeur: 0.9, plage: { basse: 0.65, haute: 1.25 } },
    },
    dureeVieAns: 16,
    kmParAnDefaut: 60000,
    statut: 'estimation',
    sources: [
      'BEV kWh/km : Université Concordia/STM, 1,4 été-1,7 hiver kWh/km (à_valider : https://techxplore.com/news/2025-11-montreal-electric-buses-energy-winter.html)',
      'Prix BEV : contrat ATUQ/Nova Bus 2023 — 339 LFSe+ pour 583 M$ ≈ 1,72 M$/unité (à_valider : https://www.newswire.ca/fr/news-releases/nova-bus-marque-l-histoire-en-remportant-un-appel-d-offres-pour-une-commande-de-jusqu-a-1-229-autobus-electriques-a-grande-autonomie-au-quebec-862154677.html)',
    ],
  },
};

/** Liste plate des hypothèses (pour la génération du doc et l'empreinte). */
export const LISTE_HYPOTHESES: Hypothese[] = Object.values(HYPOTHESES);

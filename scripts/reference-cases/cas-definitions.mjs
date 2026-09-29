/**
 * DÉFINITIONS des cas de référence du moteur TCO — source unique.
 * Les ENTRÉES seulement : les sorties attendues sont produites par le
 * contre-calculateur indépendant (contre-calcul.mjs) via generate.mjs,
 * jamais écrites à la main, jamais copiées depuis le moteur.
 */

import { readFileSync } from 'node:fs';

// Le prix du diesel des cas suit la couche « données » (src/lib/tco/
// energy-data.json, mise à jour par le workflow update-energy-data.yml) :
// le test defaults.test.ts exige l'égalité parametresParDefaut ≡
// PARAMETRES_CAS, et le workflow régénère le JSON des cas après chaque
// mise à jour appliquée.
const DONNEES_ENERGIE = JSON.parse(
  readFileSync(new URL('../../src/lib/tco/energy-data.json', import.meta.url), 'utf8'),
);

export const PARAMETRES_CAS = {
  anneeReference: 2026,
  horizonAns: 10,
  tauxActualisationNominal: 0.05,
  inflations: { diesel: 0.03, electricite: 0.035, hydrogene: 0.0, entretien: 0.025, generale: 0.021 },
  // Prix AVANT TPS/TVQ (§3.1 v2.2). Diesel : MOYENNE MOBILE 12 MOIS
  // StatCan 18-10-0001-01 (Montréal/Québec libre-service, TTC ÷ 1,14975),
  // lue depuis energy-data.json — le spot de crise (2,95 $ TTC) n'est que
  // la borne haute du scénario Favorable. Le tarif HQ et le prix H2
  // livré s'entendent déjà avant taxes.
  prixAnnee0: {
    dieselParL: DONNEES_ENERGIE.diesel.moyenne12MoisAvantTpsTvqParL,
    electriciteEffectiveParKwh: 0.1,
    h2LivreParKg: 16.5,
  },
  rendementRecharge: 0.9,
  majorationHivernaleAnnualisee: 0.25 * 0.33,
  tauxTaxesNonRecuperables: 0.049875,
  depreciationAnnuelle: { diesel: 0.15, BEV: 0.18, FCEV: 0.2 },
  plancherResiduel: 0.1,
  infra: { entretienAnnuelPctCapex: 0.03, dureeVieAns: 15 },
  facteursEmission: {
    dieselTtwLegersKgParL: 2.741,
    dieselTtwLourdsKgParL: 2.724,
    ratioWtwDiesel: 1.25,
    electriciteGParKwh: 1.2,
    h2KgParKg: 1.0,
  },
};

/** Durée de vie « hors horizon » : aucun re-remplacement dans le cas. */
const SANS_REREMPLACEMENT = 30;

const vlCas6 = (id) => ({
  id,
  kmParAn: 25000,
  classeEmissionDiesel: 'legers',
  reference: { technologie: 'diesel', prixAvantTaxes: 45000, consommationPar100km: 9, entretienParKm: 0.1 },
  alternative: { technologie: 'BEV', prixAvantTaxes: 49500, consommationPar100km: 20, entretienParKm: 0.07 },
  subventionsAlternative: [{ libelle: 'PAVÉ + Roulez vert', montant: 7000, annee: 0 }],
  dureeVieAns: 10, // re-remplacement à l'année 10 (horizon 12)
});

const moyenCas6 = (id) => ({
  id,
  kmParAn: 35000,
  classeEmissionDiesel: 'lourds',
  reference: { technologie: 'diesel', prixAvantTaxes: 140000, consommationPar100km: 26, entretienParKm: 0.25 },
  alternative: { technologie: 'BEV', prixAvantTaxes: 300000, consommationPar100km: 62, entretienParKm: 0.18 },
  subventionsAlternative: [{ libelle: 'Écocamionnage classes 5-7 (25 %)', montant: 75000, annee: 1 }],
  dureeVieAns: 12,
});

export const CAS = [
  {
    id: 1,
    titre: 'Camionnette de service BEV',
    notes:
      "Subvention Écocamionnage classe 2b : 2 500 $ forfaitaires (barème 2026-2027), versée à l'année 1 " +
      '(versement unique après livraison et approbation, modalités 6.1.6).',
    plan: {
      parametres: PARAMETRES_CAS,
      vehicules: [
        {
          id: 'camionnette',
          kmParAn: 30000,
          classeEmissionDiesel: 'legers',
          reference: { technologie: 'diesel', prixAvantTaxes: 68000, consommationPar100km: 15, entretienParKm: 0.14 },
          alternative: { technologie: 'BEV', prixAvantTaxes: 95000, consommationPar100km: 32, entretienParKm: 0.1 },
          subventionsAlternative: [{ libelle: 'Écocamionnage classe 2b', montant: 2500, annee: 1 }],
          dureeVieAns: SANS_REREMPLACEMENT,
        },
      ],
      sitesInfra: [{ id: 'depot', capexAvantTaxes: 15000, vehiculeIds: ['camionnette'] }],
    },
  },
  {
    id: 2,
    titre: 'Autobus urbain 12 m BEV',
    notes:
      'Aucune subvention comptée : FTCZE et PAGTCP sont des montants par projet (plafond automatique 0 ' +
      'dans le registre — jamais comptés sans saisie).',
    plan: {
      parametres: PARAMETRES_CAS,
      vehicules: [
        {
          id: 'bus',
          kmParAn: 60000,
          classeEmissionDiesel: 'lourds',
          reference: { technologie: 'diesel', prixAvantTaxes: 750000, consommationPar100km: 45, entretienParKm: 0.95 },
          alternative: { technologie: 'BEV', prixAvantTaxes: 1720000, consommationPar100km: 140, entretienParKm: 0.7 },
          dureeVieAns: SANS_REREMPLACEMENT,
        },
      ],
      sitesInfra: [{ id: 'depot', capexAvantTaxes: 250000, vehiculeIds: ['bus'] }],
    },
  },
  {
    id: 3,
    titre: 'Camion lourd BEV (classe 8)',
    notes:
      'Écocamionnage classe 8 (classe de poids CONNUE) : 25 % x 460 000 = 115 000 $ (sous le plafond de ' +
      '150 000 $), année 1. Le % des classes 5-8 est une position prudente À VALIDER : la cellule « Part ' +
      'du coût d’achat (%) » est vide dans le tableau 2 du PDF officiel archivé (coquille probable) — ' +
      '25 % = borne basse du même tableau.',
    plan: {
      parametres: PARAMETRES_CAS,
      vehicules: [
        {
          id: 'c8',
          kmParAn: 60000,
          classeEmissionDiesel: 'lourds',
          reference: { technologie: 'diesel', prixAvantTaxes: 200000, consommationPar100km: 36, entretienParKm: 0.35 },
          alternative: { technologie: 'BEV', prixAvantTaxes: 460000, consommationPar100km: 115, entretienParKm: 0.25 },
          subventionsAlternative: [{ libelle: 'Écocamionnage classe 8 (25 %)', montant: 115000, annee: 1 }],
          dureeVieAns: SANS_REREMPLACEMENT,
        },
      ],
      sitesInfra: [{ id: 'depot', capexAvantTaxes: 250000, vehiculeIds: ['c8'] }],
    },
  },
  {
    id: 4,
    titre: 'Véhicule léger BEV',
    notes:
      'PAVÉ 5 000 $ + Roulez vert 2 000 $, cumulés au point de vente (année 0). ' +
      'Admissible : transaction 49 500 $ <= 50 000 $ (PAVÉ) et PDSF < 65 000 $ (RV).',
    plan: {
      parametres: PARAMETRES_CAS,
      vehicules: [
        {
          id: 'vl',
          kmParAn: 25000,
          classeEmissionDiesel: 'legers',
          reference: { technologie: 'diesel', prixAvantTaxes: 45000, consommationPar100km: 9, entretienParKm: 0.1 },
          alternative: { technologie: 'BEV', prixAvantTaxes: 49500, consommationPar100km: 20, entretienParKm: 0.07 },
          subventionsAlternative: [{ libelle: 'PAVÉ + Roulez vert', montant: 7000, annee: 0 }],
          dureeVieAns: SANS_REREMPLACEMENT,
        },
      ],
      sitesInfra: [{ id: 'depot', capexAvantTaxes: 15000, vehiculeIds: ['vl'] }],
    },
  },
  {
    id: 5,
    titre: 'Camion lourd FCEV (H2 électrolyse)',
    notes:
      "Écocamionnage : 25 % x 720 000 = 180 000 $, PLAFONNÉ à 150 000 $, année 1. Infra = 0 : " +
      "ravitaillement externe, le prix du H2 livré porte l'infrastructure.",
    plan: {
      parametres: PARAMETRES_CAS,
      vehicules: [
        {
          id: 'h2',
          kmParAn: 60000,
          classeEmissionDiesel: 'lourds',
          reference: { technologie: 'diesel', prixAvantTaxes: 200000, consommationPar100km: 36, entretienParKm: 0.35 },
          alternative: { technologie: 'FCEV', prixAvantTaxes: 720000, consommationPar100km: 8, entretienParKm: 0.32 },
          subventionsAlternative: [{ libelle: 'Écocamionnage classe 8 (plafond)', montant: 150000, annee: 1 }],
          dureeVieAns: SANS_REREMPLACEMENT,
        },
      ],
      sitesInfra: [],
    },
  },
  {
    id: 6,
    titre: 'Mini-plan 5 véhicules (horizon 12 ans, infra partagée, re-remplacement)',
    notes: '',
    plan: {
      parametres: { ...PARAMETRES_CAS, horizonAns: 12 },
      vehicules: [
        vlCas6('vl1'),
        vlCas6('vl2'),
        {
          id: 'camionnette',
          kmParAn: 30000,
          classeEmissionDiesel: 'legers',
          reference: { technologie: 'diesel', prixAvantTaxes: 68000, consommationPar100km: 15, entretienParKm: 0.14 },
          alternative: { technologie: 'BEV', prixAvantTaxes: 95000, consommationPar100km: 32, entretienParKm: 0.1 },
          subventionsAlternative: [{ libelle: 'Écocamionnage classe 2b', montant: 2500, annee: 1 }],
          dureeVieAns: 12,
        },
        moyenCas6('cm1'),
        moyenCas6('cm2'),
      ],
      sitesInfra: [
        { id: 'depot', capexAvantTaxes: 135000, vehiculeIds: ['vl1', 'vl2', 'camionnette', 'cm1', 'cm2'] },
      ],
    },
  },
  {
    id: 7,
    titre: 'Autobus urbain 12 m BEV — vie complète 16 ans (avant PAGTCP/FTCZE)',
    notes:
      "Horizon = durée de vie complète (16 ans). AUCUNE subvention comptée : PAGTCP et FTCZE sont des " +
      "montants par projet non vérifiés (« avant PAGTCP/FTCZE ») — le cas montre l'économique brut de " +
      "l'autobus sur sa vie. Défauts de catégorie du registre (prix, consommations, entretien).",
    plan: {
      parametres: { ...PARAMETRES_CAS, horizonAns: 16 },
      vehicules: [
        {
          id: 'bus16',
          kmParAn: 60000,
          classeEmissionDiesel: 'lourds',
          reference: { technologie: 'diesel', prixAvantTaxes: 750000, consommationPar100km: 45, entretienParKm: 0.95 },
          alternative: { technologie: 'BEV', prixAvantTaxes: 1720000, consommationPar100km: 140, entretienParKm: 0.7 },
          dureeVieAns: 16,
        },
      ],
      sitesInfra: [{ id: 'depot', capexAvantTaxes: 250000, vehiculeIds: ['bus16'] }],
    },
  },
];

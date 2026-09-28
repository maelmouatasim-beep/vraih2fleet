/**
 * Construction des 6 cas de référence de la Phase 1A sous forme
 * d'entrées du moteur. Les valeurs attendues vivent dans
 * docs/tco-cas-de-reference.json (contre-calcul indépendant) : ne JAMAIS
 * modifier ce fichier pour faire passer un test — en cas d'écart,
 * déterminer qui a tort (moteur, cas, ou méthodologie) et corriger la
 * vraie cause.
 */

import type { ParametresProjet, PlanTcoEntree } from '../types';

export const PARAMETRES_CAS: ParametresProjet = {
  anneeReference: 2026,
  horizonAns: 10,
  tauxActualisationNominal: 0.05,
  inflations: { diesel: 0.03, electricite: 0.035, hydrogene: 0.0, entretien: 0.025, generale: 0.021 },
  prixAnnee0: { dieselParL: 2.95, electriciteEffectiveParKwh: 0.1, h2LivreParKg: 16.5 },
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

export function cas1(): PlanTcoEntree {
  return {
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
  };
}

export function cas2(): PlanTcoEntree {
  return {
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
  };
}

export function cas3(): PlanTcoEntree {
  return {
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
  };
}

export function cas4(): PlanTcoEntree {
  return {
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
  };
}

export function cas5(): PlanTcoEntree {
  return {
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
  };
}

export function cas6(): PlanTcoEntree {
  const vl = (id: string) => ({
    id,
    kmParAn: 25000,
    classeEmissionDiesel: 'legers' as const,
    reference: { technologie: 'diesel' as const, prixAvantTaxes: 45000, consommationPar100km: 9, entretienParKm: 0.1 },
    alternative: { technologie: 'BEV' as const, prixAvantTaxes: 49500, consommationPar100km: 20, entretienParKm: 0.07 },
    subventionsAlternative: [{ libelle: 'PAVÉ + Roulez vert', montant: 7000, annee: 0 }],
    dureeVieAns: 10, // re-remplacement à l'année 10 (horizon 12)
  });
  const moyen = (id: string) => ({
    id,
    kmParAn: 35000,
    classeEmissionDiesel: 'lourds' as const,
    reference: { technologie: 'diesel' as const, prixAvantTaxes: 140000, consommationPar100km: 26, entretienParKm: 0.25 },
    alternative: { technologie: 'BEV' as const, prixAvantTaxes: 300000, consommationPar100km: 62, entretienParKm: 0.18 },
    subventionsAlternative: [{ libelle: 'Écocamionnage classes 5-7 (25 %)', montant: 75000, annee: 1 }],
    dureeVieAns: 12,
  });
  return {
    parametres: { ...PARAMETRES_CAS, horizonAns: 12 },
    vehicules: [
      vl('vl1'),
      vl('vl2'),
      {
        id: 'camionnette',
        kmParAn: 30000,
        classeEmissionDiesel: 'legers',
        reference: { technologie: 'diesel', prixAvantTaxes: 68000, consommationPar100km: 15, entretienParKm: 0.14 },
        alternative: { technologie: 'BEV', prixAvantTaxes: 95000, consommationPar100km: 32, entretienParKm: 0.1 },
        subventionsAlternative: [{ libelle: 'Écocamionnage classe 2b', montant: 2500, annee: 1 }],
        dureeVieAns: 12,
      },
      moyen('cm1'),
      moyen('cm2'),
    ],
    sitesInfra: [
      {
        id: 'depot',
        capexAvantTaxes: 135000,
        vehiculeIds: ['vl1', 'vl2', 'camionnette', 'cm1', 'cm2'],
      },
    ],
  };
}

export const CAS = [cas1, cas2, cas3, cas4, cas5, cas6];

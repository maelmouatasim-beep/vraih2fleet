/**
 * Stress test et sensibilité (docs/tco-methodologie.md §7).
 *
 * Chaque variation RELANCE LE MOTEUR COMPLET sur le plan réel — aucune
 * « part de coût » précalculée, aucun coefficient d'impact. Les plages
 * viennent du registre d'hypothèses (jamais un ±20 % arbitraire) ; le
 * niveau de risque est CALCULÉ (l'alternative reste-t-elle gagnante au
 * scénario Prudent ?).
 */

import { HYPOTHESES } from './assumptions';
import { calculerPlan } from './engine';
import type { PlanTco, PlanTcoEntree } from './types';
import { zPlanTco } from './types';

export type SensParametre = 'hausse_favorable' | 'hausse_defavorable';

export interface ParametreSensibilite {
  id: string;
  libelle: string;
  /** Effet d'une HAUSSE du paramètre sur le dossier d'électrification. */
  sens: SensParametre;
  basse: number;
  centrale: number;
  haute: number;
  appliquer: (plan: PlanTco, valeur: number) => PlanTcoEntree;
}

function cloner(plan: PlanTco): PlanTco {
  return structuredClone(plan);
}

/** Paramètres standards du stress test, bornés par les plages sourcées du
 *  registre d'hypothèses ; les paramètres d'échelle (prix d'achat, infra)
 *  utilisent des ratios prudents documentés. */
export function parametresStandards(plan: PlanTco): ParametreSensibilite[] {
  const p = plan.parametres;
  const params: ParametreSensibilite[] = [
    {
      id: 'prix_diesel',
      libelle: 'Prix du diesel ($/L)',
      sens: 'hausse_favorable',
      basse: HYPOTHESES.prix_diesel.plage.basse,
      centrale: p.prixAnnee0.dieselParL,
      haute: HYPOTHESES.prix_diesel.plage.haute,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        c.parametres.prixAnnee0.dieselParL = v;
        return c;
      },
    },
    {
      id: 'prix_electricite',
      libelle: 'Coût effectif de l’électricité ($/kWh)',
      sens: 'hausse_defavorable',
      basse: HYPOTHESES.cout_effectif_elec_depot.plage.basse,
      centrale: p.prixAnnee0.electriciteEffectiveParKwh,
      haute: HYPOTHESES.cout_effectif_elec_depot.plage.haute,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        c.parametres.prixAnnee0.electriciteEffectiveParKwh = v;
        return c;
      },
    },
    {
      id: 'prix_achat_alternative',
      libelle: 'Prix d’achat des véhicules zéro émission (facteur)',
      sens: 'hausse_defavorable',
      basse: 0.85,
      centrale: 1,
      haute: 1.2,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        for (const veh of c.vehicules) veh.alternative.prixAvantTaxes *= v;
        return c;
      },
    },
    {
      id: 'capex_infrastructure',
      libelle: 'Coût d’infrastructure et de raccordement (facteur)',
      sens: 'hausse_defavorable',
      basse: 0.7,
      centrale: 1,
      haute: 1.6,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        for (const s of c.sitesInfra) s.capexAvantTaxes *= v;
        return c;
      },
    },
    {
      id: 'subventions',
      libelle: 'Subventions obtenues (part des montants prévus)',
      sens: 'hausse_favorable',
      basse: 0,
      centrale: 1,
      haute: 1,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        for (const veh of c.vehicules) {
          for (const s of veh.subventionsAlternative) s.montant *= v;
        }
        for (const s of c.sitesInfra) {
          for (const sub of s.subventions) sub.montant *= v;
        }
        return c;
      },
    },
    {
      // Trajectoire du prix du diesel (revue A1b) : l'inflation propre au
      // diesel est aussi incertaine que son niveau — plage du registre.
      id: 'inflation_diesel',
      libelle: 'Inflation annuelle du prix du diesel',
      sens: 'hausse_favorable',
      basse: HYPOTHESES.inflation_diesel.plage.basse,
      centrale: p.inflations.diesel,
      haute: HYPOTHESES.inflation_diesel.plage.haute,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        c.parametres.inflations.diesel = v;
        return c;
      },
    },
    {
      // Économie d'entretien VE : l'hypothèse la moins mûre du registre
      // (statut estimation) — plage relative des défauts de catégorie
      // (ex. camionnette BEV 0,05-0,10 $/km pour 0,07).
      id: 'entretien_alternative',
      libelle: 'Coût d’entretien des véhicules zéro émission (facteur)',
      sens: 'hausse_defavorable',
      basse: 0.7,
      centrale: 1,
      haute: 1.4,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        for (const veh of c.vehicules) {
          if (veh.alternative.technologie !== 'diesel') veh.alternative.entretienParKm *= v;
        }
        return c;
      },
    },
    {
      // Consommation réelle des VE : plage relative des défauts du
      // registre (ex. autobus BEV 120-170 kWh/100 km pour 140).
      id: 'consommation_alternative',
      libelle: 'Consommation des véhicules zéro émission (facteur)',
      sens: 'hausse_defavorable',
      basse: 0.85,
      centrale: 1,
      haute: 1.2,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        for (const veh of c.vehicules) {
          if (veh.alternative.technologie !== 'diesel') veh.alternative.consommationPar100km *= v;
        }
        return c;
      },
    },
    {
      // Valeur résiduelle des VE : facteur sur la dépréciation annuelle
      // des technologies alternatives, borné par la plage relative du
      // registre (depreciation_bev 0,13-0,25 pour 0,18).
      id: 'valeur_residuelle_alternative',
      libelle: 'Dépréciation des véhicules zéro émission (facteur)',
      sens: 'hausse_defavorable',
      basse: HYPOTHESES.depreciation_bev.plage.basse / HYPOTHESES.depreciation_bev.valeur,
      centrale: 1,
      haute: HYPOTHESES.depreciation_bev.plage.haute / HYPOTHESES.depreciation_bev.valeur,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        c.parametres.depreciationAnnuelle.BEV = Math.min(0.99, c.parametres.depreciationAnnuelle.BEV * v);
        c.parametres.depreciationAnnuelle.FCEV = Math.min(0.99, c.parametres.depreciationAnnuelle.FCEV * v);
        return c;
      },
    },
    {
      // Majoration hivernale annualisée : plages du registre (majoration
      // 10-40 % × part des km d'hiver 25-42 %).
      id: 'majoration_hivernale',
      libelle: 'Majoration hivernale annualisée (BEV/FCEV)',
      sens: 'hausse_defavorable',
      basse: HYPOTHESES.majoration_hivernale_bev.plage.basse * HYPOTHESES.part_km_hiver.plage.basse,
      centrale: p.majorationHivernaleAnnualisee,
      haute: HYPOTHESES.majoration_hivernale_bev.plage.haute * HYPOTHESES.part_km_hiver.plage.haute,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        c.parametres.majorationHivernaleAnnualisee = v;
        return c;
      },
    },
    {
      id: 'taux_actualisation',
      libelle: 'Taux d’actualisation nominal',
      sens: 'hausse_defavorable',
      basse: HYPOTHESES.taux_actualisation_nominal.plage.basse,
      centrale: p.tauxActualisationNominal,
      haute: HYPOTHESES.taux_actualisation_nominal.plage.haute,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        c.parametres.tauxActualisationNominal = v;
        return c;
      },
    },
  ];

  if (plan.vehicules.some((v) => v.alternative.technologie === 'FCEV')) {
    params.splice(2, 0, {
      id: 'prix_h2',
      libelle: 'Prix de l’hydrogène livré ($/kg)',
      sens: 'hausse_defavorable',
      basse: HYPOTHESES.prix_h2_livre.plage.basse,
      centrale: p.prixAnnee0.h2LivreParKg,
      haute: HYPOTHESES.prix_h2_livre.plage.haute,
      appliquer: (pl, v) => {
        const c = cloner(pl);
        c.parametres.prixAnnee0.h2LivreParKg = v;
        return c;
      },
    });
  }
  return params;
}

export interface BarreTornade {
  id: string;
  libelle: string;
  /** Valeurs du paramètre testées (bornes sourcées) et valeur centrale du plan. */
  basse: number;
  centrale: number;
  haute: number;
  /** Effet d'une hausse du paramètre sur le dossier d'électrification. */
  sens: SensParametre;
  vanBasse: number;
  vanHaute: number;
  amplitude: number;
}

export type NiveauRisque = 'faible' | 'moyen' | 'eleve';

export interface ResultatSensibilite {
  vanCentrale: number;
  tornade: BarreTornade[];
  scenarios: {
    prudent: { van: number; tcoAlt: number; tcoRef: number };
    central: { van: number; tcoAlt: number; tcoRef: number };
    favorable: { van: number; tcoAlt: number; tcoRef: number };
  };
  niveauRisque: NiveauRisque;
  parametresInfluents: string[];
}

function borneDefavorable(param: ParametreSensibilite): number {
  return param.sens === 'hausse_favorable' ? param.basse : param.haute;
}
function borneFavorable(param: ParametreSensibilite): number {
  return param.sens === 'hausse_favorable' ? param.haute : param.basse;
}

export function analyserSensibilite(entree: PlanTcoEntree): ResultatSensibilite {
  const plan = zPlanTco.parse(entree);
  const central = calculerPlan(plan);
  const params = parametresStandards(plan);

  const tornade: BarreTornade[] = params.map((param) => {
    const vanBasse = calculerPlan(param.appliquer(plan, param.basse)).vanDifferentielle;
    const vanHaute = calculerPlan(param.appliquer(plan, param.haute)).vanDifferentielle;
    return {
      id: param.id,
      libelle: param.libelle,
      basse: param.basse,
      centrale: param.centrale,
      haute: param.haute,
      sens: param.sens,
      vanBasse,
      vanHaute,
      amplitude: Math.abs(vanHaute - vanBasse),
    };
  });
  tornade.sort((a, b) => b.amplitude - a.amplitude);

  const appliquerTous = (choix: (p: ParametreSensibilite) => number): PlanTcoEntree => {
    let courant: PlanTcoEntree = plan;
    for (const param of params) {
      courant = param.appliquer(zPlanTco.parse(courant), choix(param));
    }
    return courant;
  };

  const prudent = calculerPlan(appliquerTous(borneDefavorable));
  const favorable = calculerPlan(appliquerTous(borneFavorable));

  const niveauRisque: NiveauRisque =
    prudent.vanDifferentielle >= 0 ? 'faible' : central.vanDifferentielle >= 0 ? 'moyen' : 'eleve';

  return {
    vanCentrale: central.vanDifferentielle,
    tornade,
    scenarios: {
      prudent: {
        van: prudent.vanDifferentielle,
        tcoAlt: prudent.alternative.tcoActualise,
        tcoRef: prudent.reference.tcoActualise,
      },
      central: {
        van: central.vanDifferentielle,
        tcoAlt: central.alternative.tcoActualise,
        tcoRef: central.reference.tcoActualise,
      },
      favorable: {
        van: favorable.vanDifferentielle,
        tcoAlt: favorable.alternative.tcoActualise,
        tcoRef: favorable.reference.tcoActualise,
      },
    },
    niveauRisque,
    parametresInfluents: tornade.slice(0, 3).map((t) => t.id),
  };
}

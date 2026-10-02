/**
 * Assemblage des paramètres de projet par défaut à partir du registre
 * d'hypothèses (docs/tco-methodologie.md). AUCUNE valeur nouvelle ici :
 * chaque champ provient d'une hypothèse du registre (traçable, avec son
 * statut) ou d'une entrée du projet (année, horizon, taux). L'égalité
 * avec les paramètres des 6 cas de référence est testée.
 */
import { HYPOTHESES } from './assumptions';
import type { TypeOrganisme } from './subsidy-programs';
import type { ParametresProjet } from './types';

export interface OptionsParametres {
  anneeReference: number;
  horizonAns: number;
  /** Taux NOMINAL, en décimal (0.05 = 5 %). */
  tauxActualisationNominal: number;
  typeOrganisme: TypeOrganisme;
  /** Couche « données client » (§3.3 v2.2) : les valeurs fournies par le
   *  client PRIMENT sur les défauts du registre. Tous les montants
   *  s'entendent AVANT TPS/TVQ. `devisRaccordement` remplace l'hypothèse
   *  raccordement_depot dans le dimensionnement d'infrastructure. */
  surchargesEnergie?: {
    dieselParL?: number;
    electriciteEffectiveParKwh?: number;
    h2LivreParKg?: number;
    devisRaccordement?: number;
  };
}

/**
 * Part des taxes de vente NON récupérable selon le type d'organisme.
 * Entreprises : CTI/RTI complets → 0 (note de taux_recup_tvq_municipalite).
 * Sociétés de transport : traitées comme organismes désignés au même
 * titre que les municipalités — à confirmer (même note du registre).
 */
export function tauxTaxesNonRecuperables(typeOrganisme: TypeOrganisme): number {
  if (typeOrganisme === 'entreprise') return 0;
  return (
    HYPOTHESES.taux_tps.valeur * (1 - HYPOTHESES.taux_recup_tps_municipalite.valeur) +
    HYPOTHESES.taux_tvq.valeur * (1 - HYPOTHESES.taux_recup_tvq_municipalite.valeur)
  );
}

export function parametresParDefaut(options: OptionsParametres): ParametresProjet {
  return {
    anneeReference: options.anneeReference,
    horizonAns: options.horizonAns,
    tauxActualisationNominal: options.tauxActualisationNominal,
    inflations: {
      diesel: HYPOTHESES.inflation_diesel.valeur,
      electricite: HYPOTHESES.inflation_electricite.valeur,
      hydrogene: HYPOTHESES.inflation_h2.valeur,
      entretien: HYPOTHESES.inflation_entretien.valeur,
      generale: HYPOTHESES.inflation_generale.valeur,
    },
    prixAnnee0: {
      dieselParL: options.surchargesEnergie?.dieselParL ?? HYPOTHESES.prix_diesel.valeur,
      essenceParL: HYPOTHESES.prix_essence.valeur,
      electriciteEffectiveParKwh:
        options.surchargesEnergie?.electriciteEffectiveParKwh ??
        HYPOTHESES.cout_effectif_elec_depot.valeur,
      h2LivreParKg: options.surchargesEnergie?.h2LivreParKg ?? HYPOTHESES.prix_h2_livre.valeur,
    },
    rendementRecharge: HYPOTHESES.rendement_recharge.valeur,
    majorationHivernaleAnnualisee:
      HYPOTHESES.majoration_hivernale_bev.valeur * HYPOTHESES.part_km_hiver.valeur,
    tauxTaxesNonRecuperables: tauxTaxesNonRecuperables(options.typeOrganisme),
    depreciationAnnuelle: {
      diesel: HYPOTHESES.depreciation_diesel.valeur,
      BEV: HYPOTHESES.depreciation_bev.valeur,
      FCEV: HYPOTHESES.depreciation_fcev.valeur,
    },
    plancherResiduel: HYPOTHESES.plancher_residuel.valeur,
    infra: {
      entretienAnnuelPctCapex: HYPOTHESES.entretien_infra_ratio.valeur,
      dureeVieAns: HYPOTHESES.duree_vie_infra.valeur,
    },
    facteursEmission: {
      dieselTtwLegersKgParL: HYPOTHESES.fe_diesel_ttw_legers.valeur,
      dieselTtwLourdsKgParL: HYPOTHESES.fe_diesel_ttw_lourds.valeur,
      ratioWtwDiesel: 1 + HYPOTHESES.fe_diesel_amont.valeur,
      essenceTtwKgParL: HYPOTHESES.fe_essence_ttw_legers.valeur,
      // Même majoration amont que le diesel (carburants pétroliers raffinés) :
      // aucune source distincte lue pour l'essence — hypothèse à valider.
      ratioWtwEssence: 1 + HYPOTHESES.fe_diesel_amont.valeur,
      electriciteGParKwh: HYPOTHESES.fe_reseau_qc.valeur,
      h2KgParKg: HYPOTHESES.fe_h2_electrolyse_qc.valeur,
    },
  };
}

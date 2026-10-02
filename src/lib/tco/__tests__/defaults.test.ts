import { describe, expect, it } from 'vitest';
import { HYPOTHESES } from '../assumptions';
import { parametresParDefaut, tauxTaxesNonRecuperables } from '../defaults';
import { zParametresProjet } from '../types';
import { PARAMETRES_CAS } from './cas-de-reference';

describe('parametresParDefaut', () => {
  it('reproduit exactement les paramètres des 6 cas de référence (municipalité QC, 2026, 10 ans, 5 %)', () => {
    const p = parametresParDefaut({
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
      typeOrganisme: 'municipalite',
    });
    // Les cas de référence sont tous diesel : les paramètres essence (1.8)
    // s'ajoutent sans rien changer au reste.
    const { essenceParL, ...prix } = p.prixAnnee0;
    const { essenceTtwKgParL, ratioWtwEssence, ...fe } = p.facteursEmission;
    expect({ ...p, prixAnnee0: prix, facteursEmission: fe }).toEqual(PARAMETRES_CAS);
    expect(essenceParL).toBe(HYPOTHESES.prix_essence.valeur);
    expect(essenceTtwKgParL).toBe(HYPOTHESES.fe_essence_ttw_legers.valeur);
    expect(ratioWtwEssence).toBe(p.facteursEmission.ratioWtwDiesel);
  });

  it('produit une entrée valide pour le moteur (zod)', () => {
    const p = parametresParDefaut({
      anneeReference: 2030,
      horizonAns: 15,
      tauxActualisationNominal: 0.06,
      typeOrganisme: 'entreprise',
    });
    expect(() => zParametresProjet.parse(p)).not.toThrow();
    expect(p.horizonAns).toBe(15);
    expect(p.tauxTaxesNonRecuperables).toBe(0);
  });
});

describe('surcharges « donnée client » (couche 3, §3.3 v2.2)', () => {
  it('les valeurs client priment sur les défauts du registre, champ par champ', () => {
    const p = parametresParDefaut({
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
      typeOrganisme: 'municipalite',
      surchargesEnergie: { dieselParL: 1.62, electriciteEffectiveParKwh: 0.084 },
    });
    expect(p.prixAnnee0.dieselParL).toBe(1.62);
    expect(p.prixAnnee0.electriciteEffectiveParKwh).toBe(0.084);
    // champ non fourni : défaut du registre inchangé
    expect(p.prixAnnee0.h2LivreParKg).toBe(HYPOTHESES.prix_h2_livre.valeur);
  });
});

describe('tauxTaxesNonRecuperables', () => {
  it('municipalité : TPS remboursée à 100 %, TVQ à 50 % (hypothèses du registre)', () => {
    const attendu =
      HYPOTHESES.taux_tps.valeur * (1 - HYPOTHESES.taux_recup_tps_municipalite.valeur) +
      HYPOTHESES.taux_tvq.valeur * (1 - HYPOTHESES.taux_recup_tvq_municipalite.valeur);
    expect(tauxTaxesNonRecuperables('municipalite')).toBe(attendu);
    expect(attendu).toBeCloseTo(0.049875, 10);
  });

  it('entreprise : CTI/RTI complets → 0', () => {
    expect(tauxTaxesNonRecuperables('entreprise')).toBe(0);
  });

  it('société de transport : traitée comme organisme désigné (même taux que municipal)', () => {
    expect(tauxTaxesNonRecuperables('societe_transport')).toBe(
      tauxTaxesNonRecuperables('municipalite'),
    );
  });
});

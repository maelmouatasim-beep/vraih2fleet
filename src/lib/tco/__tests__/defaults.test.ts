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
    expect(p).toEqual(PARAMETRES_CAS);
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

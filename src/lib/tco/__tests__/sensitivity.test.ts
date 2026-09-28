/**
 * Sensibilité : le sens de CHAQUE effet est testé (docs/tco-methodologie.md
 * §7.3), le niveau de risque est calculé, la tornade relance le vrai moteur.
 */
import { describe, expect, it } from 'vitest';
import { calculerPlan } from '../engine';
import { analyserSensibilite, parametresStandards } from '../sensitivity';
import { zPlanTco } from '../types';
import { cas1, cas4, cas5 } from './cas-de-reference';

function vanAvec(plan: ReturnType<typeof cas1>, paramId: string, valeur: number): number {
  const parse = zPlanTco.parse(plan);
  const param = parametresStandards(parse).find((p) => p.id === paramId);
  if (!param) throw new Error(`paramètre absent : ${paramId}`);
  return calculerPlan(param.appliquer(parse, valeur)).vanDifferentielle;
}

describe('sens des effets (un test par paramètre)', () => {
  it('diesel plus cher ⇒ FAVORABLE à l’électrification (VAN ↑)', () => {
    expect(vanAvec(cas1(), 'prix_diesel', 3.4)).toBeGreaterThan(vanAvec(cas1(), 'prix_diesel', 1.8));
  });

  it('électricité plus chère ⇒ défavorable (VAN ↓)', () => {
    expect(vanAvec(cas1(), 'prix_electricite', 0.16)).toBeLessThan(vanAvec(cas1(), 'prix_electricite', 0.075));
  });

  it('hydrogène plus cher ⇒ défavorable (VAN ↓)', () => {
    expect(vanAvec(cas5(), 'prix_h2', 20)).toBeLessThan(vanAvec(cas5(), 'prix_h2', 12));
  });

  it('moins de subventions ⇒ défavorable (VAN ↓), jamais sous le coût net', () => {
    expect(vanAvec(cas4(), 'subventions', 0)).toBeLessThan(vanAvec(cas4(), 'subventions', 1));
  });

  it('véhicules ZE plus chers ⇒ défavorable (VAN ↓)', () => {
    expect(vanAvec(cas1(), 'prix_achat_alternative', 1.2)).toBeLessThan(
      vanAvec(cas1(), 'prix_achat_alternative', 0.85),
    );
  });

  it('raccordement/infrastructure plus chers ⇒ défavorable (VAN ↓)', () => {
    expect(vanAvec(cas1(), 'capex_infrastructure', 1.6)).toBeLessThan(
      vanAvec(cas1(), 'capex_infrastructure', 0.7),
    );
  });

  it('taux d’actualisation plus élevé ⇒ défavorable quand les économies sont futures (VAN ↓)', () => {
    expect(vanAvec(cas1(), 'taux_actualisation', 0.07)).toBeLessThan(vanAvec(cas1(), 'taux_actualisation', 0.03));
  });
});

describe('analyse complète', () => {
  it('fourchette cohérente : prudent ≤ central ≤ favorable, niveau de risque CALCULÉ', () => {
    const r = analyserSensibilite(cas1());
    expect(r.scenarios.prudent.van).toBeLessThanOrEqual(r.scenarios.central.van);
    expect(r.scenarios.central.van).toBeLessThanOrEqual(r.scenarios.favorable.van);
    expect(['faible', 'moyen', 'eleve']).toContain(r.niveauRisque);
    if (r.scenarios.prudent.van >= 0) expect(r.niveauRisque).toBe('faible');
    else if (r.scenarios.central.van >= 0) expect(r.niveauRisque).toBe('moyen');
    else expect(r.niveauRisque).toBe('eleve');
  });

  it('la tornade est triée par amplitude et nomme les 3 paramètres les plus influents', () => {
    const r = analyserSensibilite(cas1());
    for (let i = 1; i < r.tornade.length; i++) {
      expect(r.tornade[i - 1].amplitude).toBeGreaterThanOrEqual(r.tornade[i].amplitude);
    }
    expect(r.parametresInfluents).toHaveLength(3);
    expect(r.parametresInfluents).toEqual(r.tornade.slice(0, 3).map((t) => t.id));
  });

  it('le paramètre H2 n’apparaît que si le plan contient un FCEV', () => {
    const sans = analyserSensibilite(cas1());
    const avec = analyserSensibilite(cas5());
    expect(sans.tornade.some((t) => t.id === 'prix_h2')).toBe(false);
    expect(avec.tornade.some((t) => t.id === 'prix_h2')).toBe(true);
  });

  it('cas 5 (FCEV sans subvention suffisante) : perdant même au favorable ⇒ risque élevé', () => {
    const r = analyserSensibilite(cas5());
    expect(r.scenarios.central.van).toBeLessThan(0);
    expect(r.niveauRisque).toBe('eleve');
  });
});

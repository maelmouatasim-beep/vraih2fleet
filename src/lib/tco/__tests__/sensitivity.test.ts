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

describe('véhicules remplacés en diesel : jamais touchés par les facteurs « zéro émission » (audit A6, engineVersion 2.5.1)', () => {
  /** Remplacement à l'identique : l'alternative est un diesel neuf, sans subvention ni borne. */
  function enDiesel(plan: ReturnType<typeof cas1>, id: string) {
    const v = plan.vehicules.find((x) => x.id === id)!;
    v.alternative = { ...v.reference };
    v.subventionsAlternative = [];
    plan.sitesInfra = (plan.sitesInfra ?? []).map((s) => ({ ...s, vehiculeIds: s.vehiculeIds.filter((x) => x !== id) }))
      .filter((s) => s.vehiculeIds.length > 0);
    return plan;
  }

  it('plan sans aucun véhicule zéro émission : écart nul dans les 3 scénarios et sur chaque barre', () => {
    const vide = enDiesel(cas1(), 'camionnette');
    const a = analyserSensibilite(vide);
    expect(a.vanCentrale).toBeCloseTo(0, 6);
    for (const s of ['prudent', 'central', 'favorable'] as const) expect(a.scenarios[s].van).toBeCloseTo(0, 6);
    for (const b of a.tornade) {
      expect(b.vanBasse).toBeCloseTo(0, 6);
      expect(b.vanHaute).toBeCloseTo(0, 6);
    }
  });

  it('ajouter un véhicule remplacé en diesel ne change NI la VAN NI la barre « prix d’achat des véhicules zéro émission »', () => {
    const seul = cas1();
    const mixte = cas1();
    const diesel = structuredClone(mixte.vehicules[0]);
    diesel.id = 'camionnette-diesel';
    mixte.vehicules.push(diesel);
    enDiesel(mixte, 'camionnette-diesel');
    const a = analyserSensibilite(seul);
    const b = analyserSensibilite(mixte);
    expect(b.vanCentrale).toBeCloseTo(a.vanCentrale, 4);
    const barre = (r: typeof a) => r.tornade.find((x) => x.id === 'prix_achat_alternative')!;
    expect(barre(b).vanBasse).toBeCloseTo(barre(a).vanBasse, 4);
    expect(barre(b).vanHaute).toBeCloseTo(barre(a).vanHaute, 4);
    for (const s of ['prudent', 'favorable'] as const) expect(b.scenarios[s].van).toBeCloseTo(a.scenarios[s].van, 4);
  });
});

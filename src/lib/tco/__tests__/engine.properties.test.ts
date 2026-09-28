/**
 * Propriétés invariantes du moteur (fast-check) — docs/tco-methodologie.md.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calculerPlan } from '../engine';
import type { PlanTcoEntree } from '../types';
import { PARAMETRES_CAS } from './cas-de-reference';

const NB_ESSAIS = 60;

function planSimple(opts: {
  km?: number;
  prixAlt?: number;
  subvention?: number;
  anneeSubvention?: number;
  horizon?: number;
  taux?: number;
  infraCapex?: number;
  dureeVie?: number;
  nCopies?: number;
}): PlanTcoEntree {
  const n = opts.nCopies ?? 1;
  return {
    parametres: {
      ...PARAMETRES_CAS,
      horizonAns: opts.horizon ?? 10,
      tauxActualisationNominal: opts.taux ?? PARAMETRES_CAS.tauxActualisationNominal,
    },
    vehicules: Array.from({ length: n }, (_, i) => ({
      id: `v${i}`,
      kmParAn: opts.km ?? 30000,
      classeEmissionDiesel: 'legers' as const,
      reference: { technologie: 'diesel' as const, prixAvantTaxes: 68000, consommationPar100km: 15, entretienParKm: 0.14 },
      alternative: {
        technologie: 'BEV' as const,
        prixAvantTaxes: opts.prixAlt ?? 95000,
        consommationPar100km: 32,
        entretienParKm: 0.1,
      },
      subventionsAlternative:
        opts.subvention !== undefined
          ? [{ libelle: 'test', montant: opts.subvention, annee: opts.anneeSubvention ?? 1 }]
          : [],
      dureeVieAns: opts.dureeVie ?? 30,
    })),
    sitesInfra:
      opts.infraCapex !== undefined
        ? [{ id: 's', capexAvantTaxes: opts.infraCapex, vehiculeIds: Array.from({ length: n }, (_, i) => `v${i}`) }]
        : [],
  };
}

describe('propriétés du moteur', () => {
  it('km ↑ ⇒ coût d’énergie actualisé ↑ (les deux scénarios)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5000, max: 100000 }),
        fc.integer({ min: 1000, max: 50000 }),
        (km, delta) => {
          const r1 = calculerPlan(planSimple({ km }));
          const r2 = calculerPlan(planSimple({ km: km + delta }));
          const energiePv = (r: ReturnType<typeof calculerPlan>, s: 'alternative' | 'reference') =>
            r[s].flux.energie.reduce(
              (a, e, n) => a + e / Math.pow(1 + PARAMETRES_CAS.tauxActualisationNominal, n),
              0,
            );
          expect(energiePv(r2, 'alternative')).toBeGreaterThan(energiePv(r1, 'alternative'));
          expect(energiePv(r2, 'reference')).toBeGreaterThan(energiePv(r1, 'reference'));
        },
      ),
      { numRuns: NB_ESSAIS },
    );
  });

  it('subvention ↑ ⇒ TCO alternative ↓, et le TCO reste ≥ TCO avec subvention = coût complet', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 90000 }),
        fc.integer({ min: 1, max: 5000 }),
        (s, delta) => {
          const r1 = calculerPlan(planSimple({ subvention: s }));
          const r2 = calculerPlan(planSimple({ subvention: s + delta }));
          expect(r2.alternative.tcoActualise).toBeLessThan(r1.alternative.tcoActualise);
          // borne : subvention égale au prix d'achat complet
          const plancher = calculerPlan(planSimple({ subvention: 95000, anneeSubvention: 0 }));
          expect(r2.alternative.tcoActualise).toBeGreaterThanOrEqual(
            plancher.alternative.tcoActualise - 1e-6,
          );
        },
      ),
      { numRuns: NB_ESSAIS },
    );
  });

  it('taux d’actualisation 0 ⇒ TCO actualisé = somme nominale simple', () => {
    const r = calculerPlan(planSimple({ taux: 0, infraCapex: 15000, subvention: 2500 }));
    const sommeNominale = r.alternative.flux.net.reduce((a, b) => a + b, 0);
    expect(Math.abs(r.alternative.tcoActualise - sommeNominale)).toBeLessThan(1e-6);
  });

  it('équivalence de Fisher : flux déflatés actualisés au taux réel = même TCO', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 0.12, noNaN: true }),
        fc.double({ min: 0, max: 0.06, noNaN: true }),
        (r, pi) => {
          const plan = planSimple({ taux: r, infraCapex: 20000, subvention: 5000 });
          const resultat = calculerPlan(plan);
          const tauxReel = (1 + r) / (1 + pi) - 1;
          let tcoReel = 0;
          resultat.alternative.flux.net.forEach((flux, n) => {
            const fluxReel = flux / Math.pow(1 + pi, n);
            tcoReel += fluxReel / Math.pow(1 + tauxReel, n);
          });
          expect(Math.abs(tcoReel - resultat.alternative.tcoActualise)).toBeLessThan(1e-6);
        },
      ),
      { numRuns: NB_ESSAIS },
    );
  });

  it('référence comparée à elle-même : VAN = 0, CO2 évité = 0, écart budgétaire nul', () => {
    const plan = planSimple({});
    // alternative identique à la référence
    const p = plan as { vehicules: Array<{ alternative: unknown; reference: unknown; subventionsAlternative: unknown[] }> };
    p.vehicules[0].alternative = { ...(p.vehicules[0].reference as object) };
    p.vehicules[0].subventionsAlternative = [];
    const r = calculerPlan(plan);
    expect(Math.abs(r.vanDifferentielle)).toBeLessThan(1e-9);
    expect(Math.abs(r.co2EviteTtwTonnes)).toBeLessThan(1e-12);
    expect(Math.abs(r.co2EviteWtwTonnes)).toBeLessThan(1e-12);
    for (const ligne of r.vueBudgetaire) expect(Math.abs(ligne.ecart)).toBeLessThan(1e-9);
  });

  it('N véhicules identiques = N × 1 véhicule (sans infra partagée)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 12 }), (n) => {
        const un = calculerPlan(planSimple({ subvention: 2500 }));
        const plusieurs = calculerPlan(planSimple({ subvention: 2500, nCopies: n }));
        expect(Math.abs(plusieurs.alternative.tcoActualise - n * un.alternative.tcoActualise)).toBeLessThan(1e-6 * n);
        expect(Math.abs(plusieurs.vanDifferentielle - n * un.vanDifferentielle)).toBeLessThan(1e-6 * n);
        expect(Math.abs(plusieurs.co2EviteWtwTonnes - n * un.co2EviteWtwTonnes)).toBeLessThan(1e-9 * n);
      }),
      { numRuns: 20 },
    );
  });

  it('la somme des parts d’infrastructure égale toujours le capex du site', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 10000, max: 500000 }),
        (n, capex) => {
          const r = calculerPlan(planSimple({ nCopies: n, infraCapex: capex }));
          const somme = r.partsInfra.reduce((a, p) => a + p.part, 0);
          expect(Math.abs(somme - capex)).toBeLessThan(1e-6);
        },
      ),
      { numRuns: NB_ESSAIS },
    );
  });

  it('valeur résiduelle ≤ prix payé, pour tout horizon et toute durée de vie', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 25 }),
        fc.integer({ min: 1, max: 30 }),
        (horizon, dureeVie) => {
          const r = calculerPlan(planSimple({ horizon, dureeVie }));
          for (const scenario of [r.alternative, r.reference]) {
            for (let n = 0; n <= horizon; n++) {
              // à toute année, les résiduels crédités ne dépassent pas les
              // investissements cumulés (les prix payés)
              const investCumul = scenario.flux.investissement.slice(0, n + 1).reduce((a, b) => a + b, 0);
              const residuelCumul = scenario.flux.residuels.slice(0, n + 1).reduce((a, b) => a + b, 0);
              expect(residuelCumul).toBeLessThanOrEqual(investCumul + 1e-6);
            }
          }
        },
      ),
      { numRuns: NB_ESSAIS },
    );
  });

  it('entrées invalides rejetées : NaN, Infinity, montants négatifs', () => {
    expect(() => calculerPlan(planSimple({ km: Number.NaN }))).toThrow();
    expect(() => calculerPlan(planSimple({ prixAlt: Number.POSITIVE_INFINITY }))).toThrow();
    expect(() => calculerPlan(planSimple({ prixAlt: -5 }))).toThrow();
    expect(() => calculerPlan(planSimple({ subvention: -1 }))).toThrow();
  });

  it('identifiants de véhicules en double rejetés', () => {
    const plan = planSimple({ nCopies: 2 });
    (plan.vehicules as Array<{ id: string }>)[1].id = 'v0';
    expect(() => calculerPlan(plan)).toThrow(/double/);
  });
});

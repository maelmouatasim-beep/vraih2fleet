/**
 * §10.11 — année d'acquisition par véhicule (engineVersion 1.1.0).
 * Attendus recalculés à la main depuis les formules de la méthodologie
 * (jamais depuis le moteur lui-même).
 */
import { describe, expect, it } from 'vitest';
import { calculerPlan } from '../engine';
import type { PlanTcoEntree } from '../types';
import { PARAMETRES_CAS, cas1 } from './cas-de-reference';

const P = PARAMETRES_CAS;

function planAcquisition(annee: number): PlanTcoEntree {
  return {
    parametres: P,
    vehicules: [
      {
        id: 'v',
        kmParAn: 30000,
        classeEmissionDiesel: 'legers',
        reference: { technologie: 'diesel', prixAvantTaxes: 68000, consommationPar100km: 15, entretienParKm: 0.14 },
        alternative: { technologie: 'BEV', prixAvantTaxes: 95000, consommationPar100km: 32, entretienParKm: 0.1 },
        dureeVieAns: 30,
        anneeAcquisition: annee,
      },
    ],
    sitesInfra: [],
  };
}

describe('anneeAcquisition (§10.11)', () => {
  it('défaut 0 : résultat strictement identique au cas de référence 1', () => {
    const sans = calculerPlan(cas1());
    const avec = calculerPlan({
      ...cas1(),
      vehicules: cas1().vehicules.map((v) => ({ ...v, anneeAcquisition: 0 })),
    });
    expect(avec.alternative.tcoActualise).toBe(sans.alternative.tcoActualise);
    expect(avec.reference.tcoActualise).toBe(sans.reference.tcoActualise);
    expect(avec.empreinteEntree).toBe(sans.empreinteEntree);
  });

  it('acquisition en année k : investissement indexé en k, aucun flux avant k', () => {
    const k = 3;
    const r = calculerPlan(planAcquisition(k));
    const taxes = 1 + P.tauxTaxesNonRecuperables;
    const prixIndexe = 95000 * Math.pow(1 + P.inflations.generale, k);
    expect(r.alternative.flux.investissement[k]).toBeCloseTo(prixIndexe * taxes, 6);
    for (let n = 0; n < k; n++) {
      expect(r.alternative.flux.investissement[n]).toBe(0);
      expect(r.alternative.flux.energie[n]).toBe(0);
      expect(r.alternative.flux.entretien[n]).toBe(0);
      expect(r.reference.flux.net[n]).toBe(0);
    }
    // première année d'exploitation : k+1
    const energieAnnuelle = ((30000 * 32) / 100) * (1 + P.majorationHivernaleAnnualisee) / P.rendementRecharge;
    const attenduEnergie = energieAnnuelle * P.prixAnnee0.electriciteEffectiveParKwh * Math.pow(1 + P.inflations.electricite, k + 1);
    expect(r.alternative.flux.energie[k + 1]).toBeCloseTo(attenduEnergie, 6);
  });

  it('émissions et km actualisés ne comptent que les années k+1..H', () => {
    const k = 4;
    const r0 = calculerPlan(planAcquisition(0));
    const rk = calculerPlan(planAcquisition(k));
    // émissions de la référence proportionnelles aux années d'exploitation
    expect(rk.reference.emissionsTtwTonnes).toBeCloseTo(
      (r0.reference.emissionsTtwTonnes * (P.horizonAns - k)) / P.horizonAns,
      9,
    );
    let kmAttendus = 0;
    for (let n = k + 1; n <= P.horizonAns; n++) {
      kmAttendus += 30000 / Math.pow(1 + P.tauxActualisationNominal, n);
    }
    expect(rk.kmActualises).toBeCloseTo(kmAttendus, 6);
  });

  it('valeur résiduelle en fin d’horizon selon l’âge H−k (géométrique planchée)', () => {
    const k = 6;
    const r = calculerPlan(planAcquisition(k));
    const prixIndexe = 95000 * Math.pow(1 + P.inflations.generale, k);
    const ratio = Math.max(Math.pow(1 - P.depreciationAnnuelle.BEV, P.horizonAns - k), P.plancherResiduel);
    expect(r.alternative.flux.residuels[P.horizonAns]).toBeCloseTo(prixIndexe * ratio, 6);
  });

  it('re-remplacement à partir de k (k, k+durée, …)', () => {
    const plan = planAcquisition(2);
    plan.vehicules[0].dureeVieAns = 5; // achats attendus : années 2 et 7
    const r = calculerPlan(plan);
    const taxes = 1 + P.tauxTaxesNonRecuperables;
    expect(r.alternative.flux.investissement[2]).toBeGreaterThan(0);
    expect(r.alternative.flux.investissement[7]).toBeCloseTo(
      95000 * Math.pow(1 + P.inflations.generale, 7) * taxes,
      6,
    );
    // reprise au plancher du véhicule remplacé, à l'année du re-remplacement
    expect(r.alternative.flux.residuels[7]).toBeCloseTo(
      P.plancherResiduel * 95000 * Math.pow(1 + P.inflations.generale, 2),
      6,
    );
  });

  it('acquisition hors horizon : avertissement et aucun effet', () => {
    const r = calculerPlan(planAcquisition(P.horizonAns));
    expect(r.avertissements.some((a) => a.includes("hors de l'horizon"))).toBe(true);
    expect(r.alternative.tcoActualise).toBe(0);
    expect(r.reference.tcoActualise).toBe(0);
    expect(r.kmActualises).toBe(0);
    expect(r.tcoParKmAlt).toBe(0);
  });
});

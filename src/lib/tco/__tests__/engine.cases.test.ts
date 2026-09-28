/**
 * Les cas de référence, à ±0,01 $. Valeurs attendues :
 * docs/tco-cas-de-reference.json — GÉNÉRÉ par le contre-calculateur
 * INDÉPENDANT (scripts/reference-cases/, vérifié par la CI avec
 * `generate.mjs --check`). Ne jamais modifier le JSON à la main pour
 * faire passer un test.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculerPlan } from '../engine';
import { CAS } from './cas-de-reference';

interface SortiesAttendues {
  tcoActualiseAlt: number;
  tcoActualiseRef: number;
  vanDifferentielle: number;
  tcoParKmAlt: number;
  paybackSimpleAns: number | null;
  paybackSimpleRaison: string | null;
  paybackActualiseAns: number | null;
  paybackActualiseRaison: string | null;
  co2EviteTtwTonnes: number;
  co2EviteWtwTonnes: number;
  coutParTonneWtw: number;
}

const REF = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../docs/tco-cas-de-reference.json'), 'utf-8'),
) as { cas: Array<{ id: number; titre: string; sorties: SortiesAttendues }> };

const CENT = 0.011; // tolérance ±0,01 $ (les attendus sont arrondis au cent)

describe('moteur vs cas de référence indépendants', () => {
  for (const attendu of REF.cas) {
    it(`cas ${attendu.id} — ${attendu.titre}`, () => {
      const resultat = calculerPlan(CAS[attendu.id - 1]());
      const s = attendu.sorties;

      expect(Math.abs(resultat.alternative.tcoActualise - s.tcoActualiseAlt), 'TCO alternative').toBeLessThan(CENT);
      expect(Math.abs(resultat.reference.tcoActualise - s.tcoActualiseRef), 'TCO référence').toBeLessThan(CENT);
      expect(Math.abs(resultat.vanDifferentielle - s.vanDifferentielle), 'VAN différentielle').toBeLessThan(CENT);
      expect(Math.abs(resultat.tcoParKmAlt - s.tcoParKmAlt), 'TCO/km').toBeLessThan(0.00011);

      expect(resultat.paybackSimple.annees, 'payback simple').toBe(s.paybackSimpleAns);
      expect(resultat.paybackSimple.raison).toBe(s.paybackSimpleRaison);
      expect(resultat.paybackActualise.annees, 'payback actualisé').toBe(s.paybackActualiseAns);
      expect(resultat.paybackActualise.raison).toBe(s.paybackActualiseRaison);

      expect(Math.abs(resultat.co2EviteTtwTonnes - s.co2EviteTtwTonnes), 'CO2 TTW').toBeLessThan(0.0011);
      expect(Math.abs(resultat.co2EviteWtwTonnes - s.co2EviteWtwTonnes), 'CO2 WTW').toBeLessThan(0.0011);
      expect(resultat.coutParTonneWtw).not.toBeNull();
      expect(Math.abs((resultat.coutParTonneWtw as number) - s.coutParTonneWtw), '$/t WTW').toBeLessThan(0.011);
    });
  }

  it('cas 6 — la somme des parts d’infrastructure égale le capex du site', () => {
    const resultat = calculerPlan(CAS[5]());
    const somme = resultat.partsInfra.reduce((a, p) => a + p.part, 0);
    expect(Math.abs(somme - 135000)).toBeLessThan(1e-6);
    const parVehicule = Object.fromEntries(resultat.partsInfra.map((p) => [p.vehiculeId, p.part]));
    expect(Math.abs(parVehicule.vl1 - 10714.29)).toBeLessThan(0.011);
    expect(Math.abs(parVehicule.camionnette - 20571.43)).toBeLessThan(0.011);
    expect(Math.abs(parVehicule.cm1 - 46500)).toBeLessThan(0.011);
  });

  it('reproductibilité : même entrée ⇒ même empreinte et mêmes chiffres', () => {
    const a = calculerPlan(CAS[0]());
    const b = calculerPlan(CAS[0]());
    expect(a.empreinteEntree).toBe(b.empreinteEntree);
    expect(a.engineVersion).toBe(b.engineVersion);
    expect(a.alternative.tcoActualise).toBe(b.alternative.tcoActualise);
    const c = calculerPlan(CAS[1]());
    expect(c.empreinteEntree).not.toBe(a.empreinteEntree);
  });
});

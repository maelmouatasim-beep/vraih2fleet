import { describe, expect, it } from 'vitest';
import {
  gVersKg,
  gVersTonnes,
  kgParKWhVersGParKWh,
  kgParMWhVersGParKWh,
  kgVersTonnes,
  kWhVersMWh,
  par100kmVersParKm,
  tauxVersPourcentageAffichage,
} from '../units';

describe('conversions d’unités (fonction unique, testée)', () => {
  it('masses', () => {
    expect(gVersKg(2741)).toBe(2.741);
    expect(kgVersTonnes(2724)).toBe(2.724);
    expect(gVersTonnes(1_200_000)).toBe(1.2);
  });

  it('consommations et énergie', () => {
    expect(par100kmVersParKm(32)).toBe(0.32);
    expect(kWhVersMWh(72000)).toBe(72);
  });

  it('facteur réseau : kg/MWh ≡ g/kWh, et kg/kWh = ×1000 (l’erreur historique)', () => {
    expect(kgParMWhVersGParKWh(120)).toBe(120);
    expect(kgParKWhVersGParKWh(0.0012)).toBeCloseTo(1.2, 12);
    // le bogue corrigé : injecter 0,015 kg/kWh dans un champ kg/MWh
    // sous-estimait d'un facteur 1000
    expect(kgParKWhVersGParKWh(0.015) / kgParMWhVersGParKWh(0.015)).toBe(1000);
  });

  it('taux décimal → pourcentage d’affichage (jamais l’inverse dans le moteur)', () => {
    expect(tauxVersPourcentageAffichage(0.05)).toBe(5);
  });
});

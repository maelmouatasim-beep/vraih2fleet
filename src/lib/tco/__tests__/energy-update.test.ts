/**
 * Couche « collecte » des prix (A1) : moyenne 12 mois StatCan et garde
 * d'anomalie du script scripts/energie/update-energy-data.mjs, plus la
 * cohérence du fichier energy-data.json avec le registre d'hypothèses.
 */
import { describe, expect, it } from 'vitest';
import { appliquerGarde, moyenne12Mois, DIVISEUR_TPS_TVQ } from '../../../../scripts/energie/update-energy-data.mjs';
import { DONNEES_ENERGIE, HYPOTHESES } from '../assumptions';

function serieVille(ville: string, valeurs: (number | null)[], depart = '2025-07'): unknown {
  const [an, mois] = depart.split('-').map(Number);
  return {
    ville,
    reponse: [
      {
        object: {
          vectorDataPoint: valeurs.map((v, i) => {
            const m = mois + i;
            const annee = an + Math.floor((m - 1) / 12);
            const moisCal = ((m - 1) % 12) + 1;
            return { refPer: `${annee}-${String(moisCal).padStart(2, '0')}-01`, value: v };
          }),
        },
      },
    ],
  };
}

describe('moyenne12Mois (StatCan 18-10-0001-01)', () => {
  it('reproduit la moyenne archivée du 2026-09-29 (2,0902 $ TTC → 1,8179 $ avant TPS/TVQ)', () => {
    const quebec = [171.5, 169.5, 169.6, 170.2, 185.7, 178.1, 175.0, 188.8, 237.4, 248.0, 244.0, 219.4, 231.6, 252.3];
    const montreal = [174.5, 171.1, 171.4, 170.7, 186.8, 177.0, 177.1, 192.4, 241.5, 244.5, 240.2, 221.0, 237.1, 256.6];
    const r = moyenne12Mois([
      serieVille('Québec, Québec', [null, null], '2025-05'), // série morte ignorée
      serieVille('Québec, Québec', quebec),
      serieVille('Montréal, Québec', montreal),
    ]);
    expect(r.periode).toBe('2025-09 à 2026-08');
    expect(r.moyenneTtcParL).toBeCloseTo(2.0902, 4);
    expect(r.moyenneAvantTpsTvqParL).toBeCloseTo(2.0902 / DIVISEUR_TPS_TVQ, 3);
    expect(r.minMensuelAvantTpsTvqParL).toBeCloseTo(1.696 / DIVISEUR_TPS_TVQ, 3);
    expect(r.quebec).toHaveLength(12);
    expect(r.montreal).toHaveLength(12);
  });

  it('série incomplète : erreur explicite, jamais de moyenne partielle', () => {
    expect(() =>
      moyenne12Mois([
        serieVille('Québec, Québec', [170, 171, 172]),
        serieVille('Montréal, Québec', [170, 171, 172]),
      ]),
    ).toThrow(/12 requis/);
    expect(() => moyenne12Mois([serieVille('Québec, Québec', new Array(14).fill(170))])).toThrow(/Montréal/);
  });
});

describe("garde d'anomalie (> 20 % = mise en attente, jamais appliquée)", () => {
  it('variation nulle : aucune action', () => {
    expect(appliquerGarde(1.8179, 1.8179).action).toBe('aucune');
  });
  it('variation ≤ 20 % : appliquée', () => {
    expect(appliquerGarde(1.8179, 2.0).action).toBe('appliquer');
    expect(appliquerGarde(2.0, 1.7).action).toBe('appliquer');
  });
  it('variation > 20 % : EN ATTENTE (hausse comme baisse)', () => {
    expect(appliquerGarde(1.8179, 2.3).action).toBe('en_attente');
    expect(appliquerGarde(1.8179, 1.2).action).toBe('en_attente');
  });
});

describe('cohérence energy-data.json ↔ registre', () => {
  it('prix_diesel du registre = moyenne 12 mois du fichier de données, bornes comprises', () => {
    expect(HYPOTHESES.prix_diesel.valeur).toBe(DONNEES_ENERGIE.diesel.moyenne12MoisAvantTpsTvqParL);
    expect(HYPOTHESES.prix_diesel.plage.basse).toBe(DONNEES_ENERGIE.diesel.minMensuelAvantTpsTvqParL);
    expect(HYPOTHESES.prix_diesel.plage.haute).toBe(DONNEES_ENERGIE.diesel.spotCriseAvantTpsTvqParL);
    // conversion TTC → avant TPS/TVQ cohérente
    expect(DONNEES_ENERGIE.diesel.moyenne12MoisAvantTpsTvqParL).toBeCloseTo(
      DONNEES_ENERGIE.diesel.moyenne12MoisTtcParL / DIVISEUR_TPS_TVQ,
      3,
    );
    // le spot de crise reste STRICTEMENT une borne haute, pas la valeur centrale
    expect(HYPOTHESES.prix_diesel.valeur).toBeLessThan(DONNEES_ENERGIE.diesel.spotCriseAvantTpsTvqParL);
  });
});

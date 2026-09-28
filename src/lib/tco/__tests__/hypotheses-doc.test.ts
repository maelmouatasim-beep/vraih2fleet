import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildHypothesesMarkdown } from '../generate-hypotheses-doc';
import { LISTE_HYPOTHESES } from '../assumptions';
import { PROGRAMMES } from '../subsidy-programs';

const DOC_PATH = resolve(__dirname, '../../../../docs/tco-hypotheses.md');

describe('docs/tco-hypotheses.md', () => {
  it('est à jour par rapport à assumptions.ts et subsidy-programs.ts', () => {
    const attendu = buildHypothesesMarkdown();
    if (process.env.REGEN === '1') {
      writeFileSync(DOC_PATH, attendu, 'utf-8');
      return;
    }
    let surDisque = '';
    try {
      surDisque = readFileSync(DOC_PATH, 'utf-8');
    } catch {
      // fichier absent : le message d'échec ci-dessous dit comment le générer
    }
    expect(
      surDisque,
      'docs/tco-hypotheses.md n’est pas à jour — lancer `npm run docs:tco` et committer le résultat',
    ).toBe(attendu);
  });
});

describe('registre des hypothèses', () => {
  it('chaque hypothèse a une plage cohérente qui contient la valeur centrale', () => {
    for (const h of LISTE_HYPOTHESES) {
      expect(h.plage.basse, h.id).toBeLessThanOrEqual(h.plage.haute);
      expect(h.valeur, h.id).toBeGreaterThanOrEqual(h.plage.basse);
      expect(h.valeur, h.id).toBeLessThanOrEqual(h.plage.haute);
    }
  });

  it('chaque hypothèse a une source avec URL et une date de vérification', () => {
    for (const h of LISTE_HYPOTHESES) {
      expect(h.source.url, h.id).toMatch(/^https:\/\//);
      expect(h.dateVerification, h.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('les ids du registre correspondent aux clés', () => {
    for (const h of LISTE_HYPOTHESES) {
      expect(LISTE_HYPOTHESES.filter((x) => x.id === h.id)).toHaveLength(1);
    }
  });
});

describe('registre des programmes de subventions', () => {
  it('un programme non actif n’est jamais compté automatiquement', () => {
    for (const p of PROGRAMMES) {
      if (p.statut !== 'actif') {
        // garde documentaire : le moteur (1B) filtrera sur `programmesActifs()` ;
        // ici on fige la règle pour que tout changement soit conscient.
        expect(['ferme', 'suspendu']).toContain(p.statut);
      }
    }
  });

  it('chaque barème a un plafond défini (0 = jamais compté automatiquement)', () => {
    for (const p of PROGRAMMES) {
      for (const b of p.baremes) {
        expect(b.plafondParVehicule, `${p.id}`).toBeGreaterThanOrEqual(0);
        if (b.pourcentage !== undefined) {
          expect(b.pourcentage, p.id).toBeGreaterThan(0);
          expect(b.pourcentage, p.id).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('chaque programme a une source datée', () => {
    for (const p of PROGRAMMES) {
      expect(p.source.url, p.id).toMatch(/^https:\/\//);
      expect(p.dateVerification, p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

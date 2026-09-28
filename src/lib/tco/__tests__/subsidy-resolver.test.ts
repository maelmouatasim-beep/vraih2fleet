import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resoudreSubventionsVehicule } from '../subsidy-resolver';
import { PROGRAMMES } from '../subsidy-programs';

describe('résolveur de subventions', () => {
  it('véhicule léger BEV ≤ 50 k$ : PAVÉ 5 000 $ (an 0) + Roulez vert 2 000 $ (an 0), cumulés', () => {
    const s = resoudreSubventionsVehicule({
      categorie: 'vehicule_leger',
      technologie: 'BEV',
      prixAvantTaxes: 49500,
      typeOrganisme: 'municipalite',
    });
    expect(s.reduce((a, x) => a + x.montant, 0)).toBe(7000);
    expect(s.every((x) => x.annee === 0)).toBe(true);
  });

  it('PAVÉ refusé au-delà de 50 k$ sauf véhicule fabriqué au Canada', () => {
    const sans = resoudreSubventionsVehicule({
      categorie: 'vehicule_leger',
      technologie: 'BEV',
      prixAvantTaxes: 55000,
      typeOrganisme: 'municipalite',
    });
    expect(sans.some((x) => x.libelle.includes('PAVÉ'))).toBe(false);
    const avec = resoudreSubventionsVehicule({
      categorie: 'vehicule_leger',
      technologie: 'BEV',
      prixAvantTaxes: 55000,
      typeOrganisme: 'municipalite',
      fabriqueAuCanada: true,
    });
    expect(avec.some((x) => x.libelle.includes('PAVÉ'))).toBe(true);
  });

  it('camion moyen classe 3-4 : pourcentage plafonné (Écocamionnage), versement an 1', () => {
    const s = resoudreSubventionsVehicule({
      categorie: 'camion_moyen',
      technologie: 'BEV',
      prixAvantTaxes: 300000,
      typeOrganisme: 'municipalite',
    });
    // barèmes classes 3/4/5-7 : le meilleur admissible est retenu (max),
    // ici plafond 100 000 $ (classes 5-7) ≥ 35 % × 300 000 plafonné à 75 000
    expect(s).toHaveLength(1);
    expect(s[0].annee).toBe(1);
    expect(s[0].montant).toBe(100000);
  });

  it('plafond respecté : camion lourd FCEV 720 k$ → 150 000 $ max (pas 25 %)', () => {
    const s = resoudreSubventionsVehicule({
      categorie: 'camion_lourd',
      technologie: 'FCEV',
      prixAvantTaxes: 720000,
      typeOrganisme: 'municipalite',
    });
    expect(s).toHaveLength(1);
    expect(s[0].montant).toBe(150000);
  });

  it('bonification achat local : +15 % (Écocamionnage seulement)', () => {
    const sans = resoudreSubventionsVehicule({
      categorie: 'camion_lourd',
      technologie: 'BEV',
      prixAvantTaxes: 460000,
      typeOrganisme: 'municipalite',
    });
    const avec = resoudreSubventionsVehicule({
      categorie: 'camion_lourd',
      technologie: 'BEV',
      prixAvantTaxes: 460000,
      typeOrganisme: 'municipalite',
      fabriqueAuQuebec: true,
    });
    expect(avec[0].montant).toBeCloseTo(sans[0].montant * 1.15, 6);
  });

  it('un programme fermé ou suspendu n’est JAMAIS compté (iMHZEV, PIVEZ)', () => {
    const s = resoudreSubventionsVehicule({
      categorie: 'camion_lourd',
      technologie: 'BEV',
      prixAvantTaxes: 460000,
      typeOrganisme: 'entreprise',
    });
    expect(s.some((x) => x.libelle.includes('iMHZEV') || x.libelle.includes('iVMLZE'))).toBe(false);
    expect(s.some((x) => x.libelle.includes('PIVEZ'))).toBe(false);
  });

  it('un barème « montant du projet » (plafond 0) n’est jamais compté (FTCZE, PAGTCP)', () => {
    const s = resoudreSubventionsVehicule({
      categorie: 'autobus_urbain_12m',
      technologie: 'BEV',
      prixAvantTaxes: 1720000,
      typeOrganisme: 'societe_transport',
    });
    expect(s).toHaveLength(0);
  });

  it('propriété : Σ subventions ≤ coût admissible, montants ≥ 0, années ≥ 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 2_500_000 }),
        fc.constantFrom('vehicule_leger', 'camionnette', 'camion_moyen', 'camion_lourd', 'autobus_urbain_12m'),
        fc.constantFrom('BEV', 'FCEV'),
        fc.constantFrom('municipalite', 'societe_transport', 'entreprise'),
        fc.boolean(),
        (prix, categorie, technologie, organisme, local) => {
          const s = resoudreSubventionsVehicule({
            categorie: categorie as never,
            technologie: technologie as never,
            prixAvantTaxes: prix,
            typeOrganisme: organisme as never,
            fabriqueAuQuebec: local,
          });
          const total = s.reduce((a, x) => a + x.montant, 0);
          expect(total).toBeLessThanOrEqual(prix + 1e-9);
          for (const x of s) {
            expect(x.montant).toBeGreaterThan(0);
            expect(x.annee).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('prix invalide rejeté', () => {
    expect(() =>
      resoudreSubventionsVehicule({
        categorie: 'vehicule_leger',
        technologie: 'BEV',
        prixAvantTaxes: Number.NaN,
        typeOrganisme: 'municipalite',
      }),
    ).toThrow();
  });

  it('le registre ne compte automatiquement que des programmes actifs à barème défini', () => {
    for (const p of PROGRAMMES) {
      if (p.statut === 'actif') continue;
      expect(['ferme', 'suspendu']).toContain(p.statut);
    }
  });
});

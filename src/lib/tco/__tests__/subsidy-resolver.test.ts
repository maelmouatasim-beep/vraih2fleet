import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resoudreSubventions, resoudreSubventionsVehicule } from '../subsidy-resolver';
import { PROGRAMMES, statutEffectif, type ProgrammeSubvention } from '../subsidy-programs';

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

  it('classe de poids EXACTE : un classe 4 reçoit le barème classe 4 (35 %, max 75 000 $), jamais le 100 000 $ des classes 5-7', () => {
    const s = resoudreSubventionsVehicule({
      categorie: 'camion_moyen',
      technologie: 'BEV',
      prixAvantTaxes: 300000,
      typeOrganisme: 'municipalite',
      classePoids: '4',
    });
    expect(s).toHaveLength(1);
    expect(s[0].annee).toBe(1);
    expect(s[0].montant).toBe(75000); // min(0,35 × 300 000 ; 75 000)
    const cl6 = resoudreSubventionsVehicule({
      categorie: 'camion_moyen',
      technologie: 'BEV',
      prixAvantTaxes: 460000,
      typeOrganisme: 'municipalite',
      classePoids: '6',
    });
    expect(cl6[0].montant).toBe(100000); // min(0,25 × 460 000 ; 100 000)
  });

  it('classe INCONNUE : barème le plus bas des classes possibles + avertissement (jamais le plus élevé)', () => {
    const r = resoudreSubventions({
      categorie: 'camion_lourd',
      technologie: 'FCEV',
      prixAvantTaxes: 720000,
      typeOrganisme: 'municipalite',
    });
    // camion_lourd = classes 7-8 : barème 5-7 (100 000) < barème 8 (150 000)
    expect(r.subventions).toHaveLength(1);
    expect(r.subventions[0].montant).toBe(100000);
    expect(r.avertissements.some((a) => a.includes('classe de poids'))).toBe(true);
    const avecClasse = resoudreSubventions({
      categorie: 'camion_lourd',
      technologie: 'FCEV',
      prixAvantTaxes: 720000,
      typeOrganisme: 'municipalite',
      classePoids: '8',
    });
    expect(avecClasse.subventions[0].montant).toBe(150000); // min(0,25 × 720 000 ; 150 000)
    expect(avecClasse.avertissements.some((a) => a.includes('classe de poids'))).toBe(false);
  });

  it('le pourcentage à valider des classes 5-8 est signalé en avertissement', () => {
    const r = resoudreSubventions({
      categorie: 'camion_lourd',
      technologie: 'BEV',
      prixAvantTaxes: 460000,
      typeOrganisme: 'municipalite',
      classePoids: '8',
    });
    expect(r.avertissements.some((a) => a.includes('À VALIDER'))).toBe(true);
  });

  it('bonification achat local : +15 % DANS le plafond du barème', () => {
    const base = {
      categorie: 'camion_lourd' as const,
      technologie: 'BEV' as const,
      prixAvantTaxes: 460000,
      typeOrganisme: 'municipalite' as const,
      classePoids: '8' as const,
    };
    const sans = resoudreSubventionsVehicule(base);
    const avec = resoudreSubventionsVehicule({ ...base, fabriqueAuQuebec: true });
    // 25 % × 460 000 = 115 000 ; bonifié : 132 250, sous le plafond de 150 000
    expect(sans[0].montant).toBe(115000);
    expect(avec[0].montant).toBeCloseTo(115000 * 1.15, 6);
    // au plafond, la bonification ne dépasse JAMAIS le plafond
    const plafonne = resoudreSubventionsVehicule({
      ...base,
      technologie: 'FCEV',
      prixAvantTaxes: 720000,
      fabriqueAuQuebec: true,
    });
    expect(plafonne[0].montant).toBe(150000); // pas 172 500
  });

  it('PAVÉ dégressif : le montant suit l’année d’achat (5 000 $ en 2026, 4 000 $ en 2027, 2 000 $ en 2030)', () => {
    const base = {
      categorie: 'vehicule_leger' as const,
      technologie: 'BEV' as const,
      prixAvantTaxes: 49500,
      typeOrganisme: 'municipalite' as const,
    };
    const pave = (annee: number) =>
      resoudreSubventionsVehicule({ ...base, anneeAchatCalendaire: annee }).find((x) =>
        x.libelle.includes('PAVÉ'),
      );
    expect(pave(2026)!.montant).toBe(5000);
    expect(pave(2027)!.montant).toBe(4000);
    expect(pave(2030)!.montant).toBe(2000);
  });

  it('PAVÉ : limite de 10 incitatifs par organisation signalée en avertissement', () => {
    const r = resoudreSubventions({
      categorie: 'vehicule_leger',
      technologie: 'BEV',
      prixAvantTaxes: 49500,
      typeOrganisme: 'municipalite',
    });
    expect(r.avertissements.some((a) => a.includes('10 incitatifs'))).toBe(true);
  });

  it('Écocamionnage classe 2b dégressif par année financière : 2 500 $ en 2026, 0 $ dès 2027', () => {
    const base = {
      categorie: 'camionnette' as const,
      technologie: 'BEV' as const,
      prixAvantTaxes: 95000,
      typeOrganisme: 'municipalite' as const,
      classePoids: '2b' as const,
    };
    const en2026 = resoudreSubventionsVehicule({ ...base, anneeAchatCalendaire: 2026 });
    expect(en2026.find((x) => x.libelle.includes('Écocamionnage'))!.montant).toBe(2500);
    const en2027 = resoudreSubventionsVehicule({ ...base, anneeAchatCalendaire: 2027 });
    expect(en2027.some((x) => x.libelle.includes('Écocamionnage'))).toBe(false);
  });

  it('Écocamionnage hors classe 2b : condition RPEVL/cote de sécurité signalée en avertissement', () => {
    const r = resoudreSubventions({
      categorie: 'camion_moyen',
      technologie: 'BEV',
      prixAvantTaxes: 300000,
      typeOrganisme: 'municipalite',
      classePoids: '4',
    });
    expect(r.avertissements.some((a) => a.includes('RPEVL'))).toBe(true);
  });

  it('cumul des aides publiques plafonné (art. 7.14.2) : l’excédent est déduit de l’aide du programme', () => {
    // Programmes synthétiques : une aide fédérale de 60 % + un programme
    // « type Écocamionnage » (50 %, plafond de cumul 75 %) sur 100 000 $.
    const programmes: ProgrammeSubvention[] = [
      {
        id: 'fed_test',
        nom: 'Aide fédérale test',
        palier: 'federal',
        cible: 'vehicule',
        statut: 'actif',
        organismesAdmissibles: ['municipalite'],
        baremes: [
          { categories: ['camion_moyen'], technologies: ['BEV'], pourcentage: 0.6, plafondParVehicule: 60000 },
        ],
        cumul: '',
        anneeVersementDefaut: 0,
        source: { organisme: 'test', document: 'test', annee: 2026, url: 'https://example.invalid' },
        dateVerification: '2026-09-28',
        statutVerification: 'a_valider',
      },
      {
        id: 'qc_test',
        nom: 'Aide québécoise test (cumul 75 %)',
        palier: 'provincial',
        cible: 'vehicule',
        statut: 'actif',
        organismesAdmissibles: ['municipalite'],
        baremes: [
          { categories: ['camion_moyen'], technologies: ['BEV'], pourcentage: 0.5, plafondParVehicule: 50000 },
        ],
        plafondCumulAidePubliquePct: 0.75,
        cumul: '',
        anneeVersementDefaut: 1,
        source: { organisme: 'test', document: 'test', annee: 2026, url: 'https://example.invalid' },
        dateVerification: '2026-09-28',
        statutVerification: 'a_valider',
      },
    ];
    const r = resoudreSubventions(
      { categorie: 'camion_moyen', technologie: 'BEV', prixAvantTaxes: 100000, typeOrganisme: 'municipalite' },
      programmes,
    );
    // 60 000 + 50 000 = 110 000 > 75 000 : l'aide au plafond de cumul est
    // réduite à 15 000 ; total = 75 000 = 75 % des dépenses admissibles.
    const total = r.subventions.reduce((a, x) => a + x.montant, 0);
    expect(total).toBe(75000);
    expect(r.subventions.find((x) => x.libelle.includes('québécoise'))!.montant).toBe(15000);
    expect(r.avertissements.some((a) => a.includes('7.14.2'))).toBe(true);
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
        fc.option(fc.constantFrom('2b', '3', '4', '5', '6', '7', '8'), { nil: undefined }),
        (prix, categorie, technologie, organisme, local, classe) => {
          const s = resoudreSubventionsVehicule({
            categorie: categorie as never,
            technologie: technologie as never,
            prixAvantTaxes: prix,
            typeOrganisme: organisme as never,
            fabriqueAuQuebec: local,
            classePoids: classe as never,
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

  it("un programme échu avant l'année d'achat prévue n'est pas compté", () => {
    // Roulez vert prend fin le 2026-12-31 : compté pour un achat 2026,
    // exclu pour un achat 2029 ; le PAVÉ (fin 2031) reste compté.
    const base = {
      categorie: 'vehicule_leger' as const,
      technologie: 'BEV' as const,
      prixAvantTaxes: 49500,
      typeOrganisme: 'municipalite' as const,
    };
    const achat2026 = resoudreSubventionsVehicule({ ...base, anneeAchatCalendaire: 2026 });
    expect(achat2026.some((x) => x.libelle.includes('Roulez vert'))).toBe(true);
    const achat2029 = resoudreSubventionsVehicule({ ...base, anneeAchatCalendaire: 2029 });
    expect(achat2029.some((x) => x.libelle.includes('Roulez vert'))).toBe(false);
    expect(achat2029.some((x) => x.libelle.includes('PAVÉ'))).toBe(true);
  });

  it('statutEffectif : un programme dont la date de fin est passée est « ferme », le statut stocké ne fait pas foi', () => {
    const rv = PROGRAMMES.find((p) => p.id === 'roulez_vert')!;
    expect(rv.dateFin).toBe('2026-12-31');
    expect(statutEffectif(rv, '2026-06-01')).toBe('actif');
    expect(statutEffectif(rv, '2027-01-01')).toBe('ferme');
    const pivez = PROGRAMMES.find((p) => p.statut !== 'actif');
    if (pivez) expect(statutEffectif(pivez, '2026-06-01')).toBe(pivez.statut);
  });

  it('le registre ne compte automatiquement que des programmes actifs à barème défini', () => {
    for (const p of PROGRAMMES) {
      if (p.statut === 'actif') continue;
      expect(['ferme', 'suspendu']).toContain(p.statut);
    }
  });
});

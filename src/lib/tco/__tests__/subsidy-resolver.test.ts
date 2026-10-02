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

describe('subventions explicables (revue 1.7, test terrain)', () => {
  const camionnette = (anneeAchatCalendaire: number, classePoids?: '2b' | '3') =>
    resoudreSubventions({
      categorie: 'camionnette',
      technologie: 'BEV',
      prixAvantTaxes: 95000,
      typeOrganisme: 'municipalite',
      anneeAchatCalendaire,
      classePoids,
    });

  it('BUG F-150 (classe inconnue) : 2 500 $ en 2026, 0 $ en 2027 avec la raison — plus jamais 23 750 $ par défaut', () => {
    expect(camionnette(2026).subventions).toEqual([
      expect.objectContaining({ montant: 2500 }),
    ]);
    const r2027 = camionnette(2027);
    expect(r2027.subventions).toEqual([]);
    const eco = r2027.explications.find((e) => e.programmeId === 'ecocamionnage_v1')!;
    expect(eco.statut).toBe('exclue');
    expect(eco.raisons.map((x) => x.code)).toEqual(['bareme_nul_annee', 'classe_inconnue']);
    expect(eco.regle).toMatchObject({ type: 'forfait', classes: ['2b'], anneeAchat: 2027, montant: 0 });
    // Classe 3 RENSEIGNÉE : 25 % du prix, plafonné — la règle est exposée.
    const c3 = camionnette(2027, '3').explications.find((e) => e.programmeId === 'ecocamionnage_v1')!;
    expect(c3).toMatchObject({ statut: 'retenue', montant: 23750 });
    expect(c3.regle).toMatchObject({ type: 'pourcentage', pourcentage: 0.25, base: 95000, plafond: 30000, classes: ['3'] });
  });

  it('propriété : deux véhicules identiques achetés la même année = même subvention', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('camionnette', 'vehicule_leger', 'camion_moyen', 'camion_lourd', 'autobus_urbain_12m'),
        fc.constantFrom('BEV', 'FCEV'),
        fc.integer({ min: 2025, max: 2032 }),
        fc.integer({ min: 20000, max: 900000 }),
        (categorie, technologie, annee, prix) => {
          const d = {
            categorie: categorie as never,
            technologie: technologie as 'BEV' | 'FCEV',
            prixAvantTaxes: prix,
            typeOrganisme: 'municipalite' as const,
            anneeAchatCalendaire: annee,
          };
          const a = resoudreSubventions(d);
          const b = resoudreSubventions({ ...d });
          expect(b.subventions).toEqual(a.subventions);
          expect(b.explications).toEqual(a.explications);
          // Classe inconnue : jamais plus que le barème le plus bas des classes possibles.
          const eco = a.subventions.find((s) => s.libelle.startsWith('Écocamionnage'))?.montant ?? 0;
          for (const classe of ['2b', '3', '4', '5', '8'] as const) {
            const avec = resoudreSubventions({ ...d, classePoids: classe }).subventions.find((s) =>
              s.libelle.startsWith('Écocamionnage'),
            );
            if (avec) expect(eco).toBeLessThanOrEqual(avec.montant + 1e-6);
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it('Corolla électrique (véhicule léger, prix par défaut 55 000 $) en 2027 : 0 $ avec les raisons', () => {
    const r = resoudreSubventions({
      categorie: 'vehicule_leger',
      technologie: 'BEV',
      prixAvantTaxes: 55000,
      typeOrganisme: 'municipalite',
      anneeAchatCalendaire: 2027,
    });
    expect(r.subventions).toEqual([]);
    const pave = r.explications.find((e) => e.programmeId === 'pave')!;
    expect(pave.raisons).toEqual([{ code: 'prix_plafond', plafond: 50000, prix: 55000, inclusif: true }]);
    const rv = r.explications.find((e) => e.programmeId === 'roulez_vert')!;
    expect(rv.raisons).toEqual([{ code: 'programme_echu', dateFin: '2026-12-31', anneeAchat: 2027 }]);
    // Prix ≤ 50 000 $ : le PAVÉ (actif jusqu'en 2031) verse son barème 2027.
    const moinsCher = resoudreSubventions({
      categorie: 'vehicule_leger',
      technologie: 'BEV',
      prixAvantTaxes: 45000,
      typeOrganisme: 'municipalite',
      anneeAchatCalendaire: 2027,
    });
    expect(moinsCher.explications.find((e) => e.programmeId === 'pave')).toMatchObject({
      statut: 'retenue',
      montant: 4000,
      regle: { type: 'forfait', anneeAchat: 2027 },
    });
  });

  it('programme fermé, montant par projet et cumul réduit : statut et raison exposés', () => {
    const lourd = resoudreSubventions({
      categorie: 'camion_lourd',
      technologie: 'BEV',
      prixAvantTaxes: 400000,
      typeOrganisme: 'municipalite',
      anneeAchatCalendaire: 2026,
    });
    expect(lourd.explications.find((e) => e.programmeId === 'imhzev')).toMatchObject({
      statut: 'exclue',
      raisons: [{ code: 'programme_ferme', statut: 'ferme' }],
    });
    const bus = resoudreSubventions({
      categorie: 'autobus_urbain_12m',
      technologie: 'BEV',
      prixAvantTaxes: 1_200_000,
      typeOrganisme: 'societe_transport',
      anneeAchatCalendaire: 2026,
    });
    expect(bus.explications.find((e) => e.programmeId === 'pagtcp')!.raisons).toEqual([{ code: 'montant_par_projet' }]);
  });
});

describe('résolveur — cas limites des explications (registres synthétiques)', () => {
  const base = {
    palier: 'provincial' as const,
    cible: 'vehicule' as const,
    statut: 'actif' as const,
    organismesAdmissibles: ['municipalite' as const],
    cumul: '',
    anneeVersementDefaut: 0 as const,
    source: { organisme: 'T', document: 'T', annee: 2026, url: 'https://example.org' },
    dateVerification: '2026-10-02',
    statutVerification: 'estimation' as const,
  };
  const demande = {
    categorie: 'camion_moyen' as const,
    technologie: 'BEV' as const,
    prixAvantTaxes: 100000,
    typeOrganisme: 'municipalite' as const,
    anneeAchatCalendaire: 2026,
  };

  it('organisme non admissible, classe non couverte, année absente du barème dégressif', () => {
    const progs: ProgrammeSubvention[] = [
      { ...base, id: 'a', nom: 'A', organismesAdmissibles: ['entreprise'], baremes: [{ categories: ['camion_moyen'], technologies: ['BEV'], plafondParVehicule: 1000 }] },
      { ...base, id: 'b', nom: 'B', baremes: [{ categories: ['camion_moyen'], technologies: ['BEV'], classesPoids: ['4'], plafondParVehicule: 1000 }] },
      { ...base, id: 'c', nom: 'C', baremes: [{ categories: ['camion_moyen'], technologies: ['BEV'], plafondParVehicule: 1000, montantParAnneeAchat: { 2025: 1000 } }] },
    ];
    const r = resoudreSubventions({ ...demande, classePoids: '6' }, progs);
    expect(r.explications.map((e) => [e.programmeId, e.raisons[0].code])).toEqual([
      ['a', 'organisme_non_admissible'],
      ['b', 'classe_non_couverte'],
      ['c', 'bareme_nul_annee'],
    ]);
    expect(r.explications[2].raisons[0]).toEqual({ code: 'bareme_nul_annee', classes: null, anneeAchat: 2026 });
  });

  it('classe connue : le meilleur barème de la classe ; % dégressif = forfait ; bonification exposée', () => {
    const progs: ProgrammeSubvention[] = [
      {
        ...base,
        id: 'd',
        nom: 'D',
        bonificationAchatLocal: 0.1,
        baremes: [
          { categories: ['camion_moyen'], technologies: ['BEV'], classesPoids: ['4'], plafondParVehicule: 1000 },
          { categories: ['camion_moyen'], technologies: ['BEV'], classesPoids: ['4'], pourcentage: 0.1, plafondParVehicule: 9000, montantParAnneeAchat: { 2026: 3000 } },
        ],
      },
    ];
    const r = resoudreSubventions({ ...demande, classePoids: '4', fabriqueAuQuebec: true }, progs);
    expect(r.explications[0].montant).toBeCloseTo(3300, 6);
    expect(r.explications[0].regle).toMatchObject({ type: 'forfait', anneeAchat: 2026, bonificationPct: 0.1 });
  });

  it('classe inconnue mais un seul barème par classe : pas de raison « classe inconnue » ; % à valider exposé', () => {
    const progs: ProgrammeSubvention[] = [
      {
        ...base,
        id: 'e',
        nom: 'E',
        baremes: [
          { categories: ['camion_moyen'], technologies: ['BEV'], classesPoids: ['4'], pourcentage: 0.2, pourcentageAValider: true, plafondParVehicule: 50000 },
          { categories: ['camion_moyen'], technologies: ['BEV'], plafondParVehicule: 30000 },
        ],
      },
    ];
    const r = resoudreSubventions(demande, progs);
    expect(r.explications[0].raisons.map((x) => x.code)).toEqual(['pourcentage_a_valider']);
    expect(r.explications[0].montant).toBe(20000);
  });

  it('total plafonné au coût : la plus petite aide est réduite, la principale reste intacte', () => {
    const forfait = (id: string, m: number): ProgrammeSubvention => ({
      ...base,
      id,
      nom: id,
      baremes: [{ categories: ['camion_moyen'], technologies: ['BEV'], plafondParVehicule: m }],
    });
    const r = resoudreSubventions({ ...demande, prixAvantTaxes: 10000 }, [forfait('gros', 8000), forfait('petit', 5000)]);
    const parId = Object.fromEntries(r.explications.map((e) => [e.programmeId, e]));
    expect(parId.gros).toMatchObject({ statut: 'retenue', montant: 8000, raisons: [] });
    expect(parId.petit).toMatchObject({ statut: 'reduite', montant: 2000, raisons: [{ code: 'plafond_cout', reduction: 3000 }] });
    const zero = resoudreSubventions({ ...demande, prixAvantTaxes: 8000 }, [forfait('gros', 8000), forfait('petit', 5000)]);
    expect(zero.explications.find((e) => e.programmeId === 'petit')!.statut).toBe('exclue');
  });
});

/**
 * Chemins de bord du moteur : événements majeurs, avertissements,
 * subventions d'infrastructure, erreurs de construction.
 */
import { describe, expect, it } from 'vitest';
import * as barrel from '../index';
import { calculerPlan } from '../engine';
import { programmesActifs, PROGRAMMES } from '../subsidy-programs';
import type { PlanTcoEntree } from '../types';
import { PARAMETRES_CAS } from './cas-de-reference';

function base(): PlanTcoEntree {
  return {
    parametres: { ...PARAMETRES_CAS },
    vehicules: [
      {
        id: 'v1',
        kmParAn: 30000,
        classeEmissionDiesel: 'legers',
        reference: {
          technologie: 'diesel',
          prixAvantTaxes: 68000,
          consommationPar100km: 15,
          entretienParKm: 0.14,
          evenements: [{ libelle: 'révision moteur', annee: 6, coutAvantTaxes: 12000 }],
        },
        alternative: {
          technologie: 'BEV',
          prixAvantTaxes: 95000,
          consommationPar100km: 32,
          entretienParKm: 0.1,
          evenements: [
            { libelle: 'remplacement batterie', annee: 8, coutAvantTaxes: 30000 },
            { libelle: 'hors horizon', annee: 25, coutAvantTaxes: 999999 },
          ],
        },
        subventionsAlternative: [{ libelle: 'tardive', montant: 1000, annee: 15 }],
        dureeVieAns: 30,
      },
    ],
    sitesInfra: [
      {
        id: 's1',
        capexAvantTaxes: 15000,
        vehiculeIds: ['v1'],
        subventions: [
          { libelle: 'PIVEZ (saisi)', montant: 5000, annee: 1 },
          { libelle: 'infra tardive', montant: 100, annee: 20 },
        ],
      },
    ],
  };
}

describe('événements majeurs et avertissements', () => {
  it('les événements datés sont comptés à leur année (part non récupérable ajoutée), ceux hors horizon ignorés', () => {
    const r = calculerPlan(base());
    const taxes = 1 + PARAMETRES_CAS.tauxTaxesNonRecuperables;
    expect(r.alternative.flux.evenements[8]).toBeCloseTo(30000 * taxes, 9);
    expect(r.reference.flux.evenements[6]).toBeCloseTo(12000 * taxes, 9);
    expect(r.alternative.flux.evenements.reduce((a, b) => a + b, 0)).toBeCloseTo(30000 * taxes, 9);
  });

  it('subvention versée après l’horizon : ignorée + avertissement (véhicule et site)', () => {
    const r = calculerPlan(base());
    expect(r.alternative.flux.subventions.reduce((a, b) => a + b, 0)).toBe(5000); // seule celle du site, an 1
    expect(r.avertissements.some((a) => a.includes('tardive'))).toBe(true);
    expect(r.avertissements.some((a) => a.includes('infra tardive'))).toBe(true);
  });

  it('subvention d’infrastructure comptée à son année de versement', () => {
    const r = calculerPlan(base());
    expect(r.alternative.flux.subventions[1]).toBe(5000);
  });

  it("durée de vie de l'infra < horizon : RÉINVESTISSEMENT en fin de vie (§3.5 v2.0)", () => {
    const plan = base();
    plan.parametres = { ...PARAMETRES_CAS, infra: { entretienAnnuelPctCapex: 0.03, dureeVieAns: 5 } };
    const r = calculerPlan(plan);
    const taxes = 1 + PARAMETRES_CAS.tauxTaxesNonRecuperables;
    // réachat à l'année 5, capex indexé à l'inflation générale
    expect(r.alternative.flux.investissement[5]).toBeCloseTo(
      15000 * Math.pow(1 + PARAMETRES_CAS.inflations.generale, 5) * taxes,
      6,
    );
    // le dernier équipement (acheté en 5, âge 5 = durée de vie) n'a
    // aucune VR linéaire en fin d'horizon : seul le véhicule en a une
    const residuelInfra = r.alternative.flux.residuels[10] - Math.max(0.82 ** 10, 0.1) * 95000;
    expect(Math.abs(residuelInfra)).toBeLessThan(1e-9);
  });

  it("site mis en service à l'année des véhicules : capex à cette année-là, rien avant", () => {
    const plan = base();
    plan.sitesInfra = [
      { id: 's1', capexAvantTaxes: 15000, vehiculeIds: ['v1'], anneeMiseEnService: 3 },
    ];
    const r = calculerPlan(plan);
    const taxes = 1 + PARAMETRES_CAS.tauxTaxesNonRecuperables;
    // année 0 : seulement le véhicule (acquis en 0)
    expect(r.alternative.flux.investissement[0]).toBeCloseTo(95000 * taxes, 6);
    expect(r.alternative.flux.investissement[3]).toBeCloseTo(
      15000 * Math.pow(1 + PARAMETRES_CAS.inflations.generale, 3) * taxes,
      6,
    );
    // opex seulement après la mise en service
    expect(r.alternative.flux.opexInfra[3]).toBe(0);
    expect(r.alternative.flux.opexInfra[4]).toBeGreaterThan(0);
    // VR linéaire du dernier équipement : âge 7 sur 15 en fin d'horizon
    const capexIndexe = 15000 * Math.pow(1 + PARAMETRES_CAS.inflations.generale, 3);
    const residuelInfra =
      r.alternative.flux.residuels[10] -
      Math.max(0.82 ** 10, 0.1) * 95000 -
      (capexIndexe * (15 - 7)) / 15;
    expect(Math.abs(residuelInfra)).toBeLessThan(1e-6);
  });

  it("assurance fournie : $/an indexés à l'inflation générale, dans le net (§3.6)", () => {
    const plan = base();
    plan.vehicules[0].alternative.assuranceParAn = 1200;
    const r = calculerPlan(plan);
    expect(r.alternative.flux.assurance[1]).toBeCloseTo(
      1200 * (1 + PARAMETRES_CAS.inflations.generale),
      9,
    );
    const sans = calculerPlan(base());
    expect(r.alternative.tcoActualise).toBeGreaterThan(sans.alternative.tcoActualise);
    expect(r.reference.flux.assurance.every((x) => x === 0)).toBe(true);
  });

  it('site avec des technologies mixtes : parts égales + avertissement', () => {
    const plan = base();
    plan.vehicules.push({
      id: 'v2',
      kmParAn: 60000,
      classeEmissionDiesel: 'lourds',
      reference: { technologie: 'diesel', prixAvantTaxes: 200000, consommationPar100km: 36, entretienParKm: 0.35 },
      alternative: { technologie: 'FCEV', prixAvantTaxes: 720000, consommationPar100km: 8, entretienParKm: 0.32 },
      dureeVieAns: 30,
    });
    plan.sitesInfra = [{ id: 's1', capexAvantTaxes: 100000, vehiculeIds: ['v1', 'v2'] }];
    const r = calculerPlan(plan);
    expect(r.avertissements.some((a) => a.includes('mixtes'))).toBe(true);
    expect(r.partsInfra.map((p) => p.part)).toEqual([50000, 50000]);
  });

  it('site référençant un véhicule inconnu : erreur explicite', () => {
    const plan = base();
    plan.sitesInfra = [{ id: 's1', capexAvantTaxes: 1000, vehiculeIds: ['inconnu'] }];
    expect(() => calculerPlan(plan)).toThrow(/inconnu/);
  });

  it('référence non diesel rejetée par la validation', () => {
    const plan = base();
    (plan.vehicules[0].reference as { technologie: string }).technologie = 'BEV';
    expect(() => calculerPlan(plan)).toThrow();
  });

  it('économies annuelles nulles ou négatives : raison de payback dédiée', () => {
    const plan = base();
    // alternative strictement plus chère à l'achat ET à l'exploitation
    plan.vehicules[0].alternative = {
      technologie: 'BEV',
      prixAvantTaxes: 95000,
      consommationPar100km: 500,
      entretienParKm: 2,
    };
    plan.vehicules[0].subventionsAlternative = [];
    const r = calculerPlan(plan);
    expect(r.paybackSimple.annees).toBeNull();
    expect(r.paybackSimple.raison).toBe('les économies annuelles sont nulles ou négatives');
  });

  it('aucune tonne évitée ⇒ coût par tonne null', () => {
    const plan = base();
    plan.vehicules[0].alternative = { ...plan.vehicules[0].reference, evenements: [] };
    plan.vehicules[0].subventionsAlternative = [];
    plan.sitesInfra = [];
    const r = calculerPlan(plan);
    expect(r.coutParTonneWtw).toBeNull();
  });
});

describe('barrel et registre', () => {
  it('le barrel expose le moteur, le registre et les utilitaires', () => {
    expect(typeof barrel.calculerPlan).toBe('function');
    expect(typeof barrel.analyserSensibilite).toBe('function');
    expect(typeof barrel.resoudreSubventionsVehicule).toBe('function');
    expect(barrel.ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(barrel.HYPOTHESES.prix_diesel.unite).toBe('$/L');
  });

  it('programmesActifs ne retourne que les programmes actifs', () => {
    const actifs = programmesActifs();
    expect(actifs.length).toBeGreaterThan(0);
    expect(actifs.every((p) => p.statut === 'actif')).toBe(true);
    expect(actifs.length).toBeLessThan(PROGRAMMES.length);
  });
});

describe('référence essence (revue 1.8)', () => {
  it('prix et facteur d’émission de l’essence ; paramètres manquants refusés', async () => {
    const { calculerPlan } = await import('../engine');
    const { cas1 } = await import('./cas-de-reference');
    const base = cas1();
    const plan = {
      ...base,
      parametres: {
        ...base.parametres,
        prixAnnee0: { ...base.parametres.prixAnnee0, essenceParL: 1.5 },
        facteursEmission: { ...base.parametres.facteursEmission, essenceTtwKgParL: 2.312, ratioWtwEssence: 1.25 },
      },
      vehicules: base.vehicules.map((v) => ({ ...v, carburantReference: 'essence' as const })),
    };
    const r = calculerPlan(plan);
    const v = base.vehicules[0];
    const litres = (v.kmParAn * v.reference.consommationPar100km) / 100;
    expect(r.reference.emissionsTtwTonnes).toBeCloseTo((litres * 2.312 * base.parametres.horizonAns) / 1000 * base.vehicules.length, 6);
    expect(r.reference.emissionsWtwTonnes).toBeCloseTo(r.reference.emissionsTtwTonnes * 1.25, 6);
    expect(() => calculerPlan({ ...base, vehicules: plan.vehicules })).toThrow(/essence/);
  });
});

import { describe, expect, it } from "vitest";
import { marchesRaccordement, proposerSousEnsembles, type CandidatGarage } from "../selectionGarage";

const PALIERS = [
  { palier: 1 as const, kwMax: 50, cout: 20000 },
  { palier: 2 as const, kwMax: 250, cout: 100000 },
  { palier: 3 as const, kwMax: Infinity, cout: 500000 },
];

/** Recherche exhaustive (référence) : meilleure Σ net − coût de la marche réellement atteinte. */
function bruteForce(c: CandidatGarage[], kwDisponibles: number): number {
  const marches = marchesRaccordement(kwDisponibles, PALIERS, null);
  let meilleure = 0;
  for (let m = 1; m < 1 << c.length; m++) {
    const choisis = c.filter((_, i) => m & (1 << i));
    const kw = choisis.reduce((s, x) => s + x.kw, 0);
    const marche = marches.find((x) => kw <= x.kwMax)!;
    meilleure = Math.max(meilleure, choisis.reduce((s, x) => s + x.net, 0) - marche.cout);
  }
  return meilleure;
}

describe("meilleur sous-ensemble d'un garage (sac à dos par marche de raccordement)", () => {
  it("escalier : capacité existante gratuite puis paliers ; un devis remplace l'escalier", () => {
    expect(marchesRaccordement(20, PALIERS, null).map((m) => [m.palier, m.kwMax, m.cout])).toEqual([
      [0, 20, 0],
      [1, 70, 20000],
      [2, 270, 100000],
      [3, Infinity, 500000],
    ]);
    expect(marchesRaccordement(20, PALIERS, 80000)).toEqual([{ palier: "devis", kwMax: Infinity, cout: 80000 }]);
  });

  it("ne garde que les véhicules de valeur nette positive (borne comprise)", () => {
    const p = proposerSousEnsembles(
      [
        { id: "perte", kw: 19, net: -5000 },
        { id: "gain", kw: 19, net: 8000 },
      ],
      marchesRaccordement(20, PALIERS, null),
    );
    expect(p[0]).toEqual(expect.objectContaining({ ids: ["gain"], valeurEstimee: 8000 }));
    expect(p.flatMap((x) => x.ids)).not.toContain("perte");
  });

  it("préfère les petits kW qui tiennent dans la capacité existante au gros véhicule qui déclenche un palier", () => {
    // Le camion a la plus forte valeur nette mais ses 150 kW imposent le palier 2.
    const c: CandidatGarage[] = [
      { id: "camion", kw: 150, net: 60000 },
      { id: "a", kw: 19, net: 9000 },
      { id: "b", kw: 19, net: 9000 },
      { id: "c", kw: 19, net: 9000 },
    ];
    const p = proposerSousEnsembles(c, marchesRaccordement(60, PALIERS, null));
    expect(p[0].ids.sort()).toEqual(["a", "b", "c"]);
    expect(p[0].marche.palier).toBe(0);
    expect(p[0].valeurEstimee).toBe(27000);
  });

  it("propriété : la meilleure proposition égale la recherche exhaustive (flottes déterministes variées)", () => {
    const kws = [19, 50, 150];
    for (let graine = 1; graine <= 40; graine++) {
      const n = 3 + (graine % 6);
      const c: CandidatGarage[] = Array.from({ length: n }, (_, i) => ({
        id: `v${i}`,
        kw: kws[(graine * (i + 3)) % 3],
        net: ((graine * 7919 + i * 104729) % 90000) - 20000,
      }));
      const disponibles = [0, 20, 60, 120][graine % 4];
      const p = proposerSousEnsembles(c, marchesRaccordement(disponibles, PALIERS, null));
      expect(Math.max(0, p[0]?.valeurEstimee ?? 0)).toBeCloseTo(Math.max(0, bruteForce(c, disponibles)), 6);
    }
  });
});

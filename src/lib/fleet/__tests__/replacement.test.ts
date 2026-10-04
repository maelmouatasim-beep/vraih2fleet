import { describe, expect, it } from "vitest";
import { DEFAUTS_CATEGORIES } from "@/lib/tco";
import { anneeRemplacementSuggeree, dureeVieCategorie } from "../replacement";

const ANNEE = 2026;

describe("dureeVieCategorie", () => {
  it("reprend la durée de vie des défauts du moteur TCO pour chaque catégorie connue", () => {
    for (const [categorie, defauts] of Object.entries(DEFAUTS_CATEGORIES)) {
      expect(dureeVieCategorie(categorie)).toBe(defauts.dureeVieAns);
    }
  });

  it("ne suggère rien pour une catégorie inconnue du moteur (« autre »)", () => {
    expect(dureeVieCategorie("autre")).toBeNull();
    expect(dureeVieCategorie("")).toBeNull();
  });
});

describe("anneeRemplacementSuggeree", () => {
  const camionMoyen = DEFAUTS_CATEGORIES.camion_moyen.dureeVieAns;

  it("mise en service + durée de vie de la catégorie", () => {
    const annee = anneeRemplacementSuggeree(
      { category: "camion_moyen", model_year: 2018, in_service_date: "2022-03-15" },
      ANNEE,
    );
    expect(annee).toBe(2022 + camionMoyen);
  });

  it("retombe sur l'année modèle quand la mise en service est absente", () => {
    const annee = anneeRemplacementSuggeree(
      { category: "camion_moyen", model_year: 2020, in_service_date: null },
      ANNEE,
    );
    expect(annee).toBe(2020 + camionMoyen);
  });

  it("jamais avant l'année courante (véhicule déjà en fin de vie)", () => {
    const annee = anneeRemplacementSuggeree(
      { category: "vehicule_leger", model_year: 2005, in_service_date: null },
      ANNEE,
    );
    expect(annee).toBe(ANNEE);
  });

  it("null sans catégorie connue ou sans année de départ", () => {
    expect(
      anneeRemplacementSuggeree({ category: "autre", model_year: 2020, in_service_date: null }, ANNEE),
    ).toBeNull();
    expect(
      anneeRemplacementSuggeree({ category: "camion_lourd", model_year: null, in_service_date: null }, ANNEE),
    ).toBeNull();
  });
});

describe("rattrapage lissé des remplacements en retard (audit acheteur, point 7)", () => {
  it("42 véhicules en retard : plus aucun dans l'année en cours, répartis à parts égales sur 3 ans, les plus anciens d'abord", async () => {
    const { lisserRattrapage } = await import("../replacement");
    const vehicules = Array.from({ length: 42 }, (_, i) => ({ id: `v${String(i).padStart(2, "0")}`, anneeFinVie: 2015 + (i % 11) }));
    const r = lisserRattrapage([...vehicules, { id: "futur", anneeFinVie: 2031 }, { id: "inconnu", anneeFinVie: null }], ANNEE, 3);
    const parAnnee = new Map<number, number>();
    for (const v of vehicules) parAnnee.set(r.get(v.id)!, (parAnnee.get(r.get(v.id)!) ?? 0) + 1);
    expect([...parAnnee.keys()].sort()).toEqual([2027, 2028, 2029]);
    expect([...parAnnee.values()]).toEqual([14, 14, 14]);
    expect(r.get("futur")).toBe(2031); // pas en retard : inchangé
    expect(r.get("inconnu")).toBeNull();
    // le plus ancien passe en premier
    const plusAncien = vehicules.find((v) => v.anneeFinVie === 2015)!;
    expect(r.get(plusAncien.id)).toBe(2027);
  });

  it("paramétrable : 1 an = tout l'an prochain ; 5 ans = étalé sur 5 ans ; déterministe", async () => {
    const { lisserRattrapage } = await import("../replacement");
    const v = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, anneeFinVie: 2020 }));
    expect(new Set(lisserRattrapage(v, ANNEE, 1).values())).toEqual(new Set([2027]));
    expect(new Set(lisserRattrapage(v, ANNEE, 5).values())).toEqual(new Set([2027, 2028, 2029, 2030, 2031]));
    expect(lisserRattrapage(v, ANNEE, 5)).toEqual(lisserRattrapage([...v].reverse(), ANNEE, 5));
  });
});

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

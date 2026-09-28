import { describe, expect, it } from "vitest";
import { validerLignes } from "../importVehicles";

const ORG = "00000000-0000-0000-0000-000000000001";

describe("validation de l'import de flotte", () => {
  it("accepte des entêtes français avec accents et des synonymes de valeurs", () => {
    const r = validerLignes(
      [
        {
          "Numéro d'unité": "U-101",
          Marque: "Ford",
          Modèle: "F-550",
          Année: "2018",
          Catégorie: "Camionnette",
          Carburant: "Diesel",
          "Km/an": "32 500",
          Consommation: "16,4",
          Usage: "Urbain",
          Département: "Travaux publics",
          Dépôt: "Garage central",
          Statut: "Actif",
        },
      ],
      ORG,
    );
    expect(r.erreurs).toEqual([]);
    expect(r.valides).toHaveLength(1);
    const v = r.valides[0];
    expect(v.unit_number).toBe("U-101");
    expect(v.category).toBe("camionnette");
    expect(v.fuel_type).toBe("diesel");
    expect(v.annual_km).toBe(32500);
    expect(v.consumption_per_100km).toBe(16.4);
    expect(v.usage_profile).toBe("urbain");
    expect(v.organization_id).toBe(ORG);
  });

  it("consommation fournie sans source ⇒ « saisie » ; absente ⇒ « estimation »", () => {
    const r = validerLignes(
      [
        { unite: "A", categorie: "bus", consommation: "140" },
        { unite: "B", categorie: "camion lourd" },
      ],
      ORG,
    );
    expect(r.erreurs).toEqual([]);
    expect(r.valides[0].consumption_source).toBe("saisie");
    expect(r.valides[0].category).toBe("autobus_urbain_12m");
    expect(r.valides[1].consumption_source).toBe("estimation");
    expect(r.valides[1].consumption_per_100km).toBeNull();
  });

  it("rejette ligne par ligne avec le champ et la raison, sans bloquer les lignes valides", () => {
    const r = validerLignes(
      [
        { unite: "OK-1", categorie: "léger" },
        { unite: "", categorie: "léger" }, // unité manquante
        { unite: "KO-2", categorie: "montgolfière" }, // catégorie inconnue
        { unite: "KO-3", categorie: "léger", annee: "1900" }, // année hors bornes
        { unite: "OK-1", categorie: "léger" }, // doublon dans le fichier
      ],
      ORG,
    );
    expect(r.valides.map((v) => v.unit_number)).toEqual(["OK-1"]);
    expect(r.erreurs).toHaveLength(3 + 1);
    expect(r.erreurs.some((e) => e.champ === "categorie" && e.ligne === 3)).toBe(true);
    expect(r.erreurs.some((e) => e.champ === "unit_number" && e.ligne === 5)).toBe(true);
  });

  it("carburants électrique/hydrogène normalisés, statut anglais accepté", () => {
    const r = validerLignes(
      [
        { unit: "E-1", category: "light", carburant: "Électrique", status: "Active" },
        { unit: "H-1", categorie: "camion lourd", carburant: "Hydrogène" },
      ],
      ORG,
    );
    // « light » n'est pas un synonyme connu → erreur explicite
    expect(r.erreurs.some((e) => e.ligne === 1 && e.champ === "categorie")).toBe(true);
    expect(r.valides).toHaveLength(1);
    expect(r.valides[0].fuel_type).toBe("fcev");
  });

  it("ignore les lignes vides et les colonnes inconnues", () => {
    const r = validerLignes(
      [{ "colonne mystère": "x" }, { unite: "Z-9", categorie: "autre", extra: "ignoré" }],
      ORG,
    );
    expect(r.valides).toHaveLength(1);
    expect(r.erreurs).toEqual([]);
  });
});

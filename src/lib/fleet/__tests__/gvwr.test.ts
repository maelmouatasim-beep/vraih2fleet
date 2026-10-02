import { describe, expect, it } from "vitest";
import { classeDepuisKg, lireClassePnbv, proposerClasse } from "../gvwr";
import { validerLignes } from "../importVehicles";
import { construireStrategie, type VehiculeProjet } from "@/lib/journey/strategies";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };

describe("classe de poids PNBV (bloc 2.2)", () => {
  it("lecture : classe, « classe 3 », kg et lb ; seuils aux bornes", () => {
    expect(lireClassePnbv("2b")).toBe("2b");
    expect(lireClassePnbv("Classe 3")).toBe("3");
    expect(lireClassePnbv("class 8")).toBe("8");
    expect(lireClassePnbv("4 200 kg")).toBe("2b");
    expect(lireClassePnbv("9500 lb")).toBe("2b");
    expect(lireClassePnbv("lourd")).toBeNull();
    expect(classeDepuisKg(3855)).toBe("2a");
    expect(classeDepuisKg(3856)).toBe("2b");
    expect(classeDepuisKg(4536)).toBe("3");
    expect(classeDepuisKg(14970)).toBe("8");
  });

  it("proposition à confirmer : F-150 → 2a, F-350 → 3, Corolla (véhicule léger) → 1, camion moyen → aucune", () => {
    expect(proposerClasse({ category: "camionnette", model: "F-150" })).toEqual({ classe: "2a", motif: "modele" });
    expect(proposerClasse({ category: "camionnette", model: "Silverado 3500 HD" })).toEqual({ classe: "3", motif: "modele" });
    expect(proposerClasse({ category: "vehicule_leger", model: "Corolla" })).toEqual({ classe: "1", motif: "categorie" });
    expect(proposerClasse({ category: "camion_moyen", model: "M2 106" })).toBeNull();
  });

  it("import : colonne « classe PNBV » lue, valeur illisible = erreur listant les valeurs acceptées", () => {
    const r = validerLignes(
      [
        { unite: "A", categorie: "camionnette", carburant: "diesel", "Classe PNBV": "classe 3" },
        { unite: "B", categorie: "camionnette", carburant: "diesel", pnbv: "énorme" },
      ],
      "org",
      new Map(),
    );
    expect(r.valides[0].gvwr_class).toBe("3");
    expect(r.erreurs[0].message).toContain("1, 2a, 2b, 3, 4, 5, 6, 7, 8");
  });

  it("le résolveur utilise la classe : F-150 classe 2a en 2027 → aucun barème Écocamionnage, classe 3 → 25 %", () => {
    const f150 = (id: string, gvwr_class: string | null): VehiculeProjet =>
      ({
        id,
        category: "camionnette",
        fuel_type: "diesel",
        annual_km: 20000,
        consumption_per_100km: 16,
        consumption_source: "saisie",
        usage_profile: "urbain",
        replacement_year: 2027,
        target_technology: "bev",
        gvwr_class,
      }) as VehiculeProjet;
    const s = construireStrategie([f150("a", "2a"), f150("b", "3")], "plan_actuel", OPTIONS);
    const eco = (id: string) => s.explicationsSubventions[id].find((e) => e.programmeId === "ecocamionnage_v1")!;
    expect(eco("a").raisons[0]).toEqual({ code: "classe_non_couverte", classe: "2a" });
    expect(eco("b")).toMatchObject({ statut: "retenue", regle: { type: "pourcentage", classes: ["3"] } });
  });
});

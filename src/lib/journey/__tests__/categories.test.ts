import { describe, expect, it } from "vitest";
import { evaluerFaisabiliteVehicule } from "../feasibility";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { validerLignes } from "@/lib/fleet/importVehicles";
import { CATEGORIES_VEHICULE } from "@/lib/fleet/constants";
import { CATEGORIES_MUNICIPALES, categorieMoteur } from "../categories";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };
const v = (id: string, category: string, target: string | null = null): VehiculeProjet =>
  ({
    id,
    category,
    fuel_type: "diesel",
    annual_km: 15000,
    consumption_per_100km: null,
    consumption_source: "estimation",
    usage_profile: "urbain",
    replacement_year: 2027,
    target_technology: target,
  }) as VehiculeProjet;

describe("catégories municipales (bloc 2.3)", () => {
  it("toutes acceptées par la flotte et rattachées à une catégorie du moteur", () => {
    for (const c of CATEGORIES_MUNICIPALES) {
      expect(CATEGORIES_VEHICULE).toContain(c);
      expect(categorieMoteur(c)).not.toBeNull();
    }
  });

  it("camion à benne : chiffré avec les défauts empruntés, signalés « estimation »", () => {
    const f = evaluerFaisabiliteVehicule(v("b", "camion_benne"), OPTIONS);
    expect(f.evaluations).not.toBeNull();
    expect(f.donneesEstimees).toContain("categorie");
  });

  it("déneigeuse : « à reporter », jamais électrifiée par « Tout électrique »", () => {
    const f = evaluerFaisabiliteVehicule(v("d", "deneigeuse"), OPTIONS);
    expect(f).toMatchObject({ evaluations: null, aReporter: "pas_de_ve_credible" });
    const s = construireStrategie([v("d", "deneigeuse"), v("b", "camion_benne")], "tout_electrique", OPTIONS);
    const techno = new Map(s.plan!.vehicules.map((x) => [x.id, x.alternative.technologie]));
    expect(techno.get("d")).toBe("diesel");
    expect(techno.get("b")).toBe("BEV");
    // un choix EXPLICITE du plan reste respecté
    const explicite = construireStrategie([v("d", "deneigeuse", "bev")], "plan_actuel", OPTIONS);
    expect(explicite.plan!.vehicules[0].alternative.technologie).toBe("BEV");
  });

  it("import : synonymes FR/EN reconnus ; catégorie inconnue = erreur listant catégories et synonymes", () => {
    const r = validerLignes(
      [
        { unite: "A", categorie: "Chasse-neige", carburant: "diesel" },
        { unite: "B", category: "Dump truck", carburant: "diesel" },
        { unite: "C", categorie: "Zamboni", carburant: "diesel" },
      ],
      "org",
      new Map(),
    );
    expect(r.valides.map((x) => x.category)).toEqual(["deneigeuse", "camion_benne"]);
    expect(r.erreurs[0].message).toContain("catégories acceptées");
    expect(r.erreurs[0].message).toContain("deneigeuse (chasse_neige");
    expect(r.erreurs[0].message).toContain("dump_truck");
  });
});

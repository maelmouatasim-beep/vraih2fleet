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
        { unite: "A", categorie: "bus", carburant: "diesel", consommation: "140" },
        { unite: "B", categorie: "camion lourd", carburant: "diesel" },
      ],
      ORG,
    );
    expect(r.erreurs).toEqual([]);
    expect(r.valides[0].consumption_source).toBe("import");
    expect(r.valides[0].category).toBe("autobus_urbain_12m");
    expect(r.valides[1].consumption_source).toBe("estimation");
    expect(r.valides[1].consumption_per_100km).toBeNull();
  });

  it("carburant manquant = ERREUR explicite — aucun défaut « diesel » n'est appliqué", () => {
    const r = validerLignes([{ unite: "SANS-FUEL", categorie: "léger" }], ORG);
    expect(r.valides).toEqual([]);
    expect(r.erreurs).toHaveLength(1);
    expect(r.erreurs[0].champ).toBe("carburant");
    expect(r.erreurs[0].message).toContain("carburant manquant");
  });

  it("valeur illisible = ERREUR citant la valeur ; « 12 000 km » avec unité est accepté", () => {
    const r = validerLignes(
      [
        { unite: "KM-1", categorie: "léger", carburant: "essence", "km/an": "12 000 km" },
        { unite: "KM-2", categorie: "léger", carburant: "essence", "km/an": "beaucoup" },
        { unite: "KM-3", categorie: "léger", carburant: "essence", consommation: "45 L/100km" },
        // unité non canonique ou texte collé : jamais lus comme des km
        { unite: "KM-4", categorie: "léger", carburant: "essence", "km/an": "12 000 mi" },
        { unite: "KM-5", categorie: "léger", carburant: "essence", "km/an": "15000 Garage central" },
      ],
      ORG,
    );
    expect(r.valides.map((v) => v.unit_number)).toEqual(["KM-1", "KM-3"]);
    expect(r.valides[0].annual_km).toBe(12000);
    expect(r.valides[1].consumption_per_100km).toBe(45);
    expect(r.erreurs.map((e) => e.ligne)).toEqual([2, 4, 5]);
    expect(r.erreurs).toHaveLength(3);
    expect(r.erreurs[0].message).toContain("« beaucoup »");
    expect(r.erreurs[0].message).toContain("illisible");
  });

  it("dates : numéro de série Excel converti, AAAA/MM/JJ toléré, texte illisible = erreur", () => {
    const r = validerLignes(
      [
        { unite: "D-1", categorie: "léger", carburant: "diesel", "mise en service": "45000" },
        { unite: "D-2", categorie: "léger", carburant: "diesel", "mise en service": "2018/03/05" },
        { unite: "D-3", categorie: "léger", carburant: "diesel", "mise en service": "hier" },
      ],
      ORG,
    );
    expect(r.valides.map((v) => v.unit_number)).toEqual(["D-1", "D-2"]);
    expect(r.valides[0].in_service_date).toBe("2023-03-15"); // série Excel 45000
    expect(r.valides[1].in_service_date).toBe("2018-03-05");
    expect(r.erreurs).toHaveLength(1);
    expect(r.erreurs[0].message).toContain("« hier »");
  });

  it("rejette ligne par ligne avec le champ et la raison, sans bloquer les lignes valides", () => {
    const r = validerLignes(
      [
        { unite: "OK-1", categorie: "léger", carburant: "essence" },
        { unite: "", categorie: "léger", carburant: "essence" }, // unité manquante
        { unite: "KO-2", categorie: "montgolfière", carburant: "essence" }, // catégorie inconnue
        { unite: "KO-3", categorie: "léger", carburant: "essence", annee: "1900" }, // année hors bornes
        { unite: "OK-1", categorie: "léger", carburant: "essence" }, // doublon dans le fichier
      ],
      ORG,
    );
    expect(r.valides.map((v) => v.unit_number)).toEqual(["OK-1"]);
    expect(r.erreurs).toHaveLength(3 + 1);
    expect(r.erreurs.some((e) => e.champ === "catégorie" && e.ligne === 3)).toBe(true);
    expect(r.erreurs.some((e) => e.ligne === 4 && e.message.includes("hors plage"))).toBe(true);
    expect(r.erreurs.some((e) => e.champ === "unité" && e.ligne === 5)).toBe(true);
  });

  it("carburants électrique/hydrogène normalisés, statut anglais accepté", () => {
    const r = validerLignes(
      [
        { unit: "E-1", category: "light", carburant: "Électrique", status: "Active" },
        { unit: "H-1", categorie: "camion lourd", carburant: "Hydrogène" },
      ],
      ORG,
    );
    // « light » n'est pas un synonyme connu → erreur explicite qui cite la valeur
    expect(r.erreurs.some((e) => e.ligne === 1 && e.champ === "catégorie" && e.message.includes("« light »"))).toBe(true);
    expect(r.valides).toHaveLength(1);
    expect(r.valides[0].fuel_type).toBe("fcev");
  });

  it("ignore les lignes vides et les colonnes inconnues", () => {
    const r = validerLignes(
      [{ "colonne mystère": "x" }, { unite: "Z-9", categorie: "autre", carburant: "autre", extra: "ignoré" }],
      ORG,
    );
    expect(r.valides).toHaveLength(1);
    expect(r.erreurs).toEqual([]);
  });

  it("unité existante ⇒ PROPOSITION de mise à jour (jamais un échec), patch = champs fournis seulement", () => {
    const existantes = new Map([["U-200", "veh-id-200"]]);
    const r = validerLignes(
      [
        // mise à jour partielle : ni catégorie ni carburant requis
        { unite: "U-200", "km/an": "41 000", depot: "Garage Est" },
        { unite: "U-201", categorie: "léger", carburant: "essence" },
      ],
      ORG,
      existantes,
    );
    expect(r.erreurs).toEqual([]);
    expect(r.valides.map((v) => v.unit_number)).toEqual(["U-201"]);
    expect(r.misesAJour).toHaveLength(1);
    const m = r.misesAJour[0];
    expect(m.id).toBe("veh-id-200");
    expect(m.unit_number).toBe("U-200");
    expect(m.patch).toEqual({ annual_km: 41000, depot: "Garage Est" });
    // les colonnes absentes n'effacent RIEN (pas de make: null, status…)
    expect("make" in m.patch).toBe(false);
    expect("status" in m.patch).toBe(false);
    expect("fuel_type" in m.patch).toBe(false);
  });

  it("mise à jour avec consommation fournie ⇒ source « saisie » dans le patch", () => {
    const existantes = new Map([["U-300", "veh-id-300"]]);
    const r = validerLignes([{ unite: "U-300", consommation: "22,5" }], ORG, existantes);
    expect(r.erreurs).toEqual([]);
    expect(r.misesAJour[0].patch).toEqual({ consumption_per_100km: 22.5, consumption_source: "import" });
  });
});

describe("audit acheteur, point 2 — un vrai fichier municipal s'importe", () => {
  // Titre FUSIONNÉ sur 6 colonnes (exceljs répète sa valeur dans chaque
  // cellule), sous-titre, ligne vide, entêtes maison, sous-totaux.
  const titre = "Ville de Val-des-Pins — Inventaire du parc au 30 septembre 2026";
  const grille = [
    Array(6).fill(titre),
    ["Préparé par : Service des travaux publics"],
    [],
    ["No", "Description", "Service", "Carburant", "Km 2025", "Conso L/100"],
    ["101", "Pick-up", "Travaux publics", "Ess.", "12,500", "14,2"],
    ["102", "Pick-up", "Travaux publics", "Gaz", "12 500 km", "n/d"],
    ["Sous-total Travaux publics", "", "", "", "", ""],
    ["103", "Camion", "Parcs", "Diesel B5", "n/d", ""],
    ["TOTAL", "", "", "", "", "3 véhicules"],
  ];

  it("entête trouvée sous le titre fusionné, totaux retirés, colonnes maison reconnues", async () => {
    const { detecterEntete, lignesDepuisGrille } = await import("../importVehicles");
    expect(detecterEntete(grille)).toBe(3);
    const { lignes, diagnostic } = lignesDepuisGrille(grille);
    expect(diagnostic).toMatchObject({ ligneEntete: 4, sansUnite: false, lignesTotal: 2 });
    // sans colonne catégorie, « Description » en tient lieu (re-audit)
    expect(diagnostic.reconnues).toEqual(["No", "Description", "Service", "Carburant", "Km 2025", "Conso L/100"]);
    expect(diagnostic.ignorees).toEqual([]);
    expect(lignes).toHaveLength(3);
  });

  it("« Ess. », « Gaz », « Diesel B5 », « n/d », « 12,500 » et « 12 500 km » sont lus sans erreur", async () => {
    const { lignesDepuisGrille } = await import("../importVehicles");
    const lignes = lignesDepuisGrille(grille).lignes.map((l) => ({ ...l, Catégorie: "camionnette" }));
    const r = validerLignes(lignes, ORG);
    expect(r.erreurs).toEqual([]);
    expect(r.valides.map((v) => [v.unit_number, v.fuel_type, v.annual_km, v.consumption_per_100km, v.department])).toEqual([
      ["101", "essence", 12500, 14.2, "Travaux publics"],
      ["102", "essence", 12500, null, "Travaux publics"],
      ["103", "diesel", null, null, "Parcs"],
    ]);
  });

  it("sans colonne d'unité : diagnostic explicite, et les erreurs citent le libellé français", async () => {
    const { lignesDepuisGrille } = await import("../importVehicles");
    const { lignes, diagnostic } = lignesDepuisGrille([["Matricule", "Carburant"], ["A1", "diesel"]]);
    expect(diagnostic.sansUnite).toBe(true);
    expect(validerLignes(lignes, ORG).erreurs[0]).toMatchObject({ champ: "unité" });
  });

  it("la consommation garde sa virgule décimale (« 9,600 » n'est pas un millier)", () => {
    const r = validerLignes([{ Unité: "U-1", Catégorie: "camionnette", Carburant: "diesel", Consommation: "9,600" }], ORG);
    expect(r.valides[0].consumption_per_100km).toBeCloseTo(9.6, 6);
  });
});

describe("re-audit, point 2 — le fichier BRUT du directeur s'importe en mode strict", () => {
  it("« Description » sert de catégorie (libellés usuels), dates « mai 2016 », années « 2015? »", () => {
    const lignes = [
      { No: "101", Description: "Auto compacte", Carburant: "Ess.", Année: "2015?", "Mise en service": "mai 2016" },
      { No: "Unité 102", Description: "Pick-up 1/2 tonne", Carburant: "gaz", Année: 2018, "Mise en service": "sept. 2018" },
      { No: "103", Description: "Camion 10 roues", Carburant: "Diesel B5", "Mise en service": "2019-03-15" },
      { No: "104", Description: "Chasse-neige", Carburant: "Diesel" },
      { No: "105", Description: "Tracteur à trottoir", Carburant: "Diesel" },
      { No: "106", Description: "Autopompe", Carburant: "Diesel" },
      { No: "107", Description: "VUS", Carburant: "Hybride" },
      { No: "108", Description: "Camion 6 roues", Carburant: "Diésel" },
      { No: "109", Description: "Fourgon", Carburant: "Essence" },
      { No: "110", Description: "Balai de rue", Carburant: "Diesel" },
    ];
    const r = validerLignes(lignes, ORG);
    expect(r.erreurs).toEqual([]);
    expect(r.valides.map((v) => v.category)).toEqual([
      "vehicule_leger",
      "camionnette",
      "camion_lourd",
      "deneigeuse",
      "vehicule_specialise",
      "vehicule_urgence",
      "vehicule_leger",
      "camion_moyen",
      "camionnette",
      "vehicule_specialise",
    ]);
    expect(r.valides[0]).toMatchObject({ model_year: 2015, in_service_date: "2016-05-01" });
    expect(r.valides[1].in_service_date).toBe("2018-09-01");
  });

  it("un libellé ambigu n'est jamais deviné : « Minibus adapté » reste à choisir, avec un message clair", () => {
    const r = validerLignes([{ No: "201", Description: "Minibus adapté", Carburant: "Essence" }], ORG);
    expect(r.valides).toHaveLength(0);
    expect(r.erreurs[0].message).toMatch(/catégorie non reconnu\(e\) : « Minibus adapté »/);
  });

  it("une vraie colonne catégorie reste prioritaire sur « Description »", () => {
    const r = validerLignes([{ No: "301", Catégorie: "camion_moyen", Description: "Auto compacte", Carburant: "Diesel" }], ORG);
    expect(r.valides[0].category).toBe("camion_moyen");
  });
});

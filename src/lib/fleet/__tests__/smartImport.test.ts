import { describe, expect, it } from "vitest";
import {
  appliquerCorrespondance,
  changementsImport,
  choisirChamp,
  choisirUnite,
  choisirValeur,
  valeursAAssocier,
  CHAMPS_A_CHOIX,
  CHAMPS_IMPORT,
  colonnesPourIa,
  convertir,
  correspondanceInitiale,
  detecterEntete,
  estColonnePersonnelle,
  fusionnerPropositionIa,
  grilleDepuisPdf,
  tableauDepuisGrille,
  UNITES,
  VALEURS_CIBLES,
  type ElementTextePdf,
  type TableauBrut,
} from "../smartImport";
import * as schema from "../../../../supabase/functions/_shared/importSchema";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ORG = "00000000-0000-0000-0000-000000000001";
const ctx = (extra: Partial<Parameters<typeof appliquerCorrespondance>[2]> = {}) => ({
  organizationId: ORG,
  existants: [],
  garagesExistants: [],
  anneeCourante: 2026,
  ...extra,
});

/** Export « logiciel de gestion de flotte » aux entêtes non standard. */
const exportFlotte = (): TableauBrut =>
  tableauDepuisGrille(
    [
      ["Rapport d'inventaire — généré le 2026-09-30", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["Asset #", "Type équipement", "Énergie", "Odo annuel (mi)", "MPG", "Chauffeur", "Yard", "Yr"],
      ["T-12", "Pickup 3/4 t", "Sans plomb", "12 000", "15", "Jean Tremblay", "garage nord", "2019"],
      ["T-13", "Pickup 3/4 t", "Diesel", "9 500", "18", "Marie Roy", "Garage Nord", "2021"],
      ["T 12", "Chasse-neige", "Diesel", "4 000", "4", "", "Garage Sud", "2015"],
      ["T-14", "Machin", "Bio-truc", "1 000", "20", "", "Garage Sud", "2031"],
    ],
    "csv",
  );

describe("lecture déterministe d'un tableau quelconque", () => {
  it("détecte la ligne d'entête sous un titre de rapport", () => {
    const t = exportFlotte();
    expect(t.entetes[0]).toBe("Asset #");
    expect(t.lignes).toHaveLength(4);
    expect(detecterEntete([["Titre"], ["a", "b", "c"], ["1", "2", "3"]])).toBe(1);
  });

  it("PDF : texte positionné → lignes → colonnes alignées sur l'entête, lignes isolées non devinées", () => {
    const el = (texte: string, x: number, y: number, page = 1): ElementTextePdf => ({ texte, x, y, largeur: texte.length * 5, page });
    const { grille, lignesNonReconnues } = grilleDepuisPdf([
      el("Inventaire 2026", 40, 800),
      el("Unité", 40, 760),
      el("Catégorie", 120, 760),
      el("Carburant", 240, 760),
      el("U-1", 40, 740),
      el("Camion", 120, 740),
      el("lourd", 152, 740), // fragment contigu de la même cellule
      el("Diesel", 240, 740),
      el("Page 1 / 2", 400, 20),
      el("Unité", 40, 760, 2), // entête répétée page 2
      el("Catégorie", 120, 760, 2),
      el("Carburant", 240, 760, 2),
      el("U-2", 40, 740, 2),
      el("Fourgon", 125, 740, 2),
      el("Essence", 245, 740, 2),
    ]);
    expect(grille[0]).toEqual(["Unité", "Catégorie", "Carburant"]);
    expect(grille.slice(1)).toEqual([
      ["U-1", "Camion lourd", "Diesel"],
      ["U-2", "Fourgon", "Essence"],
    ]);
    expect(lignesNonReconnues).toBe(1); // « Page 1 / 2 » : une seule cellule
  });
});

describe("PDF réel (entêtes centrées, 2 pages)", () => {
  it("chaque cellule rattachée à la bonne colonne", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(join(__dirname, "fixtures", "inventaire-centre.pdf")));
    const doc = await pdfjs.getDocument({ data }).promise;
    const elements: ElementTextePdf[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const contenu = await (await doc.getPage(p)).getTextContent();
      for (const item of contenu.items) {
        if (!("str" in item)) continue;
        elements.push({ texte: item.str, x: item.transform[4], y: item.transform[5], largeur: item.width, page: p });
      }
    }
    const { grille } = grilleDepuisPdf(elements);
    const t = tableauDepuisGrille(grille, "pdf");
    expect(t.entetes).toEqual(["Unité", "Catégorie", "Carburant", "Km annuel", "Garage", "Année"]);
    expect(t.lignes).toHaveLength(45);
    expect(t.lignes[0]).toEqual(["P-01", "Camionnette", "Diesel", "15000", "Garage central", "2012"]);
    expect(t.lignes[44]).toEqual(["P-45", "Camionnette", "Diesel", "19400", "Garage central", "2016"]);
  });

  it("entête centrée au-dessus d'une cellule plus large : chevauchement, pas le milieu", () => {
    const el = (texte: string, x: number, largeur: number, y: number): ElementTextePdf => ({ texte, x, y, largeur, page: 1 });
    const { grille } = grilleDepuisPdf([
      el("Km annuel", 144, 42, 700),
      el("Garage", 209, 28, 700),
      el("15000", 150, 22, 680),
      el("Garage central", 190, 55, 680),
    ]);
    expect(grille[1]).toEqual(["15000", "Garage central"]);
  });
});

describe("minimisation (Loi 25) et correspondance", () => {
  it("colonnes personnelles détectées, jamais transmises", () => {
    expect(estColonnePersonnelle("Chauffeur")).toBe(true);
    expect(estColonnePersonnelle("Driver e-mail")).toBe(true);
    expect(estColonnePersonnelle("Téléphone")).toBe(true);
    expect(estColonnePersonnelle("Nom du garage")).toBe(false);
    expect(estColonnePersonnelle("Unit name")).toBe(false);
    const t = exportFlotte();
    const c = correspondanceInitiale(t);
    const envoye = colonnesPourIa(t, c);
    expect(envoye.map((x) => x.entete)).not.toContain("Chauffeur");
    expect(JSON.stringify(envoye)).not.toContain("Tremblay");
    // au plus 3 exemples ; valeurs distinctes seulement si peu nombreuses
    expect(envoye.every((x) => x.exemples.length <= 3)).toBe(true);
    expect(envoye.find((x) => x.entete === "Énergie")?.valeursDistinctes).toEqual(["Sans plomb", "Diesel", "Bio-truc"]);
  });

  it("synonymes connus : sûrs ; inconnus : ignorés et incertains", () => {
    const c = correspondanceInitiale(exportFlotte());
    const par = Object.fromEntries(c.colonnes.map((x) => [x.entete, x]));
    expect(par["Yard"]).toMatchObject({ champ: "depot", certitude: "sure", origine: "synonyme" });
    expect(par["Asset #"]).toMatchObject({ champ: "ignorer", certitude: "incertaine" });
    expect(par["Chauffeur"]).toMatchObject({ champ: "ignorer", personnelle: true });
  });

  it("une colonne « source de consommation » n'est pas proposée (hors modèle intelligent)", () => {
    const c = correspondanceInitiale(tableauDepuisGrille([["Unité", "Source consommation"], ["U-1", "saisie"]], "csv"));
    expect(c.colonnes[1].champ).toBe("ignorer");
  });

  it("fusion de la proposition IA : jamais sur une colonne personnelle ni au-dessus de l'utilisateur ; un champ par colonne ; cibles hors liste vidées", () => {
    const t = exportFlotte();
    const base = correspondanceInitiale(t);
    base.colonnes[7] = { ...base.colonnes[7], champ: "ignorer", certitude: "sure", origine: "utilisateur" }; // « Yr » refusé par l'utilisateur
    const f = fusionnerPropositionIa(base, {
      colonnes: [
        { entete: "Asset #", champ: "unit_number", certitude: "sure", unite: "" },
        { entete: "Type équipement", champ: "category", certitude: "probable", unite: "" },
        { entete: "Énergie", champ: "fuel_type", certitude: "sure", unite: "" },
        { entete: "Odo annuel (mi)", champ: "annual_km", certitude: "sure", unite: "mi" },
        { entete: "MPG", champ: "consumption_per_100km", certitude: "probable", unite: "mpg_us" },
        { entete: "Chauffeur", champ: "notes", certitude: "sure", unite: "" },
        { entete: "Yard", champ: "department", certitude: "probable", unite: "" },
        { entete: "Yr", champ: "model_year", certitude: "sure", unite: "" },
      ],
      valeurs: [
        { champ: "category", source: "Pickup 3/4 t", cible: "camionnette", certitude: "probable" },
        { champ: "category", source: "Chasse-neige", cible: "deneigeuse", certitude: "sure" },
        { champ: "category", source: "Machin", cible: "super_camion", certitude: "sure" },
        { champ: "fuel_type", source: "Sans plomb", cible: "essence", certitude: "sure" },
        { champ: "fuel_type", source: "Bio-truc", cible: "", certitude: "incertaine" },
      ],
    });
    const par = Object.fromEntries(f.colonnes.map((x) => [x.entete, x]));
    expect(par["Asset #"]).toMatchObject({ champ: "unit_number", origine: "ia" });
    expect(par["Chauffeur"].champ).toBe("ignorer"); // personnelle : intouchable
    expect(par["Yr"]).toMatchObject({ champ: "ignorer", origine: "utilisateur" });
    expect(par["Yard"].champ).toBe("depot"); // synonyme sûr non remplacé par du « probable »
    expect(par["MPG"].unite).toBe("mpg_us");
    expect(f.valeurs.find((v) => v.source === "Machin")?.cible).toBe("");

    // deux colonnes proposées pour le même champ : la plus sûre l'emporte
    const g = fusionnerPropositionIa(correspondanceInitiale(t), {
      colonnes: [
        { entete: "Asset #", champ: "unit_number", certitude: "probable", unite: "" },
        { entete: "Type équipement", champ: "unit_number", certitude: "sure", unite: "" },
      ],
      valeurs: [],
    });
    expect(g.colonnes.filter((x) => x.champ === "unit_number").map((x) => x.entete)).toEqual(["Type équipement"]);
  });
});

describe("conversions d'unités exactes", () => {
  it("milles, mpg US/impérial, km/L", () => {
    expect(convertir(10_000, "mi", "annual_km")).toBe(16093.44);
    expect(convertir(100, "km", "annual_km")).toBe(100);
    expect(convertir(20, "mpg_us", "consumption_per_100km")).toBe(11.76);
    expect(convertir(20, "mpg_imp", "consumption_per_100km")).toBe(14.12);
    expect(convertir(5, "km/L", "consumption_per_100km")).toBe(20);
    expect(convertir(0, "mpg_us", "consumption_per_100km")).toBe(0);
    expect(convertir(12, undefined, "consumption_per_100km")).toBe(12);
  });
});

describe("application de la correspondance et tableau de validation", () => {
  const correspondanceComplete = (t: TableauBrut) =>
    fusionnerPropositionIa(correspondanceInitiale(t), {
      colonnes: [
        { entete: "Asset #", champ: "unit_number", certitude: "sure", unite: "" },
        { entete: "Type équipement", champ: "category", certitude: "sure", unite: "" },
        { entete: "Énergie", champ: "fuel_type", certitude: "sure", unite: "" },
        { entete: "Odo annuel (mi)", champ: "annual_km", certitude: "sure", unite: "mi" },
        { entete: "MPG", champ: "consumption_per_100km", certitude: "sure", unite: "mpg_us" },
        { entete: "Yr", champ: "model_year", certitude: "sure", unite: "" },
      ],
      valeurs: [
        { champ: "category", source: "Pickup 3/4 t", cible: "camionnette", certitude: "sure" },
        { champ: "category", source: "Chasse-neige", cible: "deneigeuse", certitude: "sure" },
        { champ: "category", source: "Machin", cible: "", certitude: "incertaine" },
        { champ: "fuel_type", source: "Sans plomb", cible: "essence", certitude: "sure" },
        { champ: "fuel_type", source: "Bio-truc", cible: "", certitude: "incertaine" },
      ],
    });

  it("valeurs du FICHIER seulement, converties ; champ incertain laissé vide et signalé", () => {
    const t = exportFlotte();
    const r = appliquerCorrespondance(t, correspondanceComplete(t), ctx({ garagesExistants: ["Garage Nord"] }));
    const [l1, l2, l3, l4] = r.lignes;
    expect(l1).toMatchObject({ unite: "T-12", statut: "nouveau" });
    expect(l1.valeurs).toMatchObject({ category: "camionnette", fuel_type: "essence", annual_km: "19312.13", consumption_per_100km: "15.68", depot: "Garage Nord", model_year: "2019" });
    expect(r.import.valides[0]).toMatchObject({ unit_number: "T-12", annual_km: 19312.13, depot: "Garage Nord" });
    // garage existant reconnu malgré la casse ; nouveau garage signalé
    expect(l2.valeurs.depot).toBe("Garage Nord");
    expect(r.garagesNouveaux).toEqual(["Garage Sud"]);
    // libellés incertains : champ VIDE ⇒ erreur « manquant » (jamais deviné)
    expect(l4.valeurs.category).toBeUndefined();
    expect(l4.valeurs.fuel_type).toBeUndefined();
    expect(l4.signalements).toEqual(
      expect.arrayContaining([
        { code: "valeur_incertaine", champ: "category", valeur: "Machin" },
        { code: "valeur_incertaine", champ: "fuel_type", valeur: "Bio-truc" },
        { code: "annee_future", annee: 2031 },
      ]),
    );
    expect(l4.statut).toBe("erreur");
    // doublon probable : « T 12 » ≈ « T-12 »
    expect(l3.signalements).toContainEqual({ code: "doublon_probable", avec: "T-12" });
    expect(l3.statut).toBe("exclue");
    // colonne personnelle et conversions signalées globalement
    expect(r.signalementsGlobaux).toEqual(
      expect.arrayContaining([
        { code: "colonne_personnelle", entete: "Chauffeur" },
        { code: "unite_convertie", champ: "annual_km", unite: "mi" },
        { code: "unite_convertie", champ: "consumption_per_100km", unite: "mpg_us" },
      ]),
    );
    // aucune valeur de la colonne personnelle dans le résultat
    expect(JSON.stringify(r)).not.toContain("Tremblay");
  });

  it("colonne incertaine : non importée ; correction de l'utilisateur appliquée à la ligne", () => {
    const t = exportFlotte();
    const c = correspondanceComplete(t);
    const r = appliquerCorrespondance(t, c, ctx({ surcharges: { 4: { category: "camion_lourd", fuel_type: "diesel", model_year: "2021" } } }));
    expect(r.lignes[3].statut).toBe("nouveau");
    expect(r.lignes[3].valeurs).toMatchObject({ category: "camion_lourd", fuel_type: "diesel" });
    const sans = appliquerCorrespondance(t, { ...c, colonnes: c.colonnes.map((x) => (x.entete === "MPG" ? { ...x, certitude: "incertaine" as const } : x)) }, ctx());
    expect(sans.lignes[0].valeurs.consumption_per_100km).toBeUndefined();
  });

  it("unité existante ⇒ mise à jour ; NIV en double ; incohérences km, conso et mise en service", () => {
    const t = tableauDepuisGrille(
      [
        ["Unité", "NIV", "Catégorie", "Carburant", "Km/an", "Km jour max", "Consommation", "Année", "Mise en service"],
        ["U-1", "1FT000", "camionnette", "diesel", "40000", "50", "60", "2020", "2018-05-01"],
        ["U-2", "1ft000", "camionnette", "diesel", "10000", "100", "15", "2020", "2020-05-01"],
      ],
      "xlsx",
    );
    const r = appliquerCorrespondance(t, correspondanceInitiale(t), ctx({ existants: [{ id: "id-1", unit_number: "U-1", vin: null }] }));
    expect(r.lignes[0].statut).toBe("mise_a_jour");
    expect(r.import.misesAJour[0].id).toBe("id-1");
    expect(r.lignes[0].signalements).toEqual(
      expect.arrayContaining([
        { code: "km_incoherents", kmAn: 40000, kmJourMax: 50 },
        { code: "conso_a_verifier", conso: 60, reference: 15 },
        { code: "mise_en_service_avant_modele", annee: 2018, modele: 2020 },
      ]),
    );
    expect(r.lignes[1].signalements).toContainEqual({ code: "niv_double", avec: "U-1" });
    // doublon : exclu par défaut, réintégrable par l'utilisateur
    expect(r.lignes[1].statut).toBe("exclue");
    expect(r.import.valides).toHaveLength(0);
    const repris = appliquerCorrespondance(t, correspondanceInitiale(t), ctx({ existants: [{ id: "id-1", unit_number: "U-1", vin: null }], choixLignes: { 2: true, 1: false } }));
    expect(repris.lignes.map((l) => l.statut)).toEqual(["exclue", "nouveau"]);
    expect(repris.import.valides.map((v) => v.unit_number)).toEqual(["U-2"]);
    expect(repris.import.misesAJour).toHaveLength(0);
  });

  it("valeurs déjà reconnues par les synonymes : aucune aide de l'IA nécessaire", () => {
    const t = tableauDepuisGrille([["Unité", "Catégorie", "Carburant", "Classe PNBV"], ["U-9", "Autobus", "Électrique", "Classe 8"]], "csv");
    const r = appliquerCorrespondance(t, correspondanceInitiale(t), ctx());
    expect(r.lignes[0]).toMatchObject({ statut: "nouveau", signalements: [] });
    expect(r.import.valides[0]).toMatchObject({ fuel_type: "bev", gvwr_class: "8" });
  });
});

describe("corrections de l'utilisateur", () => {
  it("un champ par colonne, colonne personnelle intouchable, libellés à associer", () => {
    const t = exportFlotte();
    let c = correspondanceInitiale(t);
    c = choisirChamp(c, 0, "unit_number");
    c = choisirChamp(c, 2, "fuel_type");
    c = choisirChamp(c, 3, "annual_km");
    c = choisirUnite(c, 3, "mi");
    c = choisirChamp(c, 5, "notes"); // « Chauffeur » : personnelle, refusé
    expect(c.colonnes[5]).toMatchObject({ champ: "ignorer", personnelle: true });
    c = choisirChamp(c, 1, "unit_number"); // libère la colonne 0
    expect(c.colonnes[0]).toMatchObject({ champ: "ignorer", origine: "utilisateur" });
    expect(c.colonnes[1]).toMatchObject({ champ: "unit_number", certitude: "sure", origine: "utilisateur" });
    expect(c.colonnes[3].unite).toBe("mi");
    expect(choisirChamp(c, 3, "make").colonnes[3].unite).toBeUndefined();
    // « Diesel » reconnu par synonyme ; « Sans plomb » et « Bio-truc » à associer
    expect(valeursAAssocier(t, c).map((v) => v.source)).toEqual(["Sans plomb", "Bio-truc"]);
    c = choisirValeur(c, "fuel_type", "Sans plomb", "essence");
    c = choisirValeur(c, "fuel_type", "Bio-truc", "kerosene"); // hors liste ⇒ vide
    expect(valeursAAssocier(t, c)).toEqual([
      { champ: "fuel_type", source: "Sans plomb", cible: "essence", certitude: "sure", origine: "utilisateur" },
      { champ: "fuel_type", source: "Bio-truc", cible: "", certitude: "incertaine", origine: "utilisateur" },
    ]);
  });
});

describe("aperçu avant → après (et journal)", () => {
  it("création listée ; mise à jour = champs réellement modifiés seulement", () => {
    const t = tableauDepuisGrille(
      [
        ["Unité", "Catégorie", "Carburant", "Km/an", "Garage"],
        ["U-1", "camionnette", "diesel", "30000", "Garage Nord"],
        ["U-2", "camion lourd", "diesel", "", ""],
      ],
      "csv",
    );
    const existants = [{ id: "id-1", unit_number: "U-1", vin: null, category: "camionnette", fuel_type: "diesel", annual_km: 25000, depot: "Garage Nord" }];
    const r = appliquerCorrespondance(t, correspondanceInitiale(t), ctx({ existants, garagesExistants: ["Garage Nord"] }));
    expect(changementsImport(r.import, existants)).toEqual([
      { cible: "U-2", champ: "vehicule", avant: null, apres: "camion_lourd · diesel" },
      { cible: "U-1", champ: "annual_km", avant: 25000, apres: 30000 },
    ]);
  });
});

describe("schéma partagé avec la fonction Edge fleet-import", () => {
  it("identique aux constantes de l'application", () => {
    expect([...schema.CHAMPS]).toEqual([...CHAMPS_IMPORT]);
    expect([...schema.CHAMPS_A_CHOIX]).toEqual([...CHAMPS_A_CHOIX]);
    expect([...schema.UNITES]).toEqual([...UNITES]);
    for (const champ of CHAMPS_A_CHOIX) expect([...schema.VALEURS[champ]]).toEqual([...VALEURS_CIBLES[champ]]);
  });
});

describe("re-audit, point 2 — « Description » proposée comme catégorie", () => {
  it("sans colonne catégorie, la colonne « Description » est associée à la catégorie (probable)", () => {
    const t = tableauDepuisGrille([["No", "Description", "Carburant"], ["101", "Auto compacte", "Gaz"]], "xlsx");
    const c = correspondanceInitiale(t);
    expect(c.colonnes.find((x) => x.entete === "Description")).toMatchObject({ champ: "category", certitude: "probable" });
    const r = appliquerCorrespondance(t, c, { organizationId: "org", existants: [], garagesExistants: [], anneeCourante: 2026 });
    expect(r.import.valides[0]).toMatchObject({ category: "vehicule_leger", fuel_type: "essence" });
  });
});


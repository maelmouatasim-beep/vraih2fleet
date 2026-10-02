import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { exportInventaireDemo } from "../exportDemo";
import { genererFlotteDemo } from "../villeDemo";
import { appliquerCorrespondance, correspondanceInitiale, tableauDepuisGrille } from "@/lib/fleet/smartImport";

describe("export fictif de la démo pour l'import intelligent", () => {
  const grille = Papa.parse<string[]>(exportInventaireDemo(), { header: false, skipEmptyLines: true }).data;
  const t = tableauDepuisGrille(grille, "csv");
  const flotte = genererFlotteDemo().map((v, i) => ({ id: `id-${i}`, unit_number: v.unit_number, vin: null }));

  it("déterministe, entête détectée sous le titre, colonne personnelle exclue", () => {
    expect(exportInventaireDemo()).toBe(exportInventaireDemo());
    expect(t.entetes[0]).toBe("No équipement");
    expect(t.lignes).toHaveLength(5);
    const c = correspondanceInitiale(t);
    expect(c.colonnes.find((x) => x.entete === "Opérateur attitré")?.personnelle).toBe(true);
  });

  it("montre chaque cas : mise à jour d'une unité de la démo, doublon exclu, année future", () => {
    const c = correspondanceInitiale(t);
    // sans IA, l'utilisateur associe au minimum l'unité
    c.colonnes[0] = { ...c.colonnes[0], champ: "unit_number", certitude: "sure", origine: "utilisateur" };
    const r = appliquerCorrespondance(t, c, { organizationId: "org", existants: flotte, garagesExistants: ["Garage central", "Dépôt Nord"], anneeCourante: 2026 });
    expect(r.lignes.map((l) => l.statut)).toEqual(["mise_a_jour", "erreur", "erreur", "erreur", "exclue"]);
    expect(r.lignes[4].signalements).toContainEqual({ code: "doublon_probable", avec: "C-01" });
  });
});

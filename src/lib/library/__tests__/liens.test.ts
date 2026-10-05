import { describe, expect, it } from "vitest";
import { DEFAUTS_CATEGORIES, HYPOTHESES } from "@/lib/tco";
import { POSTES_VAN } from "@/lib/journey/synthese";
import {
  HYPOTHESES_PAR_POSTE,
  hypothesesRaccordement,
  lienCategorie,
  lienHypotheses,
  lienPoste,
  lireCibleBibliotheque,
  sourcesCategorie,
} from "../liens";

const requete = (lien: string) => lien.slice(lien.indexOf("?"));

describe("liens chiffre → Bibliothèque", () => {
  it("chaque poste de la VAN mène à une page de la Bibliothèque qui le nourrit", () => {
    for (const poste of POSTES_VAN) {
      const cible = lireCibleBibliotheque(requete(lienPoste(poste)));
      if (poste === "achat") expect(cible).toMatchObject({ onglet: "categories", colonne: "prix" });
      else if (poste === "entretien") expect(cible).toMatchObject({ onglet: "categories", colonne: "entretien" });
      else if (poste === "subventions") expect(cible.onglet).toBe("programmes");
      else {
        expect(cible.onglet).toBe("hypotheses");
        expect(cible.ids).toEqual(HYPOTHESES_PAR_POSTE[poste]);
      }
    }
  });

  it("toutes les hypothèses citées existent dans le registre", () => {
    for (const ids of Object.values(HYPOTHESES_PAR_POSTE)) for (const id of ids) expect(HYPOTHESES).toHaveProperty(id);
    for (const palier of [0, 1, 2, 3]) for (const id of hypothesesRaccordement(palier, true)) expect(HYPOTHESES).toHaveProperty(id);
  });

  it("aller-retour : le lien construit se relit à l'identique ; l'inconnu est ignoré", () => {
    expect(lireCibleBibliotheque(requete(lienHypotheses(["prix_diesel", "inconnue", "prix_diesel"])))).toEqual({
      onglet: "hypotheses",
      ids: ["prix_diesel"],
      categorie: null,
      colonne: null,
    });
    expect(lireCibleBibliotheque(requete(lienCategorie("autobus_urbain_12m", "prix")))).toEqual({
      onglet: "categories",
      ids: [],
      categorie: "autobus_urbain_12m",
      colonne: "prix",
    });
    expect(lireCibleBibliotheque("?onglet=pirate&cat=fusee&col=x")).toEqual({ onglet: "categories", ids: [], categorie: null, colonne: null });
    expect(lireCibleBibliotheque("")).toEqual({ onglet: "hypotheses", ids: [], categorie: null, colonne: null });
    expect(lienHypotheses(["inconnue"])).toBe("/dashboard/library");
  });

  it("raccordement : palier retenu, ou montant forfaitaire ; puissance présumée signalée", () => {
    expect(hypothesesRaccordement(2, false)[0]).toBe("raccordement_palier2");
    expect(hypothesesRaccordement(0, false)).toEqual(["raccordement_depot"]);
    expect(hypothesesRaccordement(1, true)).toContain("puissance_disponible_garage_presumee");
  });

  it("sources des catégories : texte lisible + URL cliquable, statut à valider repéré", () => {
    for (const cat of Object.keys(DEFAUTS_CATEGORIES) as (keyof typeof DEFAUTS_CATEGORIES)[]) {
      for (const s of sourcesCategorie(cat)) {
        expect(s.texte).not.toMatch(/https?:|à_valider/);
        expect(s.texte.length).toBeGreaterThan(3);
        if (s.url) expect(s.url).toMatch(/^https:\/\/[^\s)]+$/);
      }
    }
    const bus = sourcesCategorie("autobus_urbain_12m");
    expect(bus.some((s) => s.url?.includes("newswire.ca") && s.aValider && s.texte.startsWith("Prix BEV"))).toBe(true);
  });
});

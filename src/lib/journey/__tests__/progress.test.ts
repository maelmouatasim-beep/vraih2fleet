import { describe, expect, it } from "vitest";
import { etatDuParcours, type DonneesParcours } from "../progress";

const base: DonneesParcours = {
  nbVehicules: 12,
  nbSansAnnee: 0,
  nbSansCible: 0,
  strategieAppliquee: true,
  nbZeroEmission: 3,
  programmesPrevus: ["ecocamionnage_v1", "ecocamionnage_v1"],
  programmesDemandes: ["ecocamionnage_v1"],
  rapportGenere: true,
  rapportAJour: true,
  nbRealises: 3,
};

describe("état réel des 7 étapes (bloc 3.2)", () => {
  it("projet complet : tout terminé, rien ne manque", () => {
    const e = etatDuParcours(base);
    for (const etape of Object.values(e)) expect(etape).toEqual({ etat: "termine", manques: [] });
  });

  it("projet vide : tout à faire, avec ce qui manque", () => {
    const e = etatDuParcours({
      ...base,
      nbVehicules: 0,
      nbZeroEmission: 0,
      strategieAppliquee: false,
      programmesPrevus: [],
      programmesDemandes: [],
      rapportGenere: false,
      rapportAJour: null,
      nbRealises: 0,
    });
    expect(e.flotte).toEqual({ etat: "a_faire", manques: [{ cle: "aucunVehicule" }] });
    expect(e.strategies.manques).toEqual([{ cle: "aucunVehicule" }]);
    expect(e.plan.manques).toEqual([{ cle: "planVide" }]);
    expect(e.rapports.manques).toEqual([{ cle: "aucunRapport" }]);
  });

  it("en cours : années manquantes, cibles partielles, demande manquante, rapport périmé, remplacements restants", () => {
    const e = etatDuParcours({
      ...base,
      nbSansAnnee: 2,
      nbSansCible: 4,
      programmesPrevus: ["ecocamionnage_v1", "pave"],
      rapportAJour: false,
      nbRealises: 1,
    });
    expect(e.flotte).toEqual({ etat: "en_cours", manques: [{ cle: "sansAnnee", count: 2 }] });
    expect(e.faisabilite).toEqual({ etat: "en_cours", manques: [{ cle: "sansCible", count: 4 }] });
    expect(e.financement).toEqual({ etat: "en_cours", manques: [{ cle: "demandesManquantes", count: 1 }] });
    expect(e.rapports).toEqual({ etat: "en_cours", manques: [{ cle: "rapportPerime" }] });
    expect(e.suivi).toEqual({ etat: "en_cours", manques: [{ cle: "remplacementsRestants", count: 2 }] });
  });

  it("l'état ne dépend PAS de l'étape affichée : stratégie non appliquée = à faire même si le plan existe", () => {
    expect(etatDuParcours({ ...base, strategieAppliquee: false }).strategies).toEqual({
      etat: "a_faire",
      manques: [{ cle: "aucuneStrategie" }],
    });
  });
});

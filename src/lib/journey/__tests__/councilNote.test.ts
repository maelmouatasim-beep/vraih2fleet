import { describe, expect, it } from "vitest";
import { analyserSensibilite } from "@/lib/tco";
import { verifierBrouillon } from "../../../../supabase/functions/_shared/councilNote";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { brouillonModele, faitsNote, faitsTransmis, rendreSections, rendreTexte, verifierNote, SECTIONS_NOTE } from "../councilNote";
import { diagnostiquerHiver } from "../winter";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };

function vehicule(patch: Partial<VehiculeProjet> = {}): VehiculeProjet {
  return {
    id: patch.id ?? "v1",
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 30000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    replacement_year: 2027,
    target_technology: "bev",
    ...patch,
  };
}

function faits(vehicules: VehiculeProjet[]) {
  const strategie = construireStrategie(vehicules, "plan_actuel", OPTIONS);
  return {
    strategie,
    faits: faitsNote({
      organisation: "Ville de Rivière-Claire",
      projet: "Transition 2027-2036",
      dateIso: "2026-10-03",
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
      strategie,
      retenue: { cle: "plan_actuel", ecarts: 0 },
      sensibilite: analyserSensibilite(strategie.plan!),
      hiver: vehicules.map((v) => diagnostiquerHiver({ category: v.category, annual_km: v.annual_km })),
    }),
  };
}

describe("note au conseil", () => {
  it("les faits viennent du résultat du moteur (VAN, coûts, subventions), jamais recalculés", () => {
    const { strategie, faits: f } = faits([vehicule(), vehicule({ id: "v2", replacement_year: 2028 })]);
    const v = (id: string) => f.find((x) => x.id === id)!;
    expect(v("van_centrale").valeur).toBe(strategie.resultat!.vanDifferentielle);
    expect(v("tco_plan").valeur).toBe(strategie.resultat!.alternative.tcoActualise);
    expect(v("subventions_total").valeur).toBe(strategie.subventionsTotal);
    expect(v("nb_scenarios").valeur).toBe(3);
    expect(v("premiere_annee_achat").valeur).toBe(2027);
    expect(v("van_centrale").rendu.fr).toMatch(/\$$/);
    expect(v("van_centrale").rendu.en).toMatch(/^-?\$/);
    // identifiants uniques, acceptés par la fonction Edge
    const ids = f.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]{1,40}$/);
    expect(faitsTransmis(f, "en").find((x) => x.id === "horizon_ans")?.valeur).toBe("10 years");
  });

  it("le modèle (sans IA) n'écrit aucun chiffre hors jeton, dans les deux langues, et rendu il passe la vérification", () => {
    for (const vehicules of [[vehicule()], [vehicule({ annual_km: 2000 })]]) {
      const { faits: f } = faits(vehicules);
      const ids = new Set(f.map((x) => x.id));
      for (const langue of ["fr", "en"] as const) {
        const gabarit = brouillonModele(f, langue);
        expect(verifierBrouillon(gabarit, ids)).toEqual([]);
        const rendu = rendreSections(gabarit, f, langue);
        const verif = verifierNote(rendu, f, langue);
        expect(verif.nonVerifies).toEqual([]);
        expect(verif.ok).toBe(true);
        for (const s of SECTIONS_NOTE) expect(rendu[s]).not.toMatch(/\{\{/);
      }
    }
  });

  it("la recommandation suit le résultat : surcoût → ne pas adopter tel quel", () => {
    const { faits: f } = faits([vehicule({ annual_km: 2000, consumption_per_100km: 8 })]);
    const van = Number(f.find((x) => x.id === "van_centrale")!.valeur);
    const reco = brouillonModele(f, "fr").recommandation;
    if (van <= 0) expect(reco).toMatch(/ne pas adopter le plan tel quel/);
    else expect(reco).toMatch(/adopte le plan/);
  });

  it("édition : un nombre absent des faits bloque l'export et est signalé", () => {
    const { faits: f } = faits([vehicule()]);
    const rendu = rendreSections(brouillonModele(f, "fr"), f, "fr");
    const edite = { ...rendu, couts: `${rendu.couts} Le gain atteindrait 987 654 $ par an.` };
    const verif = verifierNote(edite, f, "fr");
    expect(verif.ok).toBe(false);
    expect(verif.nonVerifies).toEqual([{ section: "couts", nombres: ["987 654"] }]);
    // un jeton inconnu reste visible et bloque aussi
    expect(verifierNote({ ...rendu, hiver: rendreTexte("Voir {{inconnu}}.", f, "fr") }, f, "fr").jetonsRestants).toEqual(["{{inconnu}}"]);
  });
});

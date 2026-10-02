import { describe, expect, it } from "vitest";
import { executerOutil, contexteCopilote, OUTILS_IMPLEMENTES, type PropositionCopilote, type SnapshotProjet } from "../outils";
import { NOMS_OUTILS } from "../../../../supabase/functions/_shared/copilotTools";
import { verifierNombres } from "../../../../supabase/functions/_shared/numberCheck";
import { construireStrategie, type VehiculeProjet } from "@/lib/journey/strategies";
import { optimiserCalendrier } from "@/lib/journey/optimizer";

const OPTIONS = { anneeReference: 2026, horizonAns: 12, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };

const v = (p: Partial<VehiculeProjet> & { id: string }): VehiculeProjet => ({
  unit_number: p.id.toUpperCase(),
  category: "camionnette",
  fuel_type: "diesel",
  annual_km: 32000,
  consumption_per_100km: 17,
  consumption_source: "saisie",
  usage_profile: "urbain",
  replacement_year: 2027,
  target_technology: "bev",
  depot: "Nord",
  ...p,
});

const SNAP: SnapshotProjet = {
  projet: { id: "p", nom: "Démo", horizonAns: 12, anneeReference: 2026, tauxActualisation: 0.05 },
  strategieRetenue: null,
  vehicules: [
    v({ id: "c-01" }),
    v({ id: "c-02", replacement_year: 2028, annual_km: 28000 }),
    v({ id: "b-01", category: "autobus_urbain_12m", annual_km: 50000, consumption_per_100km: 45, depot: "Sud", replacement_year: 2029 }),
  ],
  options: OPTIONS,
  contraintes: null,
  assignation: null,
  taches: [{ titre: "Demande Écocamionnage", statut: "todo", echeance: "2027-03-01", annee: 2027 }],
  aujourdhui: "2026-10-03",
};

const lancer = (nom: string, entree: unknown, props = new Map<string, PropositionCopilote>()) => {
  const r = executerOutil(nom, entree, SNAP, props);
  return { ...r, json: JSON.parse(r.contenu), props };
};

describe("copilote : outils exécutés avec le moteur (Phase 5.2)", () => {
  it("chaque outil déclaré à Claude est implémenté côté navigateur", () => {
    expect([...NOMS_OUTILS].sort()).toEqual([...OUTILS_IMPLEMENTES].sort());
  });

  it("lire_projet : chiffres = moteur, avec leur source ; aucune donnée superflue", () => {
    const { json, erreur } = lancer("lire_projet", { sections: ["resume", "flotte", "garages", "plan", "subventions", "taches"] });
    expect(erreur).toBe(false);
    const plan = construireStrategie(SNAP.vehicules, "plan_actuel", OPTIONS);
    expect(json.resume.plan.economie_van).toBe(Math.round(plan.resultat!.vanDifferentielle));
    expect(json.resume.source).toMatch(/moteur TCO/);
    expect(json.garages.infrastructure_totale).toBe(Math.round(plan.infra.totalCapex));
    for (const ligne of json.flotte.vehicules) {
      expect(Object.keys(ligne)).not.toContain("vin");
      expect(Object.keys(ligne)).not.toContain("notes");
    }
  });

  it("simuler : diesel −20 % recalculé par le moteur, sans proposition (les prix ne modifient pas le plan)", () => {
    const { json, props } = lancer("simuler", { prix: { carburants_pct: -20 } });
    expect(json.plan_simule.economie_van).toBeLessThan(json.plan_actuel.economie_van);
    expect(json.ecarts.economie_van).toBe(json.plan_simule.economie_van - json.plan_actuel.economie_van);
    expect(json.proposition).toBeNull();
    expect(props.size).toBe(0);
  });

  it("simuler : report des autobus → proposition avant → après, stress test en 3 scénarios", () => {
    const { json, props } = lancer("simuler", { decaler: { categories: ["autobus_urbain_12m"], ans: 2 }, stress_test: true });
    expect(json.proposition.vehicules_modifies).toBe(1);
    const p = props.get(json.proposition.id)!;
    expect(p.changements[0]).toMatchObject({ unite: "B-01", anneeAvant: 2029, anneeApres: 2031 });
    expect(json.stress_test.scenarios_total).toBe(3);
    expect(json.stress_test.scenarios_gagnants).toBeGreaterThanOrEqual(0);
  });

  it("optimiser : mêmes chiffres que l'optimiseur, proposition « optimisee »", () => {
    const { json, props } = lancer("optimiser", { budget_investissement_annuel: 500000, report_max_ans: 3 });
    const direct = optimiserCalendrier({
      vehicules: SNAP.vehicules,
      options: OPTIONS,
      contraintes: { budgetInvestissementAnnuel: 500000, reportMaxAns: 3 },
    });
    expect(json.resultat.economie_van).toBe(Math.round(direct.strategie!.resultat!.vanDifferentielle));
    expect(json.realisable).toBe(direct.realisable);
    if (json.proposition) expect(props.get(json.proposition.id)!.type).toBe("optimisee");
  });

  it("hypothèses et programmes : valeur, statut, date et source", () => {
    const h = lancer("consulter_hypotheses", { recherche: "diesel" }).json.hypotheses;
    expect(h.length).toBeGreaterThan(0);
    expect(h[0].source).toMatch(/vérifié le \d{4}-\d{2}-\d{2}/);
    const p = lancer("consulter_programmes", {}).json.programmes;
    expect(p.some((x: { statut: string }) => x.statut === "ferme")).toBe(true);
  });

  it("entrée invalide : erreur renvoyée à Claude, rien n'est inventé", () => {
    expect(lancer("simuler", { prix: { carburants_pct: "beaucoup" } }).erreur).toBe(true);
    expect(lancer("outil_inconnu", {}).erreur).toBe(true);
  });

  it("une réponse composée des chiffres des outils passe la vérification ; un chiffre recalculé non", () => {
    const { contenu, json } = lancer("simuler", { prix: { carburants_pct: -20 } });
    const fr = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 });
    const texte = `Avec le diesel à −20 %, l'économie passe de ${fr.format(json.plan_actuel.economie_van)} $ à ${fr.format(json.plan_simule.economie_van)} $ (source : étape Plan).`;
    expect(verifierNombres(texte, "fr", contexteCopilote(SNAP), "Et si le diesel baisse de 20 % ?", contenu).ok).toBe(true);
    const invente = `L'économie double : ${fr.format(json.plan_actuel.economie_van * 2)} $.`;
    expect(verifierNombres(invente, "fr", contexteCopilote(SNAP), contenu).ok).toBe(false);
  });
});

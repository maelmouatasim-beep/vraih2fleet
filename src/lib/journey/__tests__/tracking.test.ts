import { describe, expect, it } from "vitest";
import { etatRemplacement, tachesDuPlan, type VehiculeSuivi } from "../tracking";

const OPTIONS = {
  anneeReference: 2026,
  horizonAns: 10,
  tauxActualisationNominal: 0.05,
  typeOrganisme: "municipalite" as const,
};

function vehicule(patch: Partial<VehiculeSuivi> = {}): VehiculeSuivi {
  return {
    id: "v1",
    unit_number: "U-101",
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 30000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    model_year: 2018,
    replacement_year: 2028,
    target_technology: "bev",
    ...patch,
  };
}

describe("etatRemplacement", () => {
  it("réalisé quand la technologie actuelle correspond à la cible zéro émission", () => {
    expect(etatRemplacement(vehicule({ fuel_type: "bev" }), 2026)).toBe("realise");
  });
  it("cible diesel : réalisé quand l'année-modèle atteint l'année prévue", () => {
    expect(
      etatRemplacement(vehicule({ target_technology: "diesel", model_year: 2028 }), 2026),
    ).toBe("realise");
    expect(
      etatRemplacement(vehicule({ target_technology: "diesel", model_year: 2018 }), 2026),
    ).toBe("a_venir");
  });
  it("en retard / cette année / à venir selon l'année prévue", () => {
    expect(etatRemplacement(vehicule({ replacement_year: 2024 }), 2026)).toBe("en_retard");
    expect(etatRemplacement(vehicule({ replacement_year: 2026 }), 2026)).toBe("cette_annee");
    expect(etatRemplacement(vehicule({ replacement_year: 2030 }), 2026)).toBe("a_venir");
  });
  it("sans plan quand l'année ou la cible manquent", () => {
    expect(etatRemplacement(vehicule({ replacement_year: null }), 2026)).toBe("sans_plan");
    expect(etatRemplacement(vehicule({ target_technology: null }), 2026)).toBe("sans_plan");
  });
});

describe("tachesDuPlan", () => {
  it("crée la tâche de remplacement (échéance 31 mars) et la tâche de demande de subvention", () => {
    const taches = tachesDuPlan([vehicule()], OPTIONS);
    const remplacement = taches.find((t) => t.auto_key === "remplacement:v1:2028")!;
    expect(remplacement.title).toBe("Remplacer U-101 (BEV)");
    expect(remplacement.due_date).toBe("2028-03-31");
    expect(remplacement.plan_year).toBe(2028);
    // camionnette BEV 2028 : Écocamionnage actif → tâche de dépôt
    const subvention = taches.find((t) => t.auto_key.startsWith("subvention:v1:"));
    expect(subvention).toBeDefined();
    expect(subvention!.subsidy_program).toBeTruthy();
    expect(subvention!.due_date >= "2026-01-01").toBe(true);
  });

  it("idempotent par construction : mêmes entrées ⇒ mêmes clés", () => {
    const a = tachesDuPlan([vehicule()], OPTIONS).map((t) => t.auto_key);
    const b = tachesDuPlan([vehicule()], OPTIONS).map((t) => t.auto_key);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("aucune tâche pour un véhicule déjà remplacé ou sans plan", () => {
    expect(tachesDuPlan([vehicule({ fuel_type: "bev" })], OPTIONS)).toEqual([]);
    expect(tachesDuPlan([vehicule({ replacement_year: null })], OPTIONS)).toEqual([]);
  });

  it("pas de tâche de subvention pour un achat après la fin du programme", () => {
    const taches = tachesDuPlan([vehicule({ replacement_year: 2032 })], OPTIONS);
    // Écocamionnage (2025-2028) échu en 2032 : seule la tâche de remplacement reste
    expect(taches.some((t) => t.auto_key.startsWith("subvention:"))).toBe(false);
    expect(taches.some((t) => t.auto_key.startsWith("remplacement:"))).toBe(true);
  });
});

/**
 * Fusion des données client de prix (couche 3, §3.3 v2.2) : la ligne
 * PROJET prime sur la ligne ORGANISATION, champ par champ, et chaque
 * valeur retenue produit son libellé « donnée client » pour les rapports.
 */
import { describe, expect, it } from "vitest";
// module PUR (src/lib/energyClient.ts) : aucun client Supabase au
// chargement — la CI n'a pas de VITE_SUPABASE_URL.
import { fusionnerSurcharges, type LigneEnergieClient } from "@/lib/energyClient";

function ligne(patch: Partial<LigneEnergieClient>): LigneEnergieClient {
  return {
    project_id: null,
    diesel_price_per_l: null,
    electricity_cost_per_kwh: null,
    h2_price_per_kg: null,
    grid_connection_quote: null,
    updated_at: "2026-09-29T00:00:00Z",
    ...patch,
  };
}

describe("fusionnerSurcharges", () => {
  it("le projet prime sur l'organisation, champ par champ", () => {
    const org = ligne({ diesel_price_per_l: 1.7, electricity_cost_per_kwh: 0.09 });
    const projet = ligne({ project_id: "p1", diesel_price_per_l: 1.55 });
    const s = fusionnerSurcharges(org, projet);
    expect(s.dieselParL).toBe(1.55); // projet
    expect(s.electriciteEffectiveParKwh).toBe(0.09); // retombe sur l'organisation
    expect(s.h2LivreParKg).toBeUndefined(); // aucune couche : défaut du registre
    expect(s.provenances.some((p) => p.includes("projet"))).toBe(true);
    expect(s.provenances.some((p) => p.includes("organisation"))).toBe(true);
  });

  it("aucune donnée client : aucune surcharge, aucune provenance", () => {
    const s = fusionnerSurcharges(null, null);
    expect(s.dieselParL).toBeUndefined();
    expect(s.devisRaccordement).toBeUndefined();
    expect(s.provenances).toEqual([]);
  });

  it("chaque provenance porte le champ et la date de mise à jour", () => {
    const org = ligne({ grid_connection_quote: 250000, updated_at: "2026-09-15T10:00:00Z" });
    const s = fusionnerSurcharges(org, null);
    expect(s.devisRaccordement).toBe(250000);
    expect(s.provenances[0]).toContain("raccordement");
    expect(s.provenances[0]).toContain("2026-09-15");
  });
});

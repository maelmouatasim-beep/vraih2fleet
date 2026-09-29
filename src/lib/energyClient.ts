/**
 * Fusion PURE des données client de prix de l'énergie (couche 3,
 * §3.3 v2.2) — aucun accès réseau ni client Supabase ici, pour rester
 * importable par les tests et par le moteur. L'accès aux tables est
 * dans src/lib/supabase/energyInputs.ts.
 */

/** Champs utiles d'une ligne energy_client_inputs (org ou projet). */
export interface LigneEnergieClient {
  project_id: string | null;
  diesel_price_per_l: number | null;
  electricity_cost_per_kwh: number | null;
  h2_price_per_kg: number | null;
  grid_connection_quote: number | null;
  updated_at: string | null;
}

export interface SurchargesEnergieClient {
  dieselParL?: number;
  electriciteEffectiveParKwh?: number;
  h2LivreParKg?: number;
  devisRaccordement?: number;
  /** Libellés « donnée client » (champ + provenance + date) pour les rapports. */
  provenances: string[];
}

const LIBELLES = {
  diesel_price_per_l: "prix du diesel payé ($/L avant TPS/TVQ)",
  electricity_cost_per_kwh: "coût effectif de l’électricité ($/kWh avant taxes)",
  h2_price_per_kg: "prix de l’hydrogène livré ($/kg avant taxes)",
  grid_connection_quote: "devis de raccordement du dépôt ($ avant taxes)",
} as const;

/** Fusionne organisation + projet (le projet prime) en surcharges pour
 *  `parametresParDefaut`, avec les libellés « donnée client ». */
export function fusionnerSurcharges(
  organisation: LigneEnergieClient | null,
  projet: LigneEnergieClient | null,
): SurchargesEnergieClient {
  const provenances: string[] = [];
  const prend = (champ: keyof typeof LIBELLES): number | undefined => {
    for (const [ligne, niveau] of [
      [projet, "projet"],
      [organisation, "organisation"],
    ] as const) {
      const v = ligne?.[champ];
      if (typeof v === "number" && Number.isFinite(v)) {
        const date = (ligne!.updated_at ?? "").slice(0, 10);
        provenances.push(`${LIBELLES[champ]} : donnée client (${niveau}${date ? `, ${date}` : ""})`);
        return v;
      }
    }
    return undefined;
  };
  return {
    dieselParL: prend("diesel_price_per_l"),
    electriciteEffectiveParKwh: prend("electricity_cost_per_kwh"),
    h2LivreParKg: prend("h2_price_per_kg"),
    devisRaccordement: prend("grid_connection_quote"),
    provenances,
  };
}

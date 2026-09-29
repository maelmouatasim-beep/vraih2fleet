/**
 * Données client de prix de l'énergie (couche 3, §3.3 v2.2) : une ligne
 * par organisation (project_id NULL) et, au besoin, une par projet —
 * la ligne projet PRIME sur celle de l'organisation, qui prime sur les
 * défauts du registre. Tous les montants s'entendent AVANT TPS/TVQ.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type EnergyClientInputs = Tables<"energy_client_inputs">;

export interface SurchargesEnergieClient {
  dieselParL?: number;
  electriciteEffectiveParKwh?: number;
  h2LivreParKg?: number;
  devisRaccordement?: number;
  /** Libellés « donnée client » (champ + provenance + date) pour les rapports. */
  provenances: string[];
}

export async function getEnergyInputs(
  organizationId: string,
  projectId?: string,
): Promise<{ organisation: EnergyClientInputs | null; projet: EnergyClientInputs | null }> {
  const { data, error } = await supabase
    .from("energy_client_inputs")
    .select("*")
    .eq("organization_id", organizationId);
  if (error) throw error;
  const lignes = data ?? [];
  return {
    organisation: lignes.find((l) => l.project_id === null) ?? null,
    projet: projectId ? (lignes.find((l) => l.project_id === projectId) ?? null) : null,
  };
}

export async function upsertEnergyInputs(
  valeurs: Omit<TablesInsert<"energy_client_inputs">, "id" | "created_at" | "updated_at">,
): Promise<EnergyClientInputs> {
  // Unicité par index partiel (une ligne org, une ligne par projet) :
  // l'upsert PostgREST ne sait pas viser un index partiel — on cherche
  // la ligne existante puis on met à jour ou on insère.
  const base = supabase
    .from("energy_client_inputs")
    .select("id")
    .eq("organization_id", valeurs.organization_id);
  const { data: existant, error: errLecture } = valeurs.project_id
    ? await base.eq("project_id", valeurs.project_id).maybeSingle()
    : await base.is("project_id", null).maybeSingle();
  if (errLecture) throw errLecture;

  if (existant) {
    const { data, error } = await supabase
      .from("energy_client_inputs")
      .update(valeurs)
      .eq("id", existant.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("energy_client_inputs")
    .insert(valeurs)
    .select()
    .single();
  if (error) throw error;
  return data;
}

const LIBELLES: Record<string, string> = {
  diesel_price_per_l: "prix du diesel payé ($/L avant TPS/TVQ)",
  electricity_cost_per_kwh: "coût effectif de l’électricité ($/kWh avant taxes)",
  h2_price_per_kg: "prix de l’hydrogène livré ($/kg avant taxes)",
  grid_connection_quote: "devis de raccordement du dépôt ($ avant taxes)",
};

/** Fusionne organisation + projet (le projet prime) en surcharges pour
 *  `parametresParDefaut`, avec les libellés « donnée client ». */
export function fusionnerSurcharges(
  organisation: EnergyClientInputs | null,
  projet: EnergyClientInputs | null,
): SurchargesEnergieClient {
  const provenances: string[] = [];
  const prend = (champ: keyof typeof LIBELLES & keyof EnergyClientInputs): number | undefined => {
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

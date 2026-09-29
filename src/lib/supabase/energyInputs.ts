/**
 * Données client de prix de l'énergie (couche 3, §3.3 v2.2) : une ligne
 * par organisation (project_id NULL) et, au besoin, une par projet —
 * la ligne projet PRIME sur celle de l'organisation, qui prime sur les
 * défauts du registre. Tous les montants s'entendent AVANT TPS/TVQ.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { fusionnerSurcharges, type SurchargesEnergieClient } from "@/lib/energyClient";

export type EnergyClientInputs = Tables<"energy_client_inputs">;
export { fusionnerSurcharges };
export type { SurchargesEnergieClient };

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

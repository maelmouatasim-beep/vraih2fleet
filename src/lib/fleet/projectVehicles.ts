/**
 * Véhicules inclus dans un projet (étape Flotte du parcours) : liaison
 * project_vehicles avec l'année de remplacement et la technologie cible
 * PAR VÉHICULE. La visibilité et le droit d'écriture sont portés par la
 * RLS (can_view_project / can_edit_project).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { VehicleRow } from "./vehicles";

export type ProjectVehicleRow = Tables<"project_vehicles">;
export type ProjectVehicleInsert = TablesInsert<"project_vehicles">;
export type ProjectVehicleUpdate = TablesUpdate<"project_vehicles">;

/** Technologies cibles autorisées (contrainte CHECK de la table). */
export const TECHNOLOGIES_CIBLES = ["diesel", "bev", "fcev"] as const;
export type TechnologieCible = (typeof TECHNOLOGIES_CIBLES)[number];

/** Ligne project_vehicles avec le véhicule joint (affichage du parcours). */
export interface ProjectVehicleWithVehicle extends ProjectVehicleRow {
  vehicles: VehicleRow;
}

export async function listProjectVehicles(projectId: string): Promise<ProjectVehicleWithVehicle[]> {
  const { data, error } = await supabase
    .from("project_vehicles")
    .select("*, vehicles(*)")
    .eq("project_id", projectId);
  if (error) throw error;
  // Défense en profondeur (revue B3) : si la RLS cache le véhicule joint
  // (données plus anciennes que la policy « project viewers »), la ligne
  // est ignorée au lieu de faire planter l'écran sur vehicles=null.
  const lignes = ((data ?? []) as unknown as (ProjectVehicleWithVehicle | { vehicles: null })[]).filter(
    (l): l is ProjectVehicleWithVehicle => l.vehicles !== null,
  );
  return lignes.sort((a, b) =>
    a.vehicles.unit_number.localeCompare(b.vehicles.unit_number, "fr", { numeric: true }),
  );
}

/** Ajout en lot des véhicules sélectionnés dans « Ma flotte ». */
export async function addProjectVehicles(rows: ProjectVehicleInsert[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await supabase.from("project_vehicles").insert(rows).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function updateProjectVehicle(id: string, patch: ProjectVehicleUpdate): Promise<void> {
  const { error } = await supabase.from("project_vehicles").update(patch).eq("id", id);
  if (error) throw error;
}

/** Retire un véhicule du projet (le véhicule reste dans « Ma flotte »). */
export async function removeProjectVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("project_vehicles").delete().eq("id", id);
  if (error) throw error;
}

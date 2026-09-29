import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type VehicleRow = Tables<"vehicles">;
export type VehicleInsert = TablesInsert<"vehicles">;
export type VehicleUpdate = TablesUpdate<"vehicles">;

export {
  CARBURANTS,
  CATEGORIES_VEHICULE,
  PROFILS_USAGE,
  SOURCES_CONSOMMATION,
  STATUTS_VEHICULE,
} from "./constants";

export async function listVehicles(organizationId: string): Promise<VehicleRow[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("organization_id", organizationId)
    .order("unit_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createVehicle(vehicle: VehicleInsert): Promise<VehicleRow> {
  const { data, error } = await supabase.from("vehicles").insert(vehicle).select("*").single();
  if (error) throw error;
  return data;
}

/** Insertion en lot (import CSV/Excel) — tout ou rien. */
export async function bulkInsertVehicles(vehicles: VehicleInsert[]): Promise<number> {
  if (vehicles.length === 0) return 0;
  const { data, error } = await supabase.from("vehicles").insert(vehicles).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function updateVehicle(id: string, patch: VehicleUpdate): Promise<void> {
  const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
  if (error) throw error;
}

/** Nombre de projets qui référencent ce véhicule (effet d'une suppression). */
export async function countVehicleProjectLinks(vehicleId: string): Promise<number> {
  const { count, error } = await supabase
    .from("project_vehicles")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Garages de l'organisation (test terrain, bloc 2.1) : nom, adresse,
 * puissance électrique disponible, tarif Hydro-Québec, fenêtre de
 * recharge (retour → départ), places, devis de raccordement. Le
 * dimensionnement des bornes et du raccordement les lit via
 * `caracteristiquesGarages` (clé = cleGarage(nom), la même que le
 * regroupement des véhicules par dépôt).
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { garagesACreer, type GarageRow } from "./garagesModel";

export { caracteristiquesGarages, garagesACreer, heuresFenetre, TARIFS_HQ, type GarageRow } from "./garagesModel";
export type GarageInsert = TablesInsert<"garages">;
export type GarageUpdate = TablesUpdate<"garages">;


export async function listGarages(organizationId: string): Promise<GarageRow[]> {
  const { data, error } = await supabase
    .from("garages")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Rattache les véhicules existants dont le dépôt porte ce nom (le trigger
 *  vehicles_sync_garage fait le lien quand le dépôt est réécrit). */
async function rattacherVehicules(g: GarageRow): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .update({ depot: g.name })
    .eq("organization_id", g.organization_id)
    .is("garage_id", null)
    .ilike("depot", g.name.replace(/[%_]/g, "\\$&"));
  if (error) throw error;
}

export async function createGarage(g: GarageInsert): Promise<GarageRow> {
  const { data, error } = await supabase.from("garages").insert(g).select("*").single();
  if (error) throw error;
  await rattacherVehicules(data);
  return data;
}

export async function updateGarage(id: string, patch: GarageUpdate): Promise<void> {
  const { error } = await supabase.from("garages").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteGarage(id: string): Promise<void> {
  const { error } = await supabase.from("garages").delete().eq("id", id);
  if (error) throw error;
}

/** Import : crée les garages manquants AVANT d'insérer les véhicules, pour
 *  que chaque véhicule soit rattaché à son garage. */
export async function assurerGarages(organizationId: string, depots: (string | null | undefined)[]): Promise<number> {
  const existants = await listGarages(organizationId);
  const noms = garagesACreer(depots, existants);
  if (noms.length === 0) return 0;
  const { error } = await supabase
    .from("garages")
    .insert(noms.map((name) => ({ organization_id: organizationId, name })));
  if (error) throw error;
  return noms.length;
}


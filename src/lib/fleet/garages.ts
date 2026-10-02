/**
 * Garages de l'organisation (test terrain, bloc 2.1) : nom, adresse,
 * puissance électrique disponible, tarif Hydro-Québec, fenêtre de
 * recharge (retour → départ), places, devis de raccordement. Le
 * dimensionnement des bornes et du raccordement les lit via
 * `caracteristiquesGarages` (clé = cleGarage(nom), la même que le
 * regroupement des véhicules par dépôt).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { cleGarage, type CaracteristiquesGarage } from "@/lib/journey/infrastructure";

export type GarageRow = Tables<"garages">;
export type GarageInsert = TablesInsert<"garages">;
export type GarageUpdate = TablesUpdate<"garages">;

export const TARIFS_HQ = ["G", "M", "LG", "autre"] as const;

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

/** Noms de dépôts (import) qui n'ont pas encore de garage — dédoublonnés
 *  par clé (casse et espaces ignorés), dans l'ordre d'apparition. */
export function garagesACreer(depots: (string | null | undefined)[], existants: { name: string }[]): string[] {
  const connus = new Set(existants.map((g) => cleGarage(g.name)));
  const nouveaux: string[] = [];
  for (const d of depots) {
    const nom = d?.trim().replace(/\s+/g, " ");
    if (!nom) continue;
    const cle = cleGarage(nom);
    if (connus.has(cle)) continue;
    connus.add(cle);
    nouveaux.push(nom);
  }
  return nouveaux;
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

/** Caractéristiques connues des garages pour le dimensionnement. */
export function caracteristiquesGarages(garages: GarageRow[]): Map<string, CaracteristiquesGarage> {
  const m = new Map<string, CaracteristiquesGarage>();
  for (const g of garages) {
    m.set(cleGarage(g.name), {
      puissanceDisponibleKw: g.available_power_kw ?? undefined,
      devisRaccordement: g.grid_connection_quote ?? undefined,
      fenetreRecharge:
        g.return_time && g.departure_time ? { retour: g.return_time, depart: g.departure_time } : undefined,
    });
  }
  return m;
}

/** Durée de la fenêtre de recharge (h) entre le retour et le départ,
 *  à cheval sur minuit le cas échéant ; null si incomplète. */
export function heuresFenetre(retour: string | null | undefined, depart: string | null | undefined): number | null {
  if (!retour || !depart) return null;
  const min = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + (mm || 0);
  };
  let d = min(depart) - min(retour);
  if (d <= 0) d += 24 * 60;
  return Math.round((d / 60) * 100) / 100;
}

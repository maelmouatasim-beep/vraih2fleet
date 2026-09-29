/**
 * Accès Supabase aux subventions confirmées par le client
 * (table confirmed_subsidies — RLS par accès projet). La logique pure
 * (libellés, fusion avec le résolveur) est dans src/lib/confirmedSubsidies.ts.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ConfirmedSubsidy = Tables<"confirmed_subsidies">;

export async function listConfirmedSubsidies(projectId: string): Promise<ConfirmedSubsidy[]> {
  const { data, error } = await supabase
    .from("confirmed_subsidies")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addConfirmedSubsidy(
  ligne: Omit<TablesInsert<"confirmed_subsidies">, "id" | "created_at" | "updated_at" | "created_by">,
): Promise<ConfirmedSubsidy> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("confirmed_subsidies")
    .insert({ ...ligne, created_by: auth.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeConfirmedSubsidy(id: string): Promise<void> {
  const { error } = await supabase.from("confirmed_subsidies").delete().eq("id", id);
  if (error) throw error;
}

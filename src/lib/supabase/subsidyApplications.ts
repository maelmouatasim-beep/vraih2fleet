/** Accès Supabase au suivi des demandes de subvention (C5). */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type SubsidyApplicationRow = Tables<"subsidy_applications">;
export type SubsidyApplicationInsert = TablesInsert<"subsidy_applications">;
export type SubsidyApplicationUpdate = TablesUpdate<"subsidy_applications">;

export async function listSubsidyApplications(projectId: string): Promise<SubsidyApplicationRow[]> {
  const { data, error } = await supabase
    .from("subsidy_applications")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSubsidyApplication(
  row: SubsidyApplicationInsert,
): Promise<SubsidyApplicationRow> {
  const { data, error } = await supabase
    .from("subsidy_applications")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubsidyApplication(
  id: string,
  patch: SubsidyApplicationUpdate,
): Promise<void> {
  const { error } = await supabase.from("subsidy_applications").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSubsidyApplication(id: string): Promise<void> {
  const { error } = await supabase.from("subsidy_applications").delete().eq("id", id);
  if (error) throw error;
}

/** Tâches de subvention du projet (échéances reliées, C5). */
export interface TacheSubventionRow {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  subsidy_program: string | null;
  vehicle_id: string | null;
}

export async function listSubsidyTasks(projectId: string): Promise<TacheSubventionRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, due_date, status, subsidy_program, vehicle_id")
    .eq("project_id", projectId)
    .not("subsidy_program", "is", null);
  if (error) throw error;
  return (data ?? []) as TacheSubventionRow[];
}

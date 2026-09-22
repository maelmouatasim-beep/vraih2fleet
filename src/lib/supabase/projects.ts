import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ProjectRow = Tables<"projects">;

export interface ProjectDTO {
  id: string;
  name: string;
  description: string | null;
  countryOrRegion: string;
  currency: string;
  defaultAnalysisHorizonYears: number;
  defaultDiscountRate: number;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  countryOrRegion: string;
  currency: string;
  defaultAnalysisHorizonYears: number;
  defaultDiscountRate: number;
}

function rowToProject(row: ProjectRow): ProjectDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    countryOrRegion: row.country_or_region,
    currency: row.currency,
    defaultAnalysisHorizonYears: row.default_analysis_horizon_years,
    defaultDiscountRate: row.default_discount_rate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

export async function listProjects(userId: string): Promise<ProjectDTO[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToProject);
}

export async function getProjectById(projectId: string, userId?: string): Promise<ProjectDTO | null> {
  let query = supabase.from("projects").select("*").eq("id", projectId);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;

  return data ? rowToProject(data) : null;
}

export async function createProject(userId: string, input: CreateProjectInput): Promise<ProjectDTO> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description || null,
      country_or_region: input.countryOrRegion,
      currency: input.currency,
      default_analysis_horizon_years: input.defaultAnalysisHorizonYears,
      default_discount_rate: input.defaultDiscountRate,
    })
    .select("*")
    .single();

  if (error) throw error;
  return rowToProject(data);
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

export async function duplicateProject(userId: string, projectId: string, newName: string): Promise<ProjectDTO> {
  const original = await getProjectById(projectId, userId);
  if (!original) throw new Error("Project not found");

  return createProject(userId, {
    name: newName,
    description: original.description || "",
    countryOrRegion: original.countryOrRegion,
    currency: original.currency,
    defaultAnalysisHorizonYears: original.defaultAnalysisHorizonYears,
    defaultDiscountRate: original.defaultDiscountRate,
  });
}

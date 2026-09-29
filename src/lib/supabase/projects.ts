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
  organizationId: string | null;
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
    organizationId: row.organization_id,
  };
}

// La visibilité est entièrement portée par la RLS (propriétaire,
// collaborateur externe OU membre de l'organisation) : filtrer côté
// client sur user_id rendait « introuvable » tout projet partagé.
export async function listProjects(): Promise<ProjectDTO[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(rowToProject);
}

export async function getProjectById(projectId: string): Promise<ProjectDTO | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;

  return data ? rowToProject(data) : null;
}

// Organisation COURANTE de l'utilisateur (revue B5) : celle choisie sur
// le profil si l'utilisateur en est membre, sinon la première par date
// d'adhésion (ordre déterministe).
async function myOrganizationId(userId: string): Promise<string | null> {
  const [membres, profil] = await Promise.all([
    supabase
      .from("organization_members")
      .select("organization_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("organization_id", { ascending: true }),
    supabase.from("profiles").select("current_organization_id").eq("id", userId).maybeSingle(),
  ]);
  const ids = (membres.data ?? []).map((m) => m.organization_id);
  const choisie = profil.data?.current_organization_id;
  if (choisie && ids.includes(choisie)) return choisie;
  return ids[0] ?? null;
}

export async function createProject(userId: string, input: CreateProjectInput): Promise<ProjectDTO> {
  const organizationId = await myOrganizationId(userId);
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      organization_id: organizationId,
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
  const original = await getProjectById(projectId);
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

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrgRole = Database["public"]["Enums"]["org_role"];

export interface OrganizationDTO {
  id: string;
  name: string;
  orgType: "municipalite" | "societe_transport" | "entreprise";
  region: string;
  currency: string;
  /** Rôle de l'utilisateur courant dans cette organisation. */
  myRole: OrgRole;
}

export interface OrganizationMemberDTO {
  id: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
}

function versDTO(role: OrgRole, org: {
  id: string;
  name: string;
  org_type: string;
  region: string;
  currency: string;
}): OrganizationDTO {
  return {
    id: org.id,
    name: org.name,
    orgType: org.org_type as OrganizationDTO["orgType"],
    region: org.region,
    currency: org.currency,
    myRole: role,
  };
}

/** Toutes les organisations de l'utilisateur (ordre d'adhésion stable). */
export async function listMyOrganizations(userId: string): Promise<OrganizationDTO[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization_id, created_at, organizations(id, name, org_type, region, currency)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("organization_id", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((m) => m.organizations)
    .map((m) => versDTO(m.role, m.organizations!));
}

/**
 * L'organisation COURANTE de l'utilisateur (revue B5) : celle qu'il a
 * CHOISIE (profiles.current_organization_id) s'il en est toujours
 * membre, sinon la première par date d'adhésion — ordre DÉTERMINISTE
 * (created_at puis id), jamais « la plus ancienne au hasard ».
 */
export async function getMyOrganization(userId: string): Promise<OrganizationDTO | null> {
  const [orgs, profil] = await Promise.all([
    listMyOrganizations(userId),
    supabase.from("profiles").select("current_organization_id").eq("id", userId).maybeSingle(),
  ]);
  if (orgs.length === 0) return null;
  const choisie = profil.data?.current_organization_id;
  return orgs.find((o) => o.id === choisie) ?? orgs[0];
}

/** Change l'organisation courante (persistée sur le profil). */
export async function setCurrentOrganization(userId: string, organizationId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ current_organization_id: organizationId })
    .eq("id", userId);
  if (error) throw error;
}

/** Effet d'une suppression d'organisation : ce qui disparaît avec elle. */
export async function getOrganizationDeletionEffects(
  organizationId: string,
): Promise<{ vehicules: number; projets: number; membres: number }> {
  const [veh, proj, mem] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
  ]);
  return { vehicules: veh.count ?? 0, projets: proj.count ?? 0, membres: mem.count ?? 0 };
}

/** Supprime l'organisation (admins seulement — RLS). La flotte est
 *  SUPPRIMÉE en cascade ; les projets sont détachés (organization_id
 *  devient NULL, ils restent au propriétaire). */
export async function deleteOrganization(organizationId: string): Promise<void> {
  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);
  if (error) throw error;
}

export async function listOrganizationMembers(organizationId: string): Promise<OrganizationMemberDTO[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role,
    createdAt: m.created_at,
  }));
}

export async function updateOrganization(
  organizationId: string,
  patch: Partial<Pick<OrganizationDTO, "name" | "orgType" | "region" | "currency">>,
): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.orgType !== undefined ? { org_type: patch.orgType } : {}),
      ...(patch.region !== undefined ? { region: patch.region } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
    })
    .eq("id", organizationId);
  if (error) throw error;
}

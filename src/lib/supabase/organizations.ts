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

/**
 * L'organisation courante de l'utilisateur (la première par date
 * d'adhésion — en v1 chaque utilisateur appartient à une seule
 * organisation, créée automatiquement à l'inscription).
 */
export async function getMyOrganization(userId: string): Promise<OrganizationDTO | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, org_type, region, currency)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.organizations) return null;
  const org = data.organizations;
  return {
    id: org.id,
    name: org.name,
    orgType: org.org_type as OrganizationDTO["orgType"],
    region: org.region,
    currency: org.currency,
    myRole: data.role,
  };
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

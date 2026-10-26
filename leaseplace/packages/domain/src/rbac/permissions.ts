import { organizationTypeOfRole, type OrganizationType, type Role } from "./roles";

/**
 * Permissions applicatives. La RLS de la base reste la barrière finale :
 * ces permissions décident de l'interface et des actions serveur, la base
 * décide de ce qui est lisible.
 */
export const PERMISSIONS = [
  // Espaces
  "space.company",
  "space.lessor",
  "space.admin",
  // Organisation
  "organization.read",
  "organization.manage_members",
  // Entreprise (phase 4)
  "request.create",
  "request.read_own",
  "document.manage_own",
  "consent.grant",
  // Comparateur, opérations, messagerie (phase 7)
  "offer.accept",
  "deal.cancel_own",
  "deal.manage",
  "message.send",
  // Facturation et pilotage (phase 8)
  "billing.read_own",
  "kpi.read",
  // Droits des personnes et conservation (phase 9)
  "privacy.manage_own",
  "privacy.manage",
  // Bailleur (phase 6)
  "routed_request.read",
  "offer.submit",
  "offer.read_own",
  "appetite.manage",
  // Plateforme (phases 5 et 8)
  "kyc.review",
  "score.override",
  "mandate.manage",
  "commission.manage",
  "audit.read",
  "user.impersonate",
  "user.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Readonly<Record<Role, readonly Permission[]>> = {
  company_owner: [
    "space.company",
    "organization.read",
    "organization.manage_members",
    "request.create",
    "request.read_own",
    "document.manage_own",
    "consent.grant",
    "offer.accept",
    "deal.cancel_own",
    "message.send",
    "privacy.manage_own",
  ],
  company_member: [
    "space.company",
    "organization.read",
    "request.create",
    "request.read_own",
    "document.manage_own",
    "message.send",
  ],
  lessor_admin: [
    "space.lessor",
    "organization.read",
    "organization.manage_members",
    "routed_request.read",
    "offer.submit",
    "offer.read_own",
    "appetite.manage",
    "deal.manage",
    "message.send",
    "billing.read_own",
  ],
  lessor_analyst: [
    "space.lessor",
    "organization.read",
    "routed_request.read",
    "offer.submit",
    "offer.read_own",
    "deal.manage",
    "message.send",
  ],
  lessor_viewer: ["space.lessor", "organization.read", "routed_request.read", "offer.read_own"],
  // Prescripteurs et fournisseurs : hors périmètre V1, aucun espace ouvert.
  prescriber_admin: ["organization.read"],
  prescriber_member: ["organization.read"],
  supplier_admin: ["organization.read"],
  supplier_member: ["organization.read"],
  platform_admin: [
    "space.admin",
    "organization.read",
    "organization.manage_members",
    "kyc.review",
    "score.override",
    "mandate.manage",
    "commission.manage",
    "audit.read",
    "user.impersonate",
    "user.manage",
    "kpi.read",
    "privacy.manage",
  ],
  platform_ops: [
    "space.admin",
    "organization.read",
    "kyc.review",
    "score.override",
    "audit.read",
    "kpi.read",
  ],
  platform_support: ["space.admin", "organization.read", "user.impersonate"],
};

export function permissionsOf(role: Role): readonly Permission[] {
  return MATRIX[role];
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export class ForbiddenError extends Error {
  constructor(
    readonly role: Role,
    readonly permission: Permission,
  ) {
    super(`Rôle ${role} : permission ${permission} refusée`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError(role, permission);
}

/** Les trois espaces authentifiés de la V1. */
export const SPACES = ["company", "lessor", "admin"] as const;
export type Space = (typeof SPACES)[number];

const SPACE_PERMISSION: Readonly<Record<Space, Permission>> = {
  company: "space.company",
  lessor: "space.lessor",
  admin: "space.admin",
};

/** Chemin (sans préfixe de langue) de chaque espace. */
export const SPACE_PATHS: Readonly<Record<Space, string>> = {
  company: "/entreprise",
  lessor: "/bailleur",
  admin: "/admin",
};

export function canAccessSpace(role: Role, space: Space): boolean {
  return can(role, SPACE_PERMISSION[space]);
}

/** Espace d'accueil d'un rôle, ou `null` si aucun espace n'est ouvert (V1). */
export function homeSpaceOf(role: Role): Space | null {
  return SPACES.find((space) => canAccessSpace(role, space)) ?? null;
}

const SPACE_OF_ORGANIZATION_TYPE: Readonly<Record<OrganizationType, Space | null>> = {
  company: "company",
  lessor: "lessor",
  platform: "admin",
  prescriber: null,
  supplier: null,
};

/** Cohérence matrice ↔ type : l'espace d'un rôle est celui de son type. */
export function spaceOfOrganizationType(type: OrganizationType): Space | null {
  return SPACE_OF_ORGANIZATION_TYPE[type];
}

export function spaceOfRole(role: Role): Space | null {
  return spaceOfOrganizationType(organizationTypeOfRole(role));
}

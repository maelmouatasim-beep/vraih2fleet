/**
 * Types d'organisation et rôles de leurs membres.
 *
 * Un rôle n'a de sens que dans un type d'organisation : un membre d'un
 * bailleur ne peut pas être « company_owner ». La base applique la même
 * règle (contrainte CHECK générée depuis ces listes).
 */

export const ORGANIZATION_TYPES = [
  "company",
  "lessor",
  "prescriber",
  "supplier",
  "platform",
] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const ROLES_BY_ORGANIZATION_TYPE = {
  company: ["company_owner", "company_member"],
  lessor: ["lessor_admin", "lessor_analyst", "lessor_viewer"],
  prescriber: ["prescriber_admin", "prescriber_member"],
  supplier: ["supplier_admin", "supplier_member"],
  platform: ["platform_admin", "platform_ops", "platform_support"],
} as const satisfies Record<OrganizationType, readonly string[]>;

export type RoleOf<T extends OrganizationType> = (typeof ROLES_BY_ORGANIZATION_TYPE)[T][number];
export type Role = RoleOf<OrganizationType>;

export const ROLES: readonly Role[] = ORGANIZATION_TYPES.flatMap(
  (type) => ROLES_BY_ORGANIZATION_TYPE[type],
);

export function isOrganizationType(value: unknown): value is OrganizationType {
  return typeof value === "string" && (ORGANIZATION_TYPES as readonly string[]).includes(value);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Type d'organisation auquel appartient un rôle. */
export function organizationTypeOfRole(role: Role): OrganizationType {
  const type = ORGANIZATION_TYPES.find((t) =>
    (ROLES_BY_ORGANIZATION_TYPE[t] as readonly Role[]).includes(role),
  );
  if (type === undefined) throw new Error(`Rôle sans type d'organisation : ${role}`);
  return type;
}

export function isRoleAllowedFor(type: OrganizationType, role: Role): boolean {
  return organizationTypeOfRole(role) === type;
}

/**
 * Double authentification obligatoire : bailleurs et équipe plateforme.
 * Les PME se connectent par lien magique ou code à usage unique.
 */
export function requiresTwoFactor(type: OrganizationType): boolean {
  return type === "lessor" || type === "platform";
}

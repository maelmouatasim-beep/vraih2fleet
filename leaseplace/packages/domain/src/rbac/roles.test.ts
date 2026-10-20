import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_TYPES,
  ROLES,
  ROLES_BY_ORGANIZATION_TYPE,
  isOrganizationType,
  isRole,
  isRoleAllowedFor,
  organizationTypeOfRole,
  requiresTwoFactor,
  type Role,
} from "./roles";

describe("rôles", () => {
  it("chaque rôle appartient à un seul type d'organisation", () => {
    const vus = new Set<string>();
    for (const type of ORGANIZATION_TYPES) {
      for (const role of ROLES_BY_ORGANIZATION_TYPE[type]) {
        expect(vus.has(role)).toBe(false);
        vus.add(role);
        expect(organizationTypeOfRole(role)).toBe(type);
        expect(role.startsWith(`${type}_`)).toBe(true);
      }
    }
    expect(vus.size).toBe(ROLES.length);
  });

  it("refuse un rôle étranger au type", () => {
    expect(isRoleAllowedFor("lessor", "lessor_admin")).toBe(true);
    expect(isRoleAllowedFor("lessor", "company_owner")).toBe(false);
    expect(isRoleAllowedFor("company", "platform_admin")).toBe(false);
  });

  it("valide les valeurs inconnues", () => {
    expect(isRole("platform_ops")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(42)).toBe(false);
    expect(isOrganizationType("lessor")).toBe(true);
    expect(isOrganizationType("bank")).toBe(false);
    expect(isOrganizationType(null)).toBe(false);
  });

  it("lève une erreur pour un rôle hors catalogue", () => {
    expect(() => organizationTypeOfRole("intrus" as Role)).toThrow(/intrus/);
  });

  it("impose la double authentification aux bailleurs et à la plateforme seulement", () => {
    expect(requiresTwoFactor("lessor")).toBe(true);
    expect(requiresTwoFactor("platform")).toBe(true);
    expect(requiresTwoFactor("company")).toBe(false);
    expect(requiresTwoFactor("prescriber")).toBe(false);
    expect(requiresTwoFactor("supplier")).toBe(false);
  });
});

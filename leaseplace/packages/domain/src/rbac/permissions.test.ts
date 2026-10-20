import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  PERMISSIONS,
  SPACES,
  SPACE_PATHS,
  assertCan,
  can,
  canAccessSpace,
  homeSpaceOf,
  permissionsOf,
  spaceOfOrganizationType,
  spaceOfRole,
} from "./permissions";
import { ROLES, organizationTypeOfRole } from "./roles";

describe("permissions", () => {
  it("chaque rôle a des permissions connues et sans doublon", () => {
    for (const role of ROLES) {
      const perms = permissionsOf(role);
      expect(new Set(perms).size).toBe(perms.length);
      for (const p of perms) expect(PERMISSIONS).toContain(p);
    }
  });

  it("un bailleur n'accède jamais à l'espace entreprise ni au back-office", () => {
    for (const role of ["lessor_admin", "lessor_analyst", "lessor_viewer"] as const) {
      expect(canAccessSpace(role, "lessor")).toBe(true);
      expect(canAccessSpace(role, "company")).toBe(false);
      expect(canAccessSpace(role, "admin")).toBe(false);
      expect(can(role, "audit.read")).toBe(false);
      expect(can(role, "kyc.review")).toBe(false);
    }
  });

  it("une entreprise n'a aucune permission de bailleur ni de plateforme", () => {
    for (const role of ["company_owner", "company_member"] as const) {
      expect(can(role, "offer.submit")).toBe(false);
      expect(can(role, "routed_request.read")).toBe(false);
      expect(can(role, "space.admin")).toBe(false);
    }
  });

  it("seul le titulaire de l'entreprise donne un consentement", () => {
    expect(can("company_owner", "consent.grant")).toBe(true);
    expect(can("company_member", "consent.grant")).toBe(false);
  });

  it("les permissions de plateforme sont réservées aux rôles platform_*", () => {
    const reservees = [
      "kyc.review",
      "score.override",
      "mandate.manage",
      "commission.manage",
      "audit.read",
      "user.impersonate",
      "user.manage",
    ] as const;
    for (const role of ROLES) {
      for (const p of reservees) {
        if (can(role, p)) expect(organizationTypeOfRole(role)).toBe("platform");
      }
    }
  });

  it("un lecteur bailleur ne peut pas soumettre d'offre", () => {
    expect(can("lessor_viewer", "offer.submit")).toBe(false);
    expect(can("lessor_analyst", "offer.submit")).toBe(true);
  });

  it("assertCan lève ForbiddenError avec le rôle et la permission", () => {
    expect(() => {
      assertCan("platform_admin", "audit.read");
    }).not.toThrow();
    try {
      assertCan("lessor_viewer", "offer.submit");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      expect((e as ForbiddenError).role).toBe("lessor_viewer");
      expect((e as ForbiddenError).permission).toBe("offer.submit");
      expect((e as ForbiddenError).name).toBe("ForbiddenError");
    }
  });
});

describe("espaces", () => {
  it("l'espace d'accueil d'un rôle est celui de son type d'organisation", () => {
    for (const role of ROLES) {
      expect(homeSpaceOf(role)).toBe(spaceOfRole(role));
    }
  });

  it("chaque rôle ouvre au plus un espace", () => {
    for (const role of ROLES) {
      expect(SPACES.filter((s) => canAccessSpace(role, s)).length).toBeLessThanOrEqual(1);
    }
  });

  it("prescripteurs et fournisseurs : aucun espace en V1", () => {
    expect(homeSpaceOf("prescriber_admin")).toBeNull();
    expect(homeSpaceOf("supplier_member")).toBeNull();
    expect(spaceOfOrganizationType("prescriber")).toBeNull();
  });

  it("chemins des espaces", () => {
    expect(SPACE_PATHS).toEqual({ company: "/entreprise", lessor: "/bailleur", admin: "/admin" });
    expect(spaceOfOrganizationType("platform")).toBe("admin");
  });
});

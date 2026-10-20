import { describe, expect, it } from "vitest";
import { isRoleAllowedFor, requiresTwoFactor } from "@leaseplace/domain";
import { DEMO_ACCOUNTS, DEMO_ORGANIZATIONS } from "./demo-accounts";
import { currentTotp, secondsLeftInPeriod } from "./totp";

describe("jeu de démonstration", () => {
  it("chaque compte a un rôle valide pour son organisation", () => {
    for (const a of DEMO_ACCOUNTS) {
      const org = DEMO_ORGANIZATIONS.find((o) => o.key === a.organization);
      expect(org, a.key).toBeDefined();
      if (org) expect(isRoleAllowedFor(org.type, a.role)).toBe(true);
    }
  });

  it("2FA obligatoire ⇔ secret TOTP et mot de passe ; PME sans mot de passe", () => {
    for (const a of DEMO_ACCOUNTS) {
      const org = DEMO_ORGANIZATIONS.find((o) => o.key === a.organization);
      const strict = org ? requiresTwoFactor(org.type) : false;
      expect(Boolean(a.totpSecret), a.key).toBe(strict);
      expect(a.password, a.key).toBe(strict);
    }
  });

  it("uniquement des domaines réservés (.example) : aucune vraie personne", () => {
    for (const a of DEMO_ACCOUNTS) expect(a.email).toMatch(/\.example$/);
  });
});

describe("TOTP", () => {
  it("vecteur RFC 6238 (SHA-1, 6 chiffres)", () => {
    // Secret RFC « 12345678901234567890 », T = 59 s → 94287082 (8 chiffres) → 287082.
    expect(currentTotp("12345678901234567890", 59_000)).toBe("287082");
  });

  it("secondes restantes dans la période", () => {
    expect(secondsLeftInPeriod(0)).toBe(30);
    expect(secondsLeftInPeriod(29_000)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import {
  isPasswordlessAllowed,
  isSessionCreationAllowed,
  isTwoFactorDisableAllowed,
  signInMethodOf,
} from "./auth-policy";

describe("politique d'authentification", () => {
  it("un compte bailleur ou plateforme n'ouvre pas de session par lien magique ou code courriel", () => {
    expect(isSessionCreationAllowed({ strictTwoFactor: true, path: "/magic-link/verify" })).toBe(
      false,
    );
    expect(isSessionCreationAllowed({ strictTwoFactor: true, path: "/sign-in/email-otp" })).toBe(
      false,
    );
  });

  it("mot de passe et TOTP restent possibles pour un compte à 2FA obligatoire", () => {
    for (const path of [
      "/sign-in/email",
      "/two-factor/verify-totp",
      "/two-factor/verify-backup-code",
    ]) {
      expect(isSessionCreationAllowed({ strictTwoFactor: true, path })).toBe(true);
    }
  });

  it("une PME utilise tous les moyens, et une création interne est permise", () => {
    expect(isSessionCreationAllowed({ strictTwoFactor: false, path: "/magic-link/verify" })).toBe(
      true,
    );
    expect(isSessionCreationAllowed({ strictTwoFactor: true, path: undefined })).toBe(true);
  });

  it("2FA obligatoire : ni désactivation, ni connexion sans mot de passe", () => {
    expect(isTwoFactorDisableAllowed(true)).toBe(false);
    expect(isTwoFactorDisableAllowed(false)).toBe(true);
    expect(isPasswordlessAllowed(true)).toBe(false);
    expect(isPasswordlessAllowed(false)).toBe(true);
  });

  it("méthode de connexion déduite du chemin", () => {
    expect(signInMethodOf("/sign-in/email")).toBe("password");
    expect(signInMethodOf("/magic-link/verify")).toBe("magic_link");
    expect(signInMethodOf("/sign-in/email-otp")).toBe("email_otp");
    expect(signInMethodOf("/two-factor/verify-totp")).toBe("totp");
    expect(signInMethodOf("/two-factor/verify-backup-code")).toBe("backup_code");
    expect(signInMethodOf("/inconnu")).toBe("other");
    expect(signInMethodOf(undefined)).toBe("other");
  });
});

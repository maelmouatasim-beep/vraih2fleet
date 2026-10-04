import { describe, expect, it } from "vitest";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { cleErreurAuth } from "../authErrors";

const lire = (d: unknown, cle: string) => cle.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d);

describe("audit acheteur, point 3 — erreurs d'inscription en français", () => {
  it("le quota de courriels du serveur devient un message clair (jamais « email rate limit exceeded »)", () => {
    const cle = cleErreurAuth({ code: "over_email_send_rate_limit", message: "email rate limit exceeded", status: 429 });
    expect(cle).toBe("auth.errors.codes.emailRateLimit");
    expect(lire(fr, cle)).toMatch(/courriel/i);
    expect(lire(fr, cle)).not.toMatch(/rate limit/i);
  });

  it("codes et anciens messages reconnus ; inconnu = message générique, jamais le texte brut", () => {
    expect(cleErreurAuth({ code: "email_address_invalid" })).toBe("auth.errors.codes.emailInvalid");
    expect(cleErreurAuth({ message: "User already registered" })).toBe("auth.errors.codes.emailInUse");
    expect(cleErreurAuth({ message: "Invalid login credentials" })).toBe("auth.errors.codes.invalidCredentials");
    expect(cleErreurAuth({ message: "TypeError: Failed to fetch" })).toBe("auth.errors.codes.network");
    expect(cleErreurAuth({ message: "Something odd" })).toBe("auth.errors.codes.generic");
    expect(cleErreurAuth({ status: 429 })).toBe("auth.errors.codes.requestRateLimit");
  });

  it("chaque clé existe en français et en anglais", () => {
    for (const code of ["generic", "emailRateLimit", "requestRateLimit", "emailInvalid", "emailNotAuthorized", "emailInUse", "weakPassword", "invalidCredentials", "emailNotConfirmed", "signupDisabled", "samePassword", "network"]) {
      expect(typeof lire(fr, `auth.errors.codes.${code}`), code).toBe("string");
      expect(typeof lire(en, `auth.errors.codes.${code}`), code).toBe("string");
    }
  });
});

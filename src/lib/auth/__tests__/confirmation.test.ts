/** Parcours de confirmation de courriel : logique pure + garde-fous. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DELAI_RENVOI_S,
  emailPrerempli,
  issueRenvoi,
  lienConnexion,
  normaliserCodeOtp,
  secondesAvantRenvoi,
  typeErreurLien,
} from "../confirmation";
import { lireRetourAuth } from "@/lib/authRedirect";
import { cheminDepuisHash } from "@/lib/production/site";

const racine = resolve(__dirname, "../../../..");
const lire = (f: string) => readFileSync(resolve(racine, f), "utf8");

describe("erreurs de lien (paramètres error / error_code de Supabase)", () => {
  it("expiré ou déjà utilisé (otp_expired) → « expiré » ; le reste → « invalide »", () => {
    expect(typeErreurLien("otp_expired", "Email link is invalid or has expired")).toBe("expire");
    expect(typeErreurLien(null, "Token has expired")).toBe("expire");
    expect(typeErreurLien("bad_jwt", null)).toBe("invalide");
    expect(typeErreurLien(null, null)).toBe("invalide");
  });

  it("le retour d'erreur dans le hash est capturé avec son code, sans casser le routeur", () => {
    const h = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    expect(lireRetourAuth(h, "")).toMatchObject({ code: "otp_expired" });
    expect(cheminDepuisHash(h)).toBeNull(); // jamais pris pour une route
    expect(cheminDepuisHash("#access_token=a&type=signup")).toBeNull();
  });
});

describe("code à 6 chiffres", () => {
  it("espaces et tirets tolérés ; autre longueur ou lettres refusées", () => {
    expect(normaliserCodeOtp(" 123 456 ")).toBe("123456");
    expect(normaliserCodeOtp("123-456")).toBe("123456");
    expect(normaliserCodeOtp("12345")).toBeNull();
    expect(normaliserCodeOtp("12345a")).toBeNull();
    expect(normaliserCodeOtp("1234567")).toBeNull();
  });
});

describe("renvoi du courriel", () => {
  it("délai de 60 s affiché et décompté", () => {
    expect(DELAI_RENVOI_S).toBe(60);
    expect(secondesAvantRenvoi(null, 0)).toBe(0);
    expect(secondesAvantRenvoi(0, 0)).toBe(60);
    expect(secondesAvantRenvoi(0, 59_100)).toBe(1);
    expect(secondesAvantRenvoi(0, 60_000)).toBe(0);
  });

  it("aucune énumération : toute réponse hors limite de débit est neutre", () => {
    expect(issueRenvoi(null)).toBe("envoye_neutre");
    expect(issueRenvoi({ code: "user_already_exists" })).toBe("envoye_neutre");
    expect(issueRenvoi({ message: "Email already confirmed" })).toBe("envoye_neutre");
    expect(issueRenvoi({ status: 429 })).toBe("trop_de_demandes");
    expect(issueRenvoi({ message: "For security purposes, you can only request this after 42 seconds." })).toBe("trop_de_demandes");
  });
});

describe("connexion avec l'adresse préremplie", () => {
  it("lien et lecture de ?email=", () => {
    expect(lienConnexion("a.b@exemple.ca ")).toBe("/login?email=a.b%40exemple.ca");
    expect(emailPrerempli("?email=a.b%40exemple.ca")).toBe("a.b@exemple.ca");
    expect(emailPrerempli("?email=pas-une-adresse")).toBe("");
    expect(emailPrerempli("")).toBe("");
  });
});

describe("garde-fous du parcours", () => {
  it("inscription : une adresse déjà inscrite reçoit le même écran (pas d'énumération)", () => {
    const s = lire("src/pages/Signup.tsx");
    expect(s).not.toContain("t('auth.errors.emailInUse')");
    expect(s).toContain("<AttenteConfirmation");
  });
  it("le lien du courriel revient sur /auth/confirme ; routes déclarées", () => {
    expect(lire("src/hooks/useAuth.tsx")).toContain("urlRetourAuth(PAGE_CONFIRMATION)");
    const app = lire("src/App.tsx");
    expect(app).toContain('path="/auth/confirme"');
    expect(app).toContain('path="/auth/verifier"');
  });
  it("l'attente détecte la session (événement, onglets, focus) et vérifie le code (verifyOtp)", () => {
    const s = lire("src/components/auth/AttenteConfirmation.tsx");
    for (const m of ["synchroniserSession", '"storage"', '"focus"', "visibilitychange", "verifyOtp", "supabase.auth.resend"]) expect(s).toContain(m);
    // Événements d'authentification (dont le relais entre onglets) : dans le fournisseur.
    expect(lire("src/hooks/useAuth.tsx")).toContain("onAuthStateChange");
  });
  it("l'attente n'entre dans l'espace que quand le fournisseur d'auth connaît l'utilisateur (échec CI du 2026-10-05)", () => {
    const s = lire("src/components/auth/AttenteConfirmation.tsx");
    // Jamais de lecture directe de la session suivie d'une navigation : la route
    // protégée lirait encore « pas d'utilisateur » et renverrait à la connexion.
    expect(s).not.toContain("getSession");
    expect(s).not.toContain("onAuthStateChange");
    expect(s).toMatch(/if \(user\) entrer\(\);/);
    const auth = lire("src/hooks/useAuth.tsx");
    expect(auth).toMatch(/synchroniserSession = useCallback\(async \(\) => \{\s*const \{ data \} = await supabase\.auth\.getSession\(\);/);
  });
  it("modèle de courriel bilingue : lien ET code", () => {
    const m = lire("docs/courriels-auth/confirm-signup.html");
    expect(m).toContain("{{ .ConfirmationURL }}");
    expect(m).toContain("{{ .Token }}");
  });
});

import { describe, expect, it } from "vitest";
import { construireUrlRetour, destinationRetour, lireRetourAuth } from "../authRedirect";

describe("construireUrlRetour", () => {
  it("production (BrowserRouter, base /) : chemin de la route", () => {
    expect(
      construireUrlRetour({ origin: "https://h2fleet.ca", pathname: "/login", base: "/", hashRouter: false }, "/reset-password"),
    ).toBe("https://h2fleet.ca/reset-password");
  });

  it("GitHub Pages (HashRouter, base /vraih2fleet/) : racine du site, sans hash", () => {
    expect(
      construireUrlRetour(
        { origin: "https://maelmouatasim-beep.github.io", pathname: "/vraih2fleet/", base: "/vraih2fleet/", hashRouter: true },
        "/reset-password",
      ),
    ).toBe("https://maelmouatasim-beep.github.io/vraih2fleet/");
  });

  it("base relative (aperçu) : répertoire de la page courante", () => {
    expect(
      construireUrlRetour({ origin: "https://x.test", pathname: "/a/b/index.html", base: "./", hashRouter: true }, "/dashboard"),
    ).toBe("https://x.test/a/b/");
  });

  it("base sans barre finale et sous-dossier en BrowserRouter", () => {
    expect(
      construireUrlRetour({ origin: "https://x.test", pathname: "/", base: "/app", hashRouter: false }, "dashboard"),
    ).toBe("https://x.test/app/dashboard");
  });
});

describe("lireRetourAuth", () => {
  it("jetons de récupération dans le hash (flux implicit)", () => {
    expect(lireRetourAuth("#access_token=a&refresh_token=b&type=recovery", "")).toEqual({ type: "recovery", erreur: null });
  });

  it("confirmation d'inscription", () => {
    expect(lireRetourAuth("#access_token=a&type=signup", "")).toEqual({ type: "signup", erreur: null });
  });

  it("code PKCE dans la query, type inconnu toléré", () => {
    expect(lireRetourAuth("", "?code=xyz")).toEqual({ type: null, erreur: null });
    expect(lireRetourAuth("#access_token=a&type=bizarre", "")).toEqual({ type: null, erreur: null });
  });

  it("lien expiré : erreur remontée", () => {
    expect(lireRetourAuth("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid", "")).toEqual({
      type: null,
      erreur: "Email link is invalid",
    });
  });

  it("navigation ordinaire (route du HashRouter) : rien", () => {
    expect(lireRetourAuth("#/dashboard/projects", "")).toBeNull();
    expect(lireRetourAuth("", "")).toBeNull();
  });
});

describe("destinationRetour", () => {
  it("récupération → /reset-password, sinon tableau de bord, erreur → connexion", () => {
    expect(destinationRetour({ type: "recovery", erreur: null })).toBe("/reset-password");
    expect(destinationRetour({ type: "signup", erreur: null })).toBe("/dashboard");
    expect(destinationRetour({ type: null, erreur: "x" })).toBe("/login");
  });
});

describe("route fantôme du HashRouter au retour d'un lien", () => {
  it("« /access_token=… » est reconnu comme retour d'auth (pas une 404 journalisée)", () => {
    expect(lireRetourAuth("#access_token=eyJ&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery", "")).not.toBeNull();
    expect(lireRetourAuth("#page-inexistante", "")).toBeNull();
  });
});

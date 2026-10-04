import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REDIRECTIONS_PUBLIQUES,
  cheminDepuisHash,
  enTetesCommuns,
  fichierEnTetes,
  fichierRedirections,
  politiqueCsp,
  verifierEnvProduction,
} from "../site";

const URL_SB = "https://rjyvcogtvcgzwxeprgsm.supabase.co";
const racine = resolve(__dirname, "../../../..");

describe("production — en-têtes de sécurité", () => {
  it("CSP : seul Supabase (https + wss) en externe, jamais unsafe-eval ni *", () => {
    const csp = politiqueCsp(URL_SB);
    expect(csp).toContain(`connect-src 'self' ${URL_SB} wss://rjyvcogtvcgzwxeprgsm.supabase.co`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/'unsafe-eval'/);
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/);
    expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval';/);
  });

  it("Supabase local (CI) : ws:// autorisé ; http distant refusé", () => {
    expect(politiqueCsp("http://127.0.0.1:54321")).toContain("ws://127.0.0.1:54321");
    expect(() => politiqueCsp("http://exemple.com")).toThrow(/HTTPS/);
  });

  it("HSTS sans preload, anti-iframe, nosniff ; assets fingerprintés immuables", () => {
    const e = enTetesCommuns(URL_SB);
    expect(e["Strict-Transport-Security"]).toBe("max-age=31536000; includeSubDomains");
    expect(e["X-Frame-Options"]).toBe("DENY");
    expect(e["X-Content-Type-Options"]).toBe("nosniff");
    const f = fichierEnTetes(URL_SB);
    expect(f).toMatch(/^\/\*$/m);
    expect(f).toMatch(/^\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m);
  });
});

describe("production — redirections", () => {
  it("301 côté serveur pour chaque ancienne page, jamais de règle attrape-tout", () => {
    const f = fichierRedirections();
    for (const r of REDIRECTIONS_PUBLIQUES) expect(f).toContain(`${r.de}  ${r.vers}  301`);
    expect(f).not.toMatch(/^\/\*/m);
    expect(f).not.toMatch(/index\.html/);
  });

  it("les mêmes redirections sont rendues par le routeur (App.tsx)", () => {
    const app = readFileSync(resolve(racine, "src/App.tsx"), "utf8");
    expect(app).toContain("REDIRECTIONS_PUBLIQUES.map");
    for (const r of REDIRECTIONS_PUBLIQUES) expect(app).not.toContain(`path="${r.de}" element={<Navigate`);
  });

  it("destinations = routes existantes", () => {
    const app = readFileSync(resolve(racine, "src/App.tsx"), "utf8");
    for (const r of REDIRECTIONS_PUBLIQUES) expect(app).toContain(`path="${r.vers}"`);
  });

  it("aucun 404.html à la racine (sinon Cloudflare Pages quitte le mode SPA)", () => {
    expect(existsSync(resolve(racine, "public/404.html"))).toBe(false);
    expect(existsSync(resolve(racine, "public/_redirects"))).toBe(false);
  });
});

describe("production — anciennes URL à hash", () => {
  it("route → chemin propre", () => {
    expect(cheminDepuisHash("#/dashboard/projects/abc/plan")).toBe("/dashboard/projects/abc/plan");
    expect(cheminDepuisHash("#/login?x=1")).toBe("/login?x=1");
  });
  it("jetons d'auth, erreurs, ancres et autres hôtes laissés intacts", () => {
    expect(cheminDepuisHash("#access_token=abc&type=recovery")).toBeNull();
    expect(cheminDepuisHash("#/access_token=abc")).toBeNull();
    expect(cheminDepuisHash("#/reset?type=recovery")).toBeNull();
    expect(cheminDepuisHash("#error=access_denied&error_description=x")).toBeNull();
    expect(cheminDepuisHash("#garages")).toBeNull();
    expect(cheminDepuisHash("#//evil.example/x")).toBeNull();
    expect(cheminDepuisHash("")).toBeNull();
  });
});

describe("production — configuration du build", () => {
  const ok = {
    VITE_SUPABASE_URL: URL_SB,
    VITE_SUPABASE_PROJECT_ID: "rjyvcogtvcgzwxeprgsm",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
  };
  it("complète : aucun problème", () => {
    expect(verifierEnvProduction(ok)).toEqual([]);
  });
  it("variable manquante, URL incohérente, hash routing : refusé", () => {
    expect(verifierEnvProduction({ ...ok, VITE_SUPABASE_PUBLISHABLE_KEY: undefined })).toHaveLength(1);
    expect(verifierEnvProduction({ ...ok, VITE_SUPABASE_URL: "https://autre.supabase.co" })[0]).toMatch(/ne correspond pas/);
    expect(verifierEnvProduction({ ...ok, VITE_PREVIEW_HASH_ROUTER: "true" })[0]).toMatch(/BrowserRouter/);
  });
  it("clé secrète refusée (sb_secret_ ou JWT service_role)", () => {
    expect(verifierEnvProduction({ ...ok, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_xyz" })[0]).toMatch(/SECRÈTE/);
    const charge = btoa(JSON.stringify({ role: "service_role" })).replace(/=+$/, "");
    expect(verifierEnvProduction({ ...ok, VITE_SUPABASE_PUBLISHABLE_KEY: `e30.${charge}.sig` })[0]).toMatch(/SECRÈTE/);
  });
});

describe("production — index.html et robots", () => {
  it("aucune ancienne URL ni canonique unique pour toutes les routes", () => {
    const html = readFileSync(resolve(racine, "index.html"), "utf8");
    expect(html).not.toContain("h2fleet.app");
    expect(html).not.toContain('rel="canonical"');
  });
  it("robots : tableau de bord non indexé", () => {
    expect(readFileSync(resolve(racine, "public/robots.txt"), "utf8")).toMatch(/^Disallow: \/dashboard$/m);
  });
  it("Node 22 imposé à l'hébergeur", () => {
    expect(readFileSync(resolve(racine, ".node-version"), "utf8").trim()).toBe("22");
  });
});

describe("production — aucune ressource externe dans index.html (CSP)", () => {
  it("favicon servi par le site, plus rien chez Lovable", () => {
    const html = readFileSync(resolve(racine, "index.html"), "utf8");
    expect(html).not.toMatch(/googleapis|gpt-engineer|lovable/i);
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) expect(m[1]).not.toMatch(/^https?:/);
    for (const f of ["favicon.ico", "favicon.svg", "apple-touch-icon.png"]) expect(existsSync(resolve(racine, "public", f))).toBe(true);
  });
});

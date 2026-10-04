import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const racine = resolve(__dirname, "../../../..");
const lire = (f: string) => readFileSync(resolve(racine, f), "utf8");

describe("production — workflows prêts pour le dépôt privé", () => {
  it("GitHub Pages s'arrête de lui-même quand le dépôt devient privé", () => {
    expect(lire(".github/workflows/deploy-pages.yml")).toMatch(/deploy:\n\s+if: \$\{\{ !github\.event\.repository\.private \}\}/);
  });

  it("CI : job lourd hors push en privé (nuit, manuel, branche production)", () => {
    const ci = lire(".github/workflows/ci.yml");
    expect(ci).toMatch(/schedule:\n\s+- cron:/);
    expect(ci).toContain("workflow_dispatch:");
    expect(ci).toMatch(/supabase:\n\s+if: >-\n\s+\$\{\{ !github\.event\.repository\.private \|\| github\.event_name != 'push'\n\s+\|\| github\.ref == 'refs\/heads\/production' \}\}/);
  });

  it("CI : le parcours e2e tourne sur le BUNDLE DE PRODUCTION servi comme Cloudflare Pages", () => {
    const ci = lire(".github/workflows/ci.yml");
    expect(ci).toContain("node scripts/serveur-production.mjs 8080 dist-prod &");
    expect(ci).not.toContain("npx vite --port 8080");
    expect(lire("scripts/e2e-terrain.mjs")).toContain("violations de la CSP");
  });

  it("build:prod = build vérifié (refus si configuration incomplète)", () => {
    const pkg = JSON.parse(lire("package.json"));
    expect(pkg.scripts["build:prod"]).toBe("H2FLEET_BUILD_PRODUCTION=1 vite build");
    expect(lire("vite.config.ts")).toContain("verifierEnvProduction(env)");
  });
});

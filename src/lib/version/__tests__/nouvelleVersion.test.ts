import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { identifiantBuild, nouvelleVersionDisponible, urlVersion, versionDistante } from "../nouvelleVersion";

const lire = (p: string) => readFileSync(resolve(__dirname, "../../../..", p), "utf8");

describe("nouvelle version — détection (onglet resté sur une ancienne version)", () => {
  it("identifiant de build : commit court + horodatage, différent à chaque build", () => {
    expect(identifiantBuild("77765d6abcdef", 1_000)).toBe("77765d6-rs");
    expect(identifiantBuild(undefined, 1_000)).toBe("local-rs");
    expect(identifiantBuild("abc", 1_000)).not.toBe(identifiantBuild("abc", 2_000));
  });

  it("version.json : seule une chaîne « version » raisonnable est retenue", () => {
    expect(versionDistante({ version: "a1-b2" })).toBe("a1-b2");
    for (const x of [null, "a", 3, {}, { version: 4 }, { version: "" }, { version: "x".repeat(101) }]) expect(versionDistante(x)).toBeNull();
  });

  it("bandeau seulement si les deux versions sont connues ET différentes (jamais en dev)", () => {
    expect(nouvelleVersionDisponible("a", "b")).toBe(true);
    expect(nouvelleVersionDisponible("a", "a")).toBe(false);
    expect(nouvelleVersionDisponible(null, "b")).toBe(false);
    expect(nouvelleVersionDisponible("a", null)).toBe(false);
  });

  it("version.json lu à côté de index.html, sans cache (base Vite / GitHub Pages / aperçu)", () => {
    expect(urlVersion("/", 5)).toBe("/version.json?t=5");
    expect(urlVersion("/vraih2fleet/", 5)).toBe("/vraih2fleet/version.json?t=5");
    expect(urlVersion("./", 5)).toBe("./version.json?t=5");
    expect(urlVersion("/x", 5)).toBe("/x/version.json?t=5");
  });

  it("aucun rechargement automatique : seul le bouton du bandeau recharge", () => {
    const hook = lire("src/hooks/useNouvelleVersion.ts");
    expect(hook).not.toContain("reload");
    const bandeau = lire("src/components/layout/BandeauNouvelleVersion.tsx");
    expect(bandeau.match(/location\.reload\(\)/g)?.length).toBe(1);
    expect(bandeau).toMatch(/onClick=\{\(\) => window\.location\.reload\(\)\}/);
    expect(lire("src/App.tsx")).toContain("<BandeauNouvelleVersion />");
  });
});

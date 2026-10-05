import { describe, expect, it } from "vitest";
import { DEFAUTS_CATEGORIES, LISTE_HYPOTHESES } from "@/lib/tco";
import { ligneSource, numeroterSources, prixParCategorie, renvoiSource, urlSecable } from "../annexeSources";
import { libelleCategorie } from "../report";

describe("annexe du rapport : sources numérotées et prix par catégorie", () => {
  const reg = numeroterSources(LISTE_HYPOTHESES);

  it("chaque hypothèse renvoie à une source numérotée qui porte une URL https", () => {
    for (const h of LISTE_HYPOTHESES) {
      const n = reg.parHypothese.get(h.id);
      expect(n, h.id).toBeGreaterThan(0);
      const s = reg.sources[n! - 1];
      expect(s.numero).toBe(n);
      expect(s.url, h.id).toMatch(/^https:\/\//);
      expect(s.organisme).toBe(h.source.organisme);
    }
  });

  it("une même source n'est numérotée qu'une fois ; numéros continus", () => {
    const cles = reg.sources.map((s) => `${s.organisme}|${s.document}|${s.url}`);
    expect(new Set(cles).size).toBe(cles.length);
    reg.sources.forEach((s, i) => expect(s.numero).toBe(i + 1));
    const hq = LISTE_HYPOTHESES.filter((h) => h.source.organisme === "Hydro-Québec" && h.source.document.startsWith("Grille"));
    expect(new Set(hq.map((h) => reg.parHypothese.get(h.id))).size).toBe(1);
  });

  it("prix d'achat par catégorie : les 3 technologies, valeur dans sa plage, sources numérotées", () => {
    const lignes = prixParCategorie(reg, (c) => libelleCategorie(c, "fr"));
    expect(lignes).toHaveLength(Object.keys(DEFAUTS_CATEGORIES).length);
    for (const l of lignes) {
      for (const tech of ["diesel", "BEV", "FCEV"] as const) {
        expect(l.prix[tech].valeur).toBe(DEFAUTS_CATEGORIES[l.categorie].prixAchat[tech].valeur);
        expect(l.prix[tech].basse).toBeLessThanOrEqual(l.prix[tech].valeur);
        expect(l.prix[tech].haute).toBeGreaterThanOrEqual(l.prix[tech].valeur);
      }
      expect(l.sources.length).toBeGreaterThan(0);
    }
    const bus = lignes.find((l) => l.categorie === "autobus_urbain_12m")!;
    expect(bus.sources.some((n) => reg.sources[n - 1].url?.includes("newswire.ca"))).toBe(true);
  });

  it("liste lisible : renvoi, statut à valider, URL sécable sans changer le lien", () => {
    expect(renvoiSource([3, 4])).toBe("[3, 4]");
    const s = reg.sources.find((x) => x.aValider)!;
    expect(ligneSource(s, "fr")).toMatch(/^\[\d+\] .* — à valider$/);
    expect(ligneSource(s, "en")).toMatch(/to be validated$/);
    const u = "https://www150.statcan.gc.ca/t1/tbl1/fr/tv.action?pid=1810000101";
    expect(urlSecable(u).replace(/\u200b/g, "")).toBe(u);
    expect(urlSecable(u)).toContain("/\u200b");
  });
});

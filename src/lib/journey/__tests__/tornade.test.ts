import { describe, expect, it } from "vitest";
import { analyserSensibilite } from "@/lib/tco";
import { cas1, cas5 } from "@/lib/tco/__tests__/cas-de-reference";
import {
  echelleTornade,
  explicationStatuQuo,
  formaterValeurParametre,
  LIBELLES_PARAMETRES,
  libelleEcart,
  lignesTornade,
  lienParametre,
} from "../tornade";
import { lireCibleBibliotheque } from "@/lib/library/liens";

describe("tornade lisible", () => {
  const analyse = analyserSensibilite(cas5());

  it("une ligne par hypothèse, libellé complet, valeurs basse/haute dans leur unité et économie à chaque borne", () => {
    for (const langue of ["fr", "en"] as const) {
      const lignes = lignesTornade(analyse.tornade, langue);
      expect(lignes).toHaveLength(analyse.tornade.length);
      for (const [i, l] of lignes.entries()) {
        const b = analyse.tornade[i];
        expect(l.libelle).toBe(LIBELLES_PARAMETRES[langue][b.id]);
        expect(l.libelle).not.toMatch(/…|\(facteur\)|\(factor\)|BEV|FCEV/);
        expect(l.basse.valeur).not.toBe("—");
        expect(l.haute.valeur).not.toBe("—");
        expect(l.basse.van).toBe(b.vanBasse);
        expect(l.haute.van).toBe(b.vanHaute);
        expect(lireCibleBibliotheque(l.lien.slice(l.lien.indexOf("?")))).toBeTruthy();
      }
    }
  });

  it("toutes les hypothèses du stress test ont un libellé fr/en et un lien vers la Bibliothèque", () => {
    const ids = new Set([...analyserSensibilite(cas1()).tornade, ...analyse.tornade].map((b) => b.id));
    for (const id of ids) {
      expect(LIBELLES_PARAMETRES.fr[id]).toBeTruthy();
      expect(LIBELLES_PARAMETRES.en[id]).toBeTruthy();
      expect(lienParametre(id)).not.toBe("/dashboard/library");
    }
  });

  it("formats : $/L, écart en %, part, taux", () => {
    expect(formaterValeurParametre("prix_diesel", 1.8179, "fr")).toBe("1,82 $/L");
    expect(formaterValeurParametre("prix_diesel", 1.8179, "en")).toBe("$1.82/L");
    expect(formaterValeurParametre("prix_achat_alternative", 0.85, "fr")).toBe("−15 %");
    expect(formaterValeurParametre("capex_infrastructure", 1.6, "fr")).toBe("+60 %");
    expect(formaterValeurParametre("capex_infrastructure", 1, "en")).toBe("reference");
    expect(formaterValeurParametre("subventions", 0, "fr")).toBe("0 %");
    expect(formaterValeurParametre("taux_actualisation", 0.05, "fr")).toBe("5 %");
    expect(formaterValeurParametre("inflation_diesel", 0.025, "fr")).toBe("2,5 %");
    expect(formaterValeurParametre("prix_h2", undefined, "fr")).toBe("—");
  });

  it("échelle commune : englobe zéro, la valeur centrale et toutes les bornes", () => {
    const { min, max } = echelleTornade(analyse.tornade, analyse.vanCentrale);
    expect(min).toBeLessThanOrEqual(Math.min(0, analyse.vanCentrale));
    expect(max).toBeGreaterThanOrEqual(Math.max(0, analyse.vanCentrale));
    for (const b of analyse.tornade) {
      expect(b.vanBasse).toBeGreaterThanOrEqual(min);
      expect(b.vanHaute).toBeLessThanOrEqual(max);
    }
  });

  it("jamais une « économie » négative", () => {
    expect(libelleEcart(-5743218, "fr")).toMatch(/^Surcoût de 5\s743\s218\s\$$/);
    expect(libelleEcart(120000, "en")).toBe("Savings of $120,000");
  });

  it("statu quo expliqué par scénario, avec les valeurs du diesel réellement testées", () => {
    const diesel = analyse.tornade.find((b) => b.id === "prix_diesel")!;
    const prudent = explicationStatuQuo(analyse, "prudent", "fr");
    const favorable = explicationStatuQuo(analyse, "favorable", "fr");
    expect(prudent).toContain(formaterValeurParametre("prix_diesel", diesel.basse, "fr"));
    expect(prudent).toMatch(/moins cher/);
    expect(favorable).toContain(formaterValeurParametre("prix_diesel", diesel.haute, "fr"));
    expect(favorable).toMatch(/plus cher/);
    expect(explicationStatuQuo(analyse, "central", "en")).toContain(formaterValeurParametre("prix_diesel", diesel.centrale, "en"));
    // le TCO du statu quo suit bien ce sens dans le moteur
    expect(analyse.scenarios.prudent.tcoRef).toBeLessThan(analyse.scenarios.central.tcoRef);
    expect(analyse.scenarios.favorable.tcoRef).toBeGreaterThan(analyse.scenarios.central.tcoRef);
  });
});

import { describe, expect, it } from "vitest";
import { comparerLectures, empreinte, faitsSurveilles, texteDepuisHtml } from "../detection";
import { PROGRAMMES } from "@/lib/tco/subsidy-programs";

const page = (corps: string) => texteDepuisHtml(`<html><head><script>var x = "9 999 $";</script></head><body>${corps}</body></html>`);

describe("veille des subventions — détection déterministe (aucune IA, aucune application)", () => {
  it("faits surveillés : montants fr et en, dates fr/en/ISO, statuts ; scripts et horodatages ignorés", () => {
    const faits = faitsSurveilles(
      page(
        "<p>Jusqu'à 5 000 $ par véhicule ; enveloppe de 2,75 G$.</p><p>Up to $150,000 per vehicle.</p>" +
          "<p>Fin du programme : 31 mars 2027 (ou March 31, 2027) — 2026-12-31.</p>" +
          "<p>Le volet est fermé aux nouvelles demandes.</p><p>Date de modification : 2026-09-10</p>",
      ),
    );
    const par = (t: string) => faits.filter((f) => f.type === t).map((f) => f.valeur).sort();
    expect(par("montant")).toEqual(["150000", "2750000000", "5000"]);
    expect(par("date")).toEqual(["2026-12-31", "2027-03-31"]);
    expect(par("statut")).toEqual(["ferme"]);
    expect(faits.some((f) => f.valeur === "9999")).toBe(false);
  });

  it("première lecture : état initial, aucune détection", () => {
    expect(comparerLectures("pave", "https://x", null, faitsSurveilles(page("<p>5 000 $</p>")))).toEqual([]);
  });

  it("changement de montant et de statut : une détection par type, extraits avant → après, clé stable", () => {
    const avant = faitsSurveilles(page("<p>Incitatif maximal : 5 000 $.</p><p>Fin le 31 mars 2027.</p>"));
    const apres = faitsSurveilles(page("<p>Incitatif maximal : 4 000 $.</p><p>Fin le 31 mars 2027.</p><p>Programme fermé.</p>"));
    const d = comparerLectures("pave", "https://tc.canada.ca/x", avant, apres);
    expect(d.map((x) => x.type)).toEqual(["statut", "montant"]);
    const montant = d.find((x) => x.type === "montant")!;
    expect(montant.extraitAvant).toBe("Incitatif maximal : 5 000 $.");
    expect(montant.extraitApres).toBe("Incitatif maximal : 4 000 $.");
    expect(montant.retires.map((f) => f.valeur)).toEqual(["5000"]);
    expect(montant.ajoutes.map((f) => f.valeur)).toEqual(["4000"]);
    // même changement relu = même clé (jamais deux fois dans la file)
    expect(comparerLectures("pave", "https://tc.canada.ca/x", avant, apres)[1].cleDedoublonnage).toBe(montant.cleDedoublonnage);
    // rien ne change : aucune détection
    expect(comparerLectures("pave", "https://tc.canada.ca/x", apres, apres)).toEqual([]);
  });

  it("une page dont seul l'horodatage change ne produit rien", () => {
    const a = faitsSurveilles(page("<p>5 000 $</p><p>Date de modification : 2026-09-10</p>"));
    const b = faitsSurveilles(page("<p>5 000 $</p><p>Date de modification : 2026-10-05</p>"));
    expect(comparerLectures("pave", "https://x", a, b)).toEqual([]);
    expect(empreinte("abc")).toBe(empreinte("abc"));
    expect(empreinte("abc")).not.toBe(empreinte("abd"));
  });

  it("chaque programme du registre a une source officielle surveillable (https)", () => {
    for (const p of PROGRAMMES) expect(p.source.url).toMatch(/^https:\/\//);
  });
});

describe("brouillon de résumé (à corriger par l'administrateur)", () => {
  it("fr et en, montants formatés, statuts traduits", async () => {
    const { brouillonResume } = await import("../brouillon");
    expect(brouillonResume("PAVÉ", "montant", [{ type: "montant", valeur: "5000" }], [{ type: "montant", valeur: "4000" }], "fr")).toBe(
      "PAVÉ : changement de montant sur la page officielle — avant : 5 000 $ — maintenant : 4 000 $.",
    );
    expect(brouillonResume("EVAP", "statut", [], [{ type: "statut", valeur: "ferme" }], "en")).toBe("EVAP: status change on the official page — now: closed.");
  });
});

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

  it("statut : seulement s'il porte sur le programme (faux positifs réels du 2026-10-05 écartés)", () => {
    const statuts = (lignes: string[]) => faitsSurveilles(lignes.join("\n")).filter((f) => f.type === "statut").map((f) => f.valeur);
    // Écocamionnage volet 1 (page et PDF des modalités) : tiers, demande individuelle, navigation.
    expect(
      statuts([
        "Une attestation de Revenu Québec confirmant que le demandeur n’a pas de compte en souffrance en vertu des lois fiscales québécoises ou, s’il a un compte en souffrance, qu’il a conclu une entente de paiement qu’il respecte ou que le recouvrement de ses dettes a été légalement suspendu.",
        "paiement qu’il respecte ou que le recouvrement de ses dettes a été légalement suspendu. Si cette",
        "demande sera fermée, et le demandeur ne pourra pas obtenir son aide financière. Toutefois, le demandeur",
        "Gouvernement ouvert",
        // PIVEZ : condition, pas un état
        "que les fonds soient épuisés. La contribution de RNCan sera limitée à cinquante pour cent (50 %) des",
        "Les demandes sont acceptées jusqu’à épuisement des fonds.",
      ]),
    ).toEqual([]);
    // Vrais états du programme : bandeau en tête de ligne, ou sujet proche.
    expect(statuts(["Fermé aux demandes"])).toEqual(["ferme"]);
    expect(statuts(["Closed: Incentives for Medium- and Heavy-Duty Zero-Emission Vehicles"])).toEqual(["ferme"]);
    expect(statuts(["Le programme est suspendu pour les nouvelles demandes."])).toEqual(["suspendu"]);
    expect(statuts(["Le volet 1 est fermé aux nouvelles demandes."])).toEqual(["ferme"]);
    expect(statuts(["Les fonds du programme sont épuisés."])).toEqual(["epuise"]);
    expect(statuts(["The program is now open for applications."])).toEqual(["ouvert"]);
  });

  it("archives réelles du 2026-10-05 : plus aucun statut fautif sur Écocamionnage ; PIVEZ et iMHZEV fermés", async () => {
    const { readFileSync } = await import("node:fs");
    const statuts = (f: string) =>
      [...new Set(faitsSurveilles(readFileSync(`data/veille/2026-10-05/${f}.txt`, "utf8")).filter((x) => x.type === "statut").map((x) => x.valeur))];
    expect(statuts("ecocamionnage_v1")).toEqual([]);
    expect(statuts("ecocamionnage_v1_modalites")).toEqual([]);
    expect(statuts("pivez")).toEqual(["ferme"]);
    expect(statuts("imhzev")).toEqual(["ferme"]);
  });

  it("data/veille/etat.json = faits recalculés depuis les archives (référence de la prochaine comparaison)", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const etat = JSON.parse(readFileSync("data/veille/etat.json", "utf8")) as { sources: Record<string, { date: string; empreinte: string; faits: unknown[] }> };
    for (const [cle, src] of Object.entries(etat.sources)) {
      const archive = `data/veille/${src.date}/${cle.replace(/[:/]/g, "_")}.txt`;
      if (!existsSync(archive)) continue;
      const texte = readFileSync(archive, "utf8");
      expect(empreinte(texte), cle).toBe(src.empreinte);
      expect(src.faits, `${cle} : lancer scripts/veille/recalculer-etat.mjs`).toEqual(faitsSurveilles(texte));
    }
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

import { describe, expect, it } from "vitest";
import { LISTE_HYPOTHESES, PROGRAMMES, parametresStandards, parametresParDefaut, resoudreSubventions } from "@/lib/tco";
import { construireClasseurPlan } from "@/lib/journey/report";
import { construireStrategie } from "@/lib/journey/strategies";
import {
  HYPOTHESES_EN,
  PARAMETRES_STRESS_EN,
  PROGRAMMES_EN,
  cumulProgramme,
  descriptionHypothese,
  nomCourtProgramme,
  nomProgramme,
  traduireAvertissement,
  traduireDonneeClient,
  traduireLibelleSubvention,
} from "../translations-en";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };

describe("traductions anglaises du registre (E2)", () => {
  it("chaque hypothèse, programme et paramètre du stress test a son texte anglais", () => {
    for (const h of LISTE_HYPOTHESES) expect(HYPOTHESES_EN[h.id], h.id).toEqual(expect.any(String));
    for (const p of PROGRAMMES) {
      expect(PROGRAMMES_EN[p.id]?.nom, p.id).toEqual(expect.any(String));
      expect(PROGRAMMES_EN[p.id]?.cumul, p.id).toEqual(expect.any(String));
    }
    const params = parametresStandards({ parametres: parametresParDefaut(OPTIONS), vehicules: [], sitesInfra: [] });
    for (const p of params) expect(PARAMETRES_STRESS_EN[p.id], p.id).toEqual(expect.any(String));
  });

  it("le français reste la source : langue fr = texte d'origine", () => {
    const h = LISTE_HYPOTHESES[0];
    expect(descriptionHypothese(h.id, "fr")).toBe(h.description);
    expect(traduireAvertissement("n'importe quoi", "fr")).toBe("n'importe quoi");
  });

  it("les avertissements RÉELS du résolveur sortent en anglais, montants conservés", () => {
    const { avertissements } = resoudreSubventions({
      categorie: "camion_lourd",
      technologie: "BEV",
      prixAvantTaxes: 500000,
      typeOrganisme: "municipalite",
      anneeAchatCalendaire: 2026,
    });
    expect(avertissements.length).toBeGreaterThan(0);
    for (const a of avertissements) {
      const en = traduireAvertissement(a, "en");
      expect(en, a).not.toMatch(/ inconnue | réduite | est À VALIDER|inscription au Registre|barème dégressif/);
      const montants = a.match(/\d[\d\s]*(?= \$)/g) ?? [];
      for (const m of montants) expect(en.replace(/,/g, "")).toContain(m.replace(/\s/g, ""));
    }
  });

  it("libellés de subvention et données client traduits", () => {
    const pave = PROGRAMMES.find((p) => p.id === "pave")!;
    expect(traduireLibelleSubvention(`${pave.nom} — confirmée par le client (réf. LO-12)`, "en")).toBe(
      `${PROGRAMMES_EN.pave.nom} — confirmed by the client (ref. LO-12)`,
    );
    // Parcours E4 : la saisie Financement stocke le nom COURT du programme.
    const court = (nom: string) => nom.split("—")[0].trim();
    const pagtcp = PROGRAMMES.find((p) => p.id === "pagtcp")!;
    expect(traduireLibelleSubvention(`${court(pagtcp.nom)} — confirmée par le client (réf. Lettre 117)`, "en")).toBe(
      `${court(PROGRAMMES_EN.pagtcp.nom)} — confirmed by the client (ref. Lettre 117)`,
    );
    expect(traduireDonneeClient("prix du diesel payé ($/L avant TPS/TVQ) : donnée client (projet, 2026-09-01)", "en")).toBe(
      "diesel price paid ($/L before GST/QST): client data (project, 2026-09-01)",
    );
  });

  it("classeur Excel en anglais : onglets, entêtes et descriptions traduits", () => {
    const strategie = construireStrategie(
      [
        {
          id: "v1",
          category: "camionnette",
          fuel_type: "diesel",
          annual_km: 30000,
          consumption_per_100km: 16,
          consumption_source: "saisie",
          usage_profile: "urbain",
          replacement_year: 2028,
          target_technology: "bev",
        },
      ],
      "plan_actuel",
      OPTIONS,
    );
    const feuilles = construireClasseurPlan(
      strategie,
      new Map([["v1", "U-1"]]),
      { organisation: "Town", projet: "P", dateIso: "2026-09-30", anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05 },
      "en",
    );
    expect(feuilles.map((f) => f.nom)).toEqual(["Annual plan", "Vehicles", "Assumptions"]);
    expect(feuilles[0].lignes[4][0]).toBe("Year");
    const hyp = feuilles[2].lignes.find((l) => l[0] === "prix_diesel")!;
    expect(hyp[1]).toBe(HYPOTHESES_EN.prix_diesel);
  });
});

describe("modèles d'avertissements et aides (couverture complète)", () => {
  const cas: [string, RegExp][] = [
    ["X : le pourcentage du coût d'achat appliqué (25 %, borne basse prudente) est À VALIDER — la cellule correspondante du tableau officiel est vide.", /^X: the purchase-cost percentage applied \(25%/],
    ["PAVÉ : barème dégressif — …", /^EVAP: declining scale/],
    ["Écocamionnage : inscription au Registre des propriétaires…", /^Écocamionnage: registration/],
    ["X : aide réduite de 12 000 $ pour respecter le plafond de cumul des aides publiques (75 % des dépenses admissibles, art. 7.14.2).", /^X: aid reduced by \$12,000 .*75% of eligible/],
    ["X : classe de poids (PNBV) du véhicule inconnue — barème le plus bas des classes possibles retenu par prudence (5 000 $). Renseignez la classe de poids pour obtenir le barème exact.", /^X: vehicle weight class \(GVWR\) unknown .*\$5,000/],
    ["v1 : année d'acquisition (12) hors de l'horizon H=10 — véhicule sans effet sur le plan", /^v1: acquisition year \(12\) outside the horizon H=10/],
    ["v1 : subvention « S » versée après l'horizon (année 11) — ignorée", /^v1: subsidy “S” paid after the horizon \(year 11\) — ignored$/],
    ["site d1 : mise en service (11) hors de l'horizon H=10 — site sans effet sur le plan", /^site d1: commissioning \(11\) outside/],
    ["site d1 : subvention « S » après l'horizon — ignorée", /^site d1: subsidy “S” after the horizon — ignored$/],
    ["site d1 : technologies mixtes — répartition en parts égales", /^site d1: mixed technologies/],
  ];
  it.each(cas)("%s", (fr, attendu) => {
    expect(traduireAvertissement(fr, "en")).toMatch(attendu);
  });

  it("message inconnu : conservé (noms de programmes traduits), jamais supprimé", () => {
    const pave = PROGRAMMES.find((p) => p.id === "pave")!;
    expect(traduireAvertissement(`Note sur ${pave.nom}`, "en")).toBe(`Note sur ${PROGRAMMES_EN.pave.nom}`);
    expect(traduireLibelleSubvention("x", "fr")).toBe("x");
    expect(traduireDonneeClient("y", "fr")).toBe("y");
    expect(traduireDonneeClient("texte libre", "en")).toBe("texte libre");
    expect(traduireDonneeClient("champ inconnu : donnée client (organisation)", "en")).toBe("champ inconnu: client data (organization)");
  });

  it("noms, cumul et identifiants inconnus", () => {
    expect(nomProgramme("pave", "en")).toBe(PROGRAMMES_EN.pave.nom);
    expect(nomProgramme("pave", "fr")).toBe(PROGRAMMES.find((p) => p.id === "pave")!.nom);
    expect(nomCourtProgramme("pave", "en")).toBe("EVAP");
    expect(cumulProgramme("roulez_vert", "en")).toBe(PROGRAMMES_EN.roulez_vert.cumul);
    expect(cumulProgramme("roulez_vert", "fr")).toBe(PROGRAMMES.find((p) => p.id === "roulez_vert")!.cumul);
    expect(nomProgramme("inconnu", "en")).toBe("inconnu");
    expect(cumulProgramme("inconnu", "en")).toBe("");
    expect(descriptionHypothese("inconnue", "en")).toBe("inconnue");
    expect(descriptionHypothese("prix_diesel", "en")).toBe(HYPOTHESES_EN.prix_diesel);
  });
});

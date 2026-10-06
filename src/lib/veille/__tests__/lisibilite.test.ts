import { describe, expect, it } from "vitest";
import { enregistrerLecture, erreurCourte, etatLecture, type Lisibilite } from "../lisibilite";
import { PROGRAMMES } from "@/lib/tco/subsidy-programs";
import lisibiliteVeille from "../../../../data/veille/lisibilite.json";

const L = lisibiliteVeille as Lisibilite;
const prog = (id: string) => PROGRAMMES.find((p) => p.id === id)!;

describe("veille — lisibilité des sources et vérification manuelle (correctif du 2026-10-06)", () => {
  it("erreur courte : première ligne seulement (bannière Playwright retirée), 160 caractères au plus", () => {
    const brut =
      "HTTP 503 ; navigateur : browserType.launch: Executable doesn't exist\n╔══════╗\n║ Looks like Playwright… ║";
    expect(erreurCourte(brut)).toBe("HTTP 503 ; navigateur : browserType.launch: Executable doesn't exist");
    expect(erreurCourte("x".repeat(400))).toHaveLength(158);
    const l = enregistrerLecture({ sources: {} }, "ftcze", { url: "u", date: "2026-10-06", lu: false, erreur: brut });
    expect(l.sources.ftcze.erreur).not.toContain("\n");
  });

  it("état de lecture : lue, manuelle (dernier échec), jamais (adresse changée depuis)", () => {
    const l: Lisibilite = {
      sources: {
        a: { url: "https://a", date: "2026-10-05", lu: true, mode: "navigateur" },
        b: { url: "https://b", date: "2026-10-05", lu: false, erreur: "HTTP 403" },
      },
    };
    expect(etatLecture("a", "https://a", l)).toEqual({ etat: "lue", date: "2026-10-05", mode: "navigateur" });
    expect(etatLecture("b", "https://b", l)).toEqual({ etat: "manuelle", date: "2026-10-05", erreur: "HTTP 403" });
    expect(etatLecture("b", "https://b-nouvelle", l)).toEqual({ etat: "jamais" });
    expect(etatLecture("c", "https://c", l)).toEqual({ etat: "jamais" });
    expect(etatLecture("a", "https://a", null)).toEqual({ etat: "jamais" });
  });

  it("PAGTCP : source officielle LISIBLE (quebec.ca + modalités 2025-2028), plus l'ancienne page en 403", () => {
    const p = prog("pagtcp");
    expect(p.source.url).toBe("https://www.quebec.ca/transports/aide-financiere/collectif/transport-personnes");
    expect(p.modalitesUrl).toMatch(/pagtcp\/modalites-2025-2028\.pdf$/);
    expect(p.statutVerification).toBe("verifie");
    expect(p.dateVerification).toBe("2026-10-06");
    expect(p.dateFin).toBe("2028-03-31");
    // Montant par commande autorisée : jamais compté automatiquement (cas de référence inchangés).
    expect(p.baremes.every((b) => b.plafondParVehicule === 0)).toBe(true);
    // L'échec du 2026-10-05 (HTTP 403) portait sur l'ANCIENNE adresse : il ne compte plus.
    expect(etatLecture("pagtcp", p.source.url, L).etat).not.toBe("manuelle");
    expect(etatLecture("pagtcp", "https://www.transports.gouv.qc.ca/fr/aide-finan/transport-collectif/Pages/transport-collectif.aspx", {
      sources: { pagtcp: { url: p.source.url, date: "2026-10-06", lu: true } },
    }).etat).toBe("jamais");
  });

  it("FTCZE : relu par un vrai navigateur (repli de la veille), sinon vérification manuelle avec quoi lire", () => {
    const p = prog("ftcze");
    expect(p.lectureNavigateur).toBe(true);
    expect(p.quoiVerifier?.fr).toMatch(/maintenant terminée/);
    expect(p.quoiVerifier?.en).toMatch(/now closed/);
  });

  it("toute source en « vérification manuelle requise » dit EXACTEMENT quoi lire (fr et en)", () => {
    for (const p of PROGRAMMES) {
      if (etatLecture(p.id, p.source.url, L).etat !== "manuelle") continue;
      expect(p.quoiVerifier?.fr, p.id).toBeTruthy();
      expect(p.quoiVerifier?.en, p.id).toBeTruthy();
    }
  });
});

/**
 * Typographie des textes de l'interface : espaces insécables avant « : ; ! ? »
 * et à l'intérieur des guillemets « », pas de guillemets droits, nombres et
 * unités insécables (fr et en), pas de majuscules à l'anglaise (Title Case)
 * dans les libellés français. Correction automatique :
 * node scripts/typographie-fr.mjs
 */
import { describe, expect, it } from "vitest";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { corrigerEn, corrigerFr } from "../../../scripts/typographie-fr.mjs";

function valeurs(o: unknown, cle = ""): [string, string][] {
  if (typeof o === "string") return [[cle, o]];
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => valeurs(v, cle ? `${cle}.${k}` : k));
  return [];
}

// Noms propres, sigles et noms de pages ou d'étapes qui gardent leur majuscule.
const PROPRES = new Set(
  "Québec Hydro-Québec Canada Montréal Toronto Calgary Winnipeg Vancouver Ontario Paris France Dupont Jean H2Fleet Geotab Samsara Excel Word Claude Anthropic Rivière-Claire Roulez PAVÉ Écocamionnage Transport Express Inc. Gantt Flotte Organisation Bibliothèque Faisabilité Stratégies Plan Financement Rapports Suivi Accueil Projets Aide Ma Paramètres Notifications Lisez-moi Optimisée Économies Planner Calculator Nord Sud Est Ouest Union Innovation"
    .split(" "),
);

describe("typographie des textes de l'interface", () => {
  it("français : insécables avant « : ; ! ? », dans les guillemets, entre nombre et unité ; pas de guillemets droits", () => {
    const fautifs = valeurs(fr).filter(([, v]) => corrigerFr(v) !== v);
    expect(fautifs.map(([k, v]) => `${k} : ${v}`).slice(0, 10)).toEqual([]);
  });

  it("anglais : nombre et unité insécables", () => {
    const fautifs = valeurs(en).filter(([, v]) => corrigerEn(v) !== v);
    expect(fautifs.map(([k, v]) => `${k} : ${v}`).slice(0, 10)).toEqual([]);
  });

  it("français : pas de Title Case à l'anglaise dans les libellés courts", () => {
    const fautifs = valeurs(fr).filter(([, v]) => {
      if (v.length > 70) return false;
      const mots = v.split(/\s+/).filter(Boolean);
      // Majuscule en milieu de libellé, hors noms propres, sigles et début de phrase ou d'item.
      const suspects = mots.filter((m, i) => {
        if (i === 0 || /[.!?:•—–-]$/.test(mots[i - 1]) || /^[(«]/.test(m)) return false;
        const nu = m.replace(/^[(«"]+|[)»".,;:!?]+$/g, "");
        return /^[A-ZÉÈÀÂÎÔÛ][a-zéèêëàâîïôûç’'-]+$/.test(nu) && !PROPRES.has(nu) && !PROPRES.has(nu.split("-")[0]);
      });
      return suspects.length >= 2;
    });
    expect(fautifs.map(([k, v]) => `${k} : ${v}`)).toEqual([]);
  });
});

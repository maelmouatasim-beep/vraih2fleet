/**
 * E1 — Toute clé de traduction APPELÉE dans le code doit exister en
 * français ET en anglais, telle que l'application la voit (après la
 * fusion des espaces pages_*). Une clé absente affichait la clé brute ou
 * le texte de repli anglais dans l'interface française.
 * - clé statique t("a.b") : chaîne (ou liste pour returnObjects) ;
 * - clé dynamique t(`a.b.${x}`) : le préfixe fixe « a.b » doit exister.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "../locales/fr/translation.json";
import en from "../locales/en/translation.json";
import { normalizeTranslations, type TranslationDict } from "../normalize";

const RACINE = resolve(__dirname, "../..");
const LOCALES: Record<string, TranslationDict> = {
  fr: normalizeTranslations(fr as TranslationDict),
  en: normalizeTranslations(en as TranslationDict),
};

const lire = (d: unknown, cle: string): unknown =>
  cle.split(".").reduce<unknown>((o, p) => (o && typeof o === "object" ? (o as TranslationDict)[p] : undefined), d);

function* fichiers(dossier: string): Generator<string> {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom !== "__tests__" && nom !== "i18n") yield* fichiers(chemin);
    } else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) {
      yield chemin;
    }
  }
}

const APPEL = /(?<![\w$])t\(\s*(['"`])((?:(?!\1).)+?)\1/g;

export function clesUtilisees(source: string): { cle: string; dynamique: boolean }[] {
  const resultat: { cle: string; dynamique: boolean }[] = [];
  for (const m of source.matchAll(APPEL)) {
    const brute = m[2];
    if (brute.includes("${")) {
      // préfixe = segments COMPLETS avant l'interpolation (« faq.q${i} » → « faq »)
      const avant = brute.slice(0, brute.indexOf("${"));
      const prefixe = avant.endsWith(".") ? avant.slice(0, -1) : avant.slice(0, avant.lastIndexOf("."));
      if (/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_-]+)+$/.test(prefixe)) resultat.push({ cle: prefixe, dynamique: true });
    } else if (/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_-]+)+$/.test(brute)) {
      resultat.push({ cle: brute, dynamique: false });
    }
  }
  return resultat;
}

function manquantes(): string[] {
  const erreurs = new Set<string>();
  for (const f of fichiers(RACINE)) {
    for (const { cle, dynamique } of clesUtilisees(readFileSync(f, "utf8"))) {
      for (const [loc, dict] of Object.entries(LOCALES)) {
        const v = lire(dict, cle);
        const ok = dynamique
          ? v !== null && typeof v === "object" && !Array.isArray(v)
          : typeof v === "string" || Array.isArray(v);
        if (!ok) erreurs.add(`${loc}: ${cle}${dynamique ? ".*" : ""} (${f.replace(RACINE + "/", "")})`);
      }
    }
  }
  return [...erreurs].sort();
}

describe("clés i18n utilisées dans le code (E1)", () => {
  it("le détecteur trouve les clés statiques et les préfixes dynamiques (méta-test)", () => {
    const trouvees = clesUtilisees(
      't("a.b"); t(\'c.d\', "x"); t(`e.f.${g}`); t(`h.i.q${n}`); format(t2("z.z")); it("pas une clé")',
    );
    expect(trouvees).toEqual([
      { cle: "a.b", dynamique: false },
      { cle: "c.d", dynamique: false },
      { cle: "e.f", dynamique: true },
      { cle: "h.i", dynamique: true },
    ]);
  });

  it("aucune clé appelée n'est absente en fr ou en en", () => {
    const liste = manquantes();
    expect(liste, `clés manquantes :\n${liste.join("\n")}`).toEqual([]);
  });
});

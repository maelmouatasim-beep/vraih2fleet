#!/usr/bin/env node
/**
 * Typographie des textes de l'interface (src/i18n/locales/*\/translation.json).
 *
 * Français :
 *  - espace insécable avant « : » (U+00A0) et espace fine insécable avant
 *    « ; ! ? » (U+202F) ; ajoutée si la ponctuation est collée au mot ;
 *  - guillemets français « » avec espaces insécables à l'intérieur ;
 *    guillemets droits "…" remplacés par « … » ;
 *  - espace insécable entre un nombre (ou {{valeur}}) et son unité, et
 *    avant « % » et « $ ».
 * Anglais : espace insécable entre un nombre (ou {{valeur}}) et son unité.
 *
 *   node scripts/typographie-fr.mjs          # corrige les fichiers
 *   node scripts/typographie-fr.mjs --check  # échoue si une correction manque
 * Les mêmes règles sont vérifiées en CI (src/i18n/__tests__/typographie.test.ts).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const NBSP = "\u00a0";
const FINE = "\u202f";
const UNITES = "km|kW|kWh|MWh|GWh|kg|t|L|h|min|mi|mpg|g|tCO₂e|t CO₂e|¢";

/** Corrige un texte français. Idempotent. */
export function corrigerFr(s) {
  let r = s;
  // Guillemets droits → français (paires seulement).
  r = r.replace(/"([^"\n]+)"/g, `«${NBSP}$1${NBSP}»`);
  // Espaces intérieures des guillemets.
  r = r.replace(/«[ \u00a0\u202f]*/g, `«${NBSP}`).replace(/[ \u00a0\u202f]*»/g, `${NBSP}»`);
  // ; ! ? : espace fine insécable (remplace l'espace ordinaire, ou l'ajoute si collé).
  // Exclus : URL, « ?? », « !! » et « !== », points de suspension, dates/heures.
  r = r.replace(/([^\s\u00a0\u202f(«\[{/!?])([;!?])(?=[\s)»\]]|$)/g, `$1${FINE}$2`);
  r = r.replace(/[ \u00a0]([;!?])(?=[\s)»\]]|$)/g, `${FINE}$1`);
  // « : » : espace insécable — sauf heures (18:00), ratios (1:1), URL (https://) et clés ({{a}}:{{b}}).
  r = r.replace(/([^\s\u00a0\u202f\d(«\[{/:])(:)(?=[\s)»\]]|$)/g, `$1${NBSP}$2`);
  r = r.replace(/(\}\})(:)(?=\s|$)/g, `$1${NBSP}$2`);
  r = r.replace(/[ \u202f](:)(?=[\s)»\]]|$)/g, `${NBSP}$1`);
  // Nombres et unités, %, $.
  r = r.replace(new RegExp(`(\\d|\\}\\})[ ](${UNITES})(?=[\\s.,;:!?)/»\\u00a0\\u202f]|$)`, "g"), `$1${NBSP}$2`);
  r = r.replace(/(\d|\}\})[ ]?(%|\$)(?=[\s.,;:!?)/»\u00a0\u202f]|$)/g, `$1${NBSP}$2`);
  return r;
}

/** Corrige un texte anglais (unités seulement). Idempotent. */
export function corrigerEn(s) {
  return s.replace(new RegExp(`(\\d|\\}\\})[ ](${UNITES}|%)(?=[\\s.,;:!?)/\\u00a0]|$)`, "g"), `$1${NBSP}$2`);
}

function parcourir(o, f) {
  if (typeof o === "string") return f(o);
  if (Array.isArray(o)) return o.map((x) => parcourir(x, f));
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, parcourir(v, f)]));
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const verifier = process.argv.includes("--check");
  let changements = 0;
  for (const [langue, f] of [["fr", corrigerFr], ["en", corrigerEn]]) {
    const chemin = `src/i18n/locales/${langue}/translation.json`;
    const avant = readFileSync(chemin, "utf8");
    const apres = JSON.stringify(parcourir(JSON.parse(avant), f), null, 2) + "\n";
    if (apres !== avant) {
      const n = avant.split("\n").filter((l, i) => l !== apres.split("\n")[i]).length;
      changements += n;
      console.log(`${chemin} : ${n} ligne(s) ${verifier ? "à corriger" : "corrigée(s)"}`);
      if (!verifier) writeFileSync(chemin, apres);
    }
  }
  if (verifier && changements) process.exitCode = 1;
}

#!/usr/bin/env node
/**
 * Recalcule les faits surveillés de data/veille/etat.json à partir des
 * textes ARCHIVÉS (data/veille/<date>/<source>.txt), sans relire le réseau.
 * À lancer après une correction de l'extracteur (src/lib/veille/detection.ts)
 * pour que la prochaine comparaison hebdomadaire parte d'une référence juste
 * (ex. faux statut « suspendu » d'Écocamionnage volet 1, lecture du 2026-10-05).
 *
 *   node --experimental-strip-types scripts/veille/recalculer-etat.mjs [--verifier]
 *   --verifier : n'écrit rien, échoue si etat.json n'est pas à jour.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { empreinte, faitsSurveilles } from "../../src/lib/veille/detection.ts";

const ETAT = "data/veille/etat.json";
const verifier = process.argv.includes("--verifier");
const etat = JSON.parse(readFileSync(ETAT, "utf8"));
let changes = 0;
for (const [cle, src] of Object.entries(etat.sources)) {
  const archive = join("data/veille", src.date, `${cle.replace(/[:/]/g, "_")}.txt`);
  if (!existsSync(archive)) {
    console.log(`  ${cle} : archive absente (${archive}), inchangé`);
    continue;
  }
  const texte = readFileSync(archive, "utf8");
  if (empreinte(texte) !== src.empreinte) throw new Error(`${cle} : l'archive ne correspond pas à l'empreinte enregistrée`);
  const faits = faitsSurveilles(texte);
  const avant = JSON.stringify(src.faits);
  if (avant !== JSON.stringify(faits)) {
    changes++;
    const statuts = (fs) => [...new Set(fs.filter((f) => f.type === "statut").map((f) => f.valeur))].join(", ") || "aucun";
    console.log(`  ${cle} : statuts ${statuts(src.faits)} → ${statuts(faits)} ; ${src.faits.length} → ${faits.length} faits`);
    src.faits = faits;
  }
}
if (verifier) {
  if (changes) {
    console.error(`etat.json n'est pas à jour (${changes} source(s)) : lancer scripts/veille/recalculer-etat.mjs`);
    process.exit(1);
  }
  console.log("etat.json à jour.");
} else {
  writeFileSync(ETAT, JSON.stringify(etat, null, 2) + "\n");
  console.log(`${changes} source(s) recalculée(s).`);
}

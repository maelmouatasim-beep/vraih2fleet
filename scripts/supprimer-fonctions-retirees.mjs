#!/usr/bin/env node
/**
 * Supprime du projet Supabase HÉBERGÉ les edge functions retirées du dépôt
 * (scripts/fonctions-retirees.json) — étape idempotente du workflow
 * Deploy Supabase. Garde-fou : une fonction encore présente dans
 * supabase/functions/ n'est JAMAIS supprimée.
 *
 *   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/supprimer-fonctions-retirees.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const RETIREES = JSON.parse(readFileSync(new URL("./fonctions-retirees.json", import.meta.url), "utf8"));

/** Slugs à supprimer : déployés, retirés, et absents du dépôt. */
export function fonctionsASupprimer(deployees, retirees, depot) {
  return deployees.filter((slug) => slug in retirees && !depot.includes(slug));
}

export function fonctionsDuDepot(dossier = "supabase/functions") {
  return readdirSync(dossier).filter((d) => !d.startsWith("_") && statSync(join(dossier, d)).isDirectory());
}

async function principal() {
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!jeton || !ref) {
    console.log("::warning::SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF absents : rien à faire");
    return;
  }
  const api = (chemin, init = {}) =>
    fetch(`https://api.supabase.com/v1/projects/${ref}${chemin}`, { ...init, headers: { Authorization: `Bearer ${jeton}` } });
  const r = await api("/functions");
  if (!r.ok) throw new Error(`liste des fonctions : HTTP ${r.status}`);
  const deployees = (await r.json()).map((f) => f.slug);
  const cibles = fonctionsASupprimer(deployees, RETIREES, fonctionsDuDepot());
  if (!cibles.length) console.log(`Aucune fonction retirée déployée (${Object.keys(RETIREES).join(", ")}).`);
  for (const slug of cibles) {
    const d = await api(`/functions/${slug}`, { method: "DELETE" });
    if (!d.ok) throw new Error(`suppression de ${slug} : HTTP ${d.status}`);
    console.log(`Fonction retirée supprimée : ${slug} (${RETIREES[slug]})`);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
/**
 * Planifie (ou met à jour) les tâches pg_cron du projet hébergé à partir de
 * supabase/snippets/taches-planifiees.sql — étape idempotente du workflow
 * Deploy Supabase. Rien n'est planifié tant que les DEUX secrets du Vault
 * n'existent pas (h2fleet_project_url, h2fleet_cron_secret : saisis par le
 * propriétaire, docs/securite-secrets.md) ; aucune valeur n'est lue ni
 * affichée (seule leur présence est vérifiée).
 *
 *   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/taches-cron.mjs
 */
import { readFileSync } from "node:fs";
import { sqlHeberge } from "./lib/gestion-supabase.mjs";

export const SECRETS_VAULT = ["h2fleet_project_url", "h2fleet_cron_secret"];
export const SNIPPET = "supabase/snippets/taches-planifiees.sql";

/** Tâches déclarées par le snippet (noms des cron.schedule). */
export function tachesDuSnippet(sql) {
  return [...sql.matchAll(/cron\.schedule\(\s*'([^']+)'/g)].map((m) => m[1]);
}

async function principal() {
  if (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.SUPABASE_PROJECT_REF) {
    console.log("::warning::secrets de déploiement absents : tâches pg_cron non planifiées");
    return;
  }
  const presents = await sqlHeberge(
    `select name from vault.secrets where name in (${SECRETS_VAULT.map((n) => `'${n}'`).join(", ")})`,
  );
  const noms = new Set(presents.map((r) => r.name));
  const manquants = SECRETS_VAULT.filter((n) => !noms.has(n));
  if (manquants.length) {
    console.log(`::warning::tâches pg_cron non planifiées — secrets du Vault manquants : ${manquants.join(", ")} (docs/securite-secrets.md)`);
    return;
  }
  const sql = readFileSync(SNIPPET, "utf8");
  await sqlHeberge(sql);
  const actives = await sqlHeberge("select jobname from cron.job where jobname like 'h2fleet-%' and active");
  const attendues = tachesDuSnippet(sql);
  const absentes = attendues.filter((t) => !actives.some((a) => a.jobname === t));
  if (absentes.length) throw new Error(`tâches non planifiées : ${absentes.join(", ")}`);
  console.log(`Tâches pg_cron planifiées : ${attendues.join(", ")}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  principal().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}

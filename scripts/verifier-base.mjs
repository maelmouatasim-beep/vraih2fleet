#!/usr/bin/env node
/**
 * Contrôle de santé d'une base Supabase contre le schéma ATTENDU du dépôt
 * (supabase/schema-attendu.json : tables + RLS, policies, fonctions SQL,
 * triggers, buckets — tel que produit par TOUTES les migrations).
 *
 *   node scripts/verifier-base.mjs --generer   # local : régénère le manifeste
 *   node scripts/verifier-base.mjs --local     # local : manifeste à jour ? (CI)
 *   node scripts/verifier-base.mjs --heberge   # projet hébergé (workflow Deploy Supabase)
 *
 * Local : SQL via psql (SUPABASE_DB_URL / DB_URL, défaut 127.0.0.1:54322).
 * Hébergé : API de gestion Supabase avec SUPABASE_ACCESS_TOKEN et
 * SUPABASE_PROJECT_REF (secrets GitHub — jamais dans le dépôt ni le chat) ;
 * vérifie en plus les edge functions déployées (et leur verify_jwt), les
 * secrets de fonctions requis (NOMS seulement), la config d'auth (URL de
 * redirection GitHub Pages) et les tâches pg_cron.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { api, exigerEnv, sqlHeberge } from "./lib/gestion-supabase.mjs";

const MANIFESTE = "supabase/schema-attendu.json";
const URL_PAGES = "https://maelmouatasim-beep.github.io/vraih2fleet/";
const SECRETS_REQUIS = ["ALLOWED_ORIGINS", "CRON_SECRET", "INTERNAL_FUNCTION_SECRET"];
const SECRETS_OPTIONNELS = ["SENDGRID_API_KEY", "CONTACT_INBOX_EMAIL", "APP_BASE_URL", "MAPBOX_PUBLIC_TOKEN", "ANTHROPIC_API_KEY"];
// Créées par la plateforme Supabase elle-même sur les nouveaux projets
// (option « RLS automatique ») : ni attendues ni signalées.
const OBJETS_PLATEFORME = { fonctions: ["rls_auto_enable"] };
const TACHES_CRON = ["h2fleet-notify-subsidy-deadlines", "h2fleet-sync-telematics", "h2fleet-purge-rate-limit"];

const INVENTAIRE_SQL = `
select json_build_object(
  'tables', (select coalesce(json_agg(c.relname || case when c.relrowsecurity then ' [rls]' else ' [SANS RLS]' end order by c.relname), '[]')
             from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p')),
  'policies', (select coalesce(json_agg(schemaname || '.' || tablename || ' : ' || policyname order by 1), '[]')
               from pg_policies where schemaname in ('public','storage')),
  'fonctions', (select coalesce(json_agg(distinct p.proname), '[]')
                from pg_proc p where p.pronamespace = 'public'::regnamespace),
  'triggers', (select coalesce(json_agg(distinct c.relname || ' : ' || t.tgname), '[]')
               from pg_trigger t join pg_class c on c.oid = t.tgrelid
               where not t.tgisinternal and c.relnamespace = 'public'::regnamespace),
  'buckets', (select coalesce(json_agg(id order by id), '[]') from storage.buckets)
) as inventaire`;

const trier = (inv) => Object.fromEntries(Object.entries(inv).map(([k, v]) => [k, [...(v ?? [])].sort()]));

// ── Accès SQL ───────────────────────────────────────────────────────────
function sqlLocal(sql) {
  const url = process.env.SUPABASE_DB_URL ?? process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  return execFileSync("psql", [url, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" }).trim();
}

// ── Comparaison ─────────────────────────────────────────────────────────
function difference(attendu, reel) {
  const manquants = {};
  const enTrop = {};
  for (const cle of Object.keys(attendu)) {
    const r = new Set(reel[cle] ?? []);
    const a = new Set(attendu[cle]);
    const m = attendu[cle].filter((x) => !r.has(x));
    const t = (reel[cle] ?? []).filter((x) => !a.has(x));
    if (m.length) manquants[cle] = m;
    if (t.length) enTrop[cle] = t;
  }
  return { manquants, enTrop };
}

function afficher(titre, obj) {
  for (const [cle, liste] of Object.entries(obj)) {
    console.log(`  ${titre} ${cle} (${liste.length}) :`);
    for (const x of liste.slice(0, 40)) console.log(`    - ${x}`);
    if (liste.length > 40) console.log(`    … ${liste.length - 40} de plus`);
  }
}

function lireVerifyJwt() {
  const toml = readFileSync("supabase/config.toml", "utf8");
  const res = {};
  for (const m of toml.matchAll(/\[functions\.([a-z0-9-]+)\]\s*\n\s*verify_jwt\s*=\s*(true|false)/g)) res[m[1]] = m[2] === "true";
  return res;
}

function fonctionsDuDepot() {
  return readdirSync("supabase/functions")
    .filter((d) => !d.startsWith("_") && statSync(join("supabase/functions", d)).isDirectory())
    .sort();
}

// ── Modes ───────────────────────────────────────────────────────────────
const mode = process.argv[2];
let echecs = 0;
const ko = (m) => {
  echecs++;
  console.log(`✘ ${m}`);
};
const ok = (m) => console.log(`✔ ${m}`);
const attention = (m) => console.log(`⚠ ${m}`);

if (mode === "--generer") {
  const inv = trier(JSON.parse(sqlLocal(INVENTAIRE_SQL)));
  writeFileSync(MANIFESTE, JSON.stringify(inv, null, 2) + "\n");
  console.log(`${MANIFESTE} régénéré : ${Object.entries(inv).map(([k, v]) => `${v.length} ${k}`).join(", ")}`);
} else if (mode === "--local" || mode === "--heberge") {
  const attendu = JSON.parse(readFileSync(MANIFESTE, "utf8"));
  const brut = mode === "--local" ? JSON.parse(sqlLocal(INVENTAIRE_SQL)) : (await sqlHeberge(INVENTAIRE_SQL))[0].inventaire;
  const reel = trier(typeof brut === "string" ? JSON.parse(brut) : brut);
  for (const [cle, noms] of Object.entries(OBJETS_PLATEFORME)) reel[cle] = (reel[cle] ?? []).filter((x) => !noms.includes(x));
  const { manquants, enTrop } = difference(attendu, reel);

  if (Object.keys(manquants).length) {
    ko("schéma : éléments attendus ABSENTS de la base");
    afficher("manquant —", manquants);
  } else ok(`schéma : ${attendu.tables.length} tables, ${attendu.policies.length} policies, ${attendu.fonctions.length} fonctions, ${attendu.triggers.length} triggers présents`);
  const sansRls = reel.tables.filter((t) => t.endsWith("[SANS RLS]"));
  if (sansRls.length) ko(`tables SANS RLS : ${sansRls.join(", ")}`);
  if (Object.keys(enTrop).length) {
    // Local : le manifeste doit refléter exactement les migrations.
    if (mode === "--local") {
      ko(`${MANIFESTE} n'est plus à jour : lancez « node scripts/verifier-base.mjs --generer » après supabase db reset`);
    } else attention("éléments présents en base mais absents du dépôt (créés à la main ?)");
    afficher("en plus —", enTrop);
  }

  if (mode === "--heberge") {
    const ref = exigerEnv("SUPABASE_PROJECT_REF");

    // Edge functions déployées + verify_jwt conforme à config.toml
    const deployees = await api(`/projects/${ref}/functions`);
    const parSlug = new Map(deployees.map((f) => [f.slug, f]));
    const verify = lireVerifyJwt();
    for (const nom of fonctionsDuDepot()) {
      const f = parSlug.get(nom);
      if (!f) ko(`fonction ${nom} non déployée`);
      else if (f.status !== "ACTIVE") ko(`fonction ${nom} : statut ${f.status}`);
      else if (nom in verify && f.verify_jwt !== verify[nom]) ko(`fonction ${nom} : verify_jwt=${f.verify_jwt}, attendu ${verify[nom]} (config.toml)`);
      else ok(`fonction ${nom} déployée (verify_jwt=${f.verify_jwt})`);
    }
    if (parSlug.has("calculate-tco")) ko("l'ancienne fonction calculate-tco est encore déployée (supabase functions delete calculate-tco)");

    // Secrets des fonctions : NOMS uniquement (les valeurs ne sont jamais lues)
    const secrets = new Set((await api(`/projects/${ref}/secrets`)).map((s) => s.name));
    for (const s of SECRETS_REQUIS) (secrets.has(s) ? ok : ko)(`secret de fonction ${s} ${secrets.has(s) ? "défini" : "MANQUANT"}`);
    for (const s of SECRETS_OPTIONNELS) if (!secrets.has(s)) attention(`secret optionnel ${s} non défini`);

    // Auth : URL du site + redirections GitHub Pages
    const auth = await api(`/projects/${ref}/config/auth`);
    const liste = String(auth.uri_allow_list ?? "");
    if (!String(auth.site_url ?? "").startsWith(URL_PAGES)) ko(`auth : Site URL = « ${auth.site_url} », attendu ${URL_PAGES}`);
    else ok("auth : Site URL = GitHub Pages");
    if (!liste.includes("maelmouatasim-beep.github.io/vraih2fleet")) ko(`auth : ${URL_PAGES}** absent des Redirect URLs`);
    else ok("auth : GitHub Pages dans les Redirect URLs");

    // pg_cron
    const taches = await sqlHeberge("select jobname, schedule, active from cron.job order by jobname");
    const noms = new Set(taches.map((t) => t.jobname));
    for (const t of TACHES_CRON) (noms.has(t) ? ok : attention)(`tâche pg_cron ${t} ${noms.has(t) ? "planifiée" : "absente (supabase/snippets/taches-planifiees.sql)"}`);
  }

  console.log(echecs ? `\n${echecs} problème(s).` : "\nBase conforme au dépôt.");
  process.exitCode = echecs ? 1 : 0;
} else {
  console.error("usage : node scripts/verifier-base.mjs --generer | --local | --heberge");
  process.exitCode = 2;
}

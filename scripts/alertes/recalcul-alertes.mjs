#!/usr/bin/env node
/**
 * Recalcul planifié des alertes du plan (côté serveur) — lanceur Node.
 * Charge src/lib/journey/recalculAlertesServeur.ts par Vite (alias « @ »,
 * JSON, TypeScript : le MÊME code que l'écran) avec un client service_role.
 *
 *   node scripts/alertes/recalcul-alertes.mjs --local     # Supabase local (supabase status -o env exporté)
 *   node scripts/alertes/recalcul-alertes.mjs --heberge   # SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF
 *   … [--projet <uuid>] [--verifier-aucun-changement]
 *
 * La clé service_role n'est jamais écrite : en mode hébergé elle est lue
 * via l'API de gestion Supabase, masquée dans les journaux GitHub
 * (::add-mask::), et ne sert qu'à ce processus.
 */
import { createServer } from "vite";

const args = process.argv.slice(2);
const mode = args.includes("--heberge") ? "heberge" : "local";
const projet = args.includes("--projet") ? args[args.indexOf("--projet") + 1] : null;
const verifierStable = args.includes("--verifier-aucun-changement");

async function cleHebergee() {
  const jeton = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!jeton || !ref) return null;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${jeton}` },
  });
  if (!r.ok) throw new Error(`clés du projet : HTTP ${r.status}`);
  const cles = await r.json();
  const cle = cles.find((c) => c.name === "service_role")?.api_key ?? cles.find((c) => c.type === "secret")?.api_key;
  if (!cle) throw new Error("clé service_role introuvable");
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${cle}`);
  return { url: `https://${ref}.supabase.co`, cle };
}

async function principal() {
  let cible;
  if (mode === "heberge") {
    cible = await cleHebergee();
    if (!cible) {
      console.log("::warning::SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF absents : recalcul ignoré");
      return;
    }
  } else {
    const url = process.env.API_URL ?? process.env.SUPABASE_URL;
    const cle = process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !cle) throw new Error("exporter `supabase status -o env` (API_URL, SERVICE_ROLE_KEY)");
    if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`--local refuse une URL distante : ${url}`);
    cible = { url, cle };
  }
  // Client du module = client service_role, pour CE processus seulement.
  process.env.VITE_SUPABASE_URL = cible.url;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = cible.cle;
  process.env.VITE_SUPABASE_PROJECT_ID = mode === "heberge" ? process.env.SUPABASE_PROJECT_REF : "local";

  const vite = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, ws: false },
    resolve: { alias: { "@": new URL("../../src", import.meta.url).pathname } },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const mod = await vite.ssrLoadModule("/src/lib/journey/recalculAlertesServeur.ts");
    const r = await mod.recalculerAlertes({ projets: projet ? [projet] : undefined });
    for (const p of r.projets) {
      console.log(`${p.erreur ? "✘" : "✔"} projet ${p.projet} : ${p.alertes} alerte(s), ${p.nouvelles} nouvelle(s), ${p.resolues} résolue(s)${p.erreur ? ` — ${p.erreur}` : ""}`);
    }
    const changements = r.projets.reduce((s, p) => s + p.nouvelles + p.resolues, 0);
    console.log(`\n${r.projets.length} projet(s) recalculé(s) le ${r.date}, ${changements} changement(s), ${r.erreurs} erreur(s).`);
    if (r.erreurs) process.exitCode = 1;
    if (verifierStable && changements) {
      console.error("ÉCHEC : le recalcul serveur diffère de l'écran (alertes nouvelles ou résolues).");
      process.exitCode = 1;
    }
  } finally {
    await vite.close();
  }
}

principal().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});

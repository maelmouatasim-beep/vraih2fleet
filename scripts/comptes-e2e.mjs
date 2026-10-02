#!/usr/bin/env node
/**
 * Comptes du parcours e2e sur le projet Supabase HÉBERGÉ de test
 * (workflow « E2E base hébergée » — jamais à la main, jamais en production).
 *
 *   node scripts/comptes-e2e.mjs creer      # 2 comptes confirmés → $GITHUB_ENV
 *   node scripts/comptes-e2e.mjs supprimer  # supprime TOUS les comptes e2e-…@example.com
 *
 * Environnement : SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF (secrets
 * GitHub). La clé service_role est lue via l'API de gestion, masquée dans
 * les journaux et jamais écrite sur disque ; le mot de passe des comptes
 * est aléatoire et masqué.
 *
 * Nettoyage borné aux adresses e2e-%@example.com : d'abord leurs
 * organisations (seulement celles dont TOUS les membres sont des comptes
 * e2e — cascade flotte, invitations, données énergie), puis les comptes
 * (cascade projets, tâches, profils).
 */
import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { api, exigerEnv as env, sqlHeberge } from "./lib/gestion-supabase.mjs";
import { SQL_NETTOYAGE_COMPTES, SQL_NETTOYAGE_ORGANISATIONS } from "./lib/nettoyage-e2e.mjs";

async function cleServiceRole(ref) {
  const cles = await api(`/projects/${ref}/api-keys?reveal=true`);
  const cle = cles.find((c) => c.name === "service_role")?.api_key ?? cles.find((c) => c.type === "secret")?.api_key;
  if (!cle) throw new Error("clé service_role / secret introuvable");
  console.log(`::add-mask::${cle}`);
  return cle;
}

function exporter(nom, valeur, masquer = false) {
  if (masquer) console.log(`::add-mask::${valeur}`);
  if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${nom}=${valeur}\n`);
}

const action = process.argv[2];
const ref = env("SUPABASE_PROJECT_REF");

if (action === "creer") {
  const admin = createClient(`https://${ref}.supabase.co`, await cleServiceRole(ref), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffixe = `${process.env.GITHUB_RUN_ID ?? Date.now()}-${randomBytes(3).toString("hex")}`;
  const mdp = `E2e-${randomBytes(12).toString("base64url")}9`;
  exporter("E2E_MDP", mdp, true);
  for (const [variable, role, nom] of [
    ["E2E_COURRIEL_A", "admin", "Admin Parcours"],
    ["E2E_COURRIEL_B", "coequipier", "Coéquipier Parcours"],
  ]) {
    const email = `e2e-${role}-${suffixe}@example.com`;
    const { error } = await admin.auth.admin.createUser({
      email,
      password: mdp,
      email_confirm: true,
      user_metadata: { full_name: nom },
    });
    if (error) throw new Error(`création ${email} : ${error.message}`);
    exporter(variable, email);
    console.log(`compte créé : ${email}`);
  }
} else if (action === "supprimer") {
  const [{ n: orgs }] = await sqlHeberge(SQL_NETTOYAGE_ORGANISATIONS);
  let resultat = [];
  for (const sql of SQL_NETTOYAGE_COMPTES) resultat = await sqlHeberge(sql);
  const [{ n: comptes }] = resultat;
  console.log(`nettoyage e2e : ${orgs} organisation(s), ${comptes} compte(s) supprimés`);
} else {
  console.error("usage : node scripts/comptes-e2e.mjs creer | supprimer");
  process.exitCode = 2;
}

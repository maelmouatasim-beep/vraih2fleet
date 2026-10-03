#!/usr/bin/env node
/**
 * Administration du projet Supabase HÉBERGÉ de test (workflow « Deploy
 * Supabase », étape « Administrateur H2Fleet et fonctions IA »).
 *
 * Pour le compte dont l'adresse est dans le secret GitHub
 * H2FLEET_ADMIN_EMAIL (jamais écrite dans le dépôt, un commit ni les
 * journaux) :
 *  1. rôle « admin » H2Fleet (user_roles) — file de la veille des
 *     subventions, Bibliothèque › Veille ;
 *  2. les quatre fonctions IA activées (copilote, import intelligent,
 *     lecture de factures et devis, note au conseil) pour chaque
 *     organisation dont ce compte est administrateur, avec des quotas de
 *     test (2 000 000 jetons par mois, 200 requêtes par jour) à la
 *     création ; des quotas existants ne sont pas modifiés, sauf s'ils
 *     valent 0.
 * IDEMPOTENT : rejouer le script ne change rien de plus. Il ne fait
 * qu'ACTIVER : pour désactiver durablement une fonction, retirer le secret
 * après l'activation (sinon elle est réactivée au déploiement suivant).
 *
 * Environnement : H2FLEET_ADMIN_EMAIL, SUPABASE_ACCESS_TOKEN,
 * SUPABASE_PROJECT_REF (secrets GitHub). Sans H2FLEET_ADMIN_EMAIL : rien.
 */
import { randomBytes } from "node:crypto";
import { sqlHeberge } from "./lib/gestion-supabase.mjs";

/** Valeur insérée dans le SQL sous forme de chaîne « dollar-quoted » à
 *  étiquette aléatoire absente de la valeur : aucune injection possible. */
export function litteral(valeur) {
  let tag;
  do tag = `v_${randomBytes(6).toString("hex")}`;
  while (valeur.includes(tag));
  return `$${tag}$${valeur}$${tag}$`;
}

export const QUOTAS_TEST = { jetonsParMois: 2_000_000, requetesParJour: 200 };

export function requeteAdmin(courriel) {
  const c = litteral(courriel.trim());
  return `with u as (
  select id from auth.users where lower(email) = lower(${c}) limit 1
), deja as (
  select count(*) as n from public.user_roles r join u on u.id = r.user_id where r.role = 'admin'
), role as (
  insert into public.user_roles (user_id, role)
  select id, 'admin' from u
  on conflict (user_id, role) do nothing
  returning 1
), orgs as (
  select m.organization_id from public.organization_members m join u on u.id = m.user_id where m.role = 'admin'
), ia as (
  insert into public.organization_ai_settings
    (organization_id, copilot_enabled, smart_import_enabled, document_reading_enabled, council_note_enabled, monthly_token_limit, daily_request_limit)
  select organization_id, true, true, true, true, ${QUOTAS_TEST.jetonsParMois}, ${QUOTAS_TEST.requetesParJour} from orgs
  on conflict (organization_id) do update set
    copilot_enabled = true,
    smart_import_enabled = true,
    document_reading_enabled = true,
    council_note_enabled = true,
    monthly_token_limit = case when public.organization_ai_settings.monthly_token_limit = 0 then excluded.monthly_token_limit else public.organization_ai_settings.monthly_token_limit end,
    daily_request_limit = case when public.organization_ai_settings.daily_request_limit = 0 then excluded.daily_request_limit else public.organization_ai_settings.daily_request_limit end
  returning organization_id, monthly_token_limit, daily_request_limit
)
select
  (select count(*) from u)::int as compte_trouve,
  ((select n from deja) + (select count(*) from role))::int as role_admin,
  (select count(*) from role)::int as role_ajoute,
  (select count(*) from ia)::int as organisations_activees,
  coalesce((select min(monthly_token_limit) from ia), 0)::int as jetons_mois_min,
  coalesce((select min(daily_request_limit) from ia), 0)::int as requetes_jour_min`;
}

async function principal() {
  const courriel = process.env.H2FLEET_ADMIN_EMAIL?.trim();
  if (!courriel) {
    console.log("::notice::H2FLEET_ADMIN_EMAIL absent : aucun administrateur H2Fleet ni activation IA (étape ignorée).");
    return;
  }
  // Masqué dans les journaux, y compris sous sa forme en minuscules.
  console.log(`::add-mask::${courriel}`);
  console.log(`::add-mask::${courriel.toLowerCase()}`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) throw new Error("H2FLEET_ADMIN_EMAIL n'a pas la forme d'une adresse courriel.");

  const [r] = await sqlHeberge(requeteAdmin(courriel));
  if (!r || r.compte_trouve === 0) {
    console.log("::warning::Aucun compte avec l'adresse du secret H2FLEET_ADMIN_EMAIL : créer le compte sur le site de test puis relancer le workflow.");
    return;
  }
  console.log(
    `Administrateur H2Fleet : ${r.role_admin > 0 ? "oui" : "non"}${r.role_ajoute ? " (rôle ajouté)" : " (déjà en place)"} ; ` +
      `fonctions IA activées (copilote, import intelligent, factures et devis, note au conseil) pour ${r.organisations_activees} organisation(s) ; ` +
      `quotas : ${r.jetons_mois_min} jetons par mois, ${r.requetes_jour_min} requêtes par jour (minimum).`,
  );
  if (r.organisations_activees === 0) {
    console.log("::warning::Ce compte n'administre aucune organisation : rien à activer.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal().catch((e) => {
    // Le message d'erreur ne contient jamais l'adresse (requête non journalisée).
    console.error(`::error::${String(e.message ?? e).replace(process.env.H2FLEET_ADMIN_EMAIL ?? "\u0000", "***")}`);
    process.exit(1);
  });
}

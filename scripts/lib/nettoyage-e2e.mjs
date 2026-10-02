/**
 * SQL de nettoyage des comptes du parcours e2e (adresses e2e-%@example.com
 * UNIQUEMENT). Testé contre Supabase local (voir docs/deploiement.md).
 */
const MOTIF = "e2e-%@example.com";

/** Organisations dont TOUS les membres sont des comptes e2e (cascade flotte…). */
export const SQL_NETTOYAGE_ORGANISATIONS = `
with e2e as (select id from auth.users where email like '${MOTIF}'),
cibles as (
  select distinct m.organization_id as id from public.organization_members m
  where m.user_id in (select id from e2e)
    and not exists (
      select 1 from public.organization_members m2
      where m2.organization_id = m.organization_id and m2.user_id not in (select id from e2e))
),
sup as (delete from public.organizations o using cibles c where o.id = c.id returning 1)
select count(*)::int as n from sup`;

const E2E = `(select id from auth.users where email like '${MOTIF}')`;

/**
 * Comptes e2e, en PLUSIEURS requêtes dans cet ordre : supprimer
 * directement les comptes échoue — Postgres vérifie tasks.created_by
 * (NO ACTION) avant que la cascade comptes → projets → tâches ait fini.
 * 1. projets des comptes e2e (cascade tâches, véhicules du projet…) ;
 * 2. traces restantes créées par ces comptes (tâches, commentaires,
 *    pièces jointes) ; 3. les comptes (cascade profils, rôles).
 * La dernière requête renvoie le nombre de comptes supprimés.
 */
export const SQL_NETTOYAGE_COMPTES = [
  `delete from public.projects where user_id in ${E2E}`,
  `delete from public.task_comments where user_id in ${E2E}`,
  `delete from public.task_attachments where uploaded_by in ${E2E}`,
  `delete from public.tasks where created_by in ${E2E}`,
  `with sup as (delete from auth.users where email like '${MOTIF}' returning 1)
select count(*)::int as n from sup`,
];

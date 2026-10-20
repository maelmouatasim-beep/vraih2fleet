# ADR 0003 — PostgreSQL (Supabase utilisé comme Postgres standard), Drizzle, RLS par contexte de transaction

Statut : accepté (validé par le fondateur, 2026-10-20)

## Décision

- Supabase en région UE (Paris ou Francfort, **à confirmer par l'avocat**),
  utilisé uniquement comme Postgres + stockage S3 + sauvegardes PITR. Ni
  Supabase Auth ni supabase-js : migration possible vers un hébergeur
  marocain sans réécriture.
- Drizzle ORM ; migrations versionnées (`packages/db/migrations`) : SQL
  généré pour les tables, SQL écrit à la main pour rôles, fonctions,
  policies et triggers (`0001_security.sql`).
- Trois rôles : propriétaire (migrations, seed), `lp_auth` (Better-Auth :
  policies `USING (true)` sur les seules tables `identity`, aucun accès au
  journal), `lp_app` (application, sans BYPASSRLS, lecture seule de
  l'identité en phase 1). Rôles créés NOLOGIN par migration ; mot de passe
  posé par environnement.
- Contexte : `withActor(db, actor, fn)` ouvre une transaction et pose
  `app.user_id`, `app.organization_id`, IP, agent, trace par
  `set_config(..., true)` — compatible avec le pooler en mode transaction
  (`prepare: false`). Les policies reposent sur l'**appartenance**
  (`app.is_member`, `app.has_platform_role`), jamais sur l'organisation
  déclarée dans le contexte : un `organization_id` forgé n'ouvre rien
  (test dédié).

## Conséquences

Oublier `withActor` ne fuit rien (aucune ligne). Chaque nouvelle table
multi-tenant arrive avec ses policies et ses tests d'isolation.

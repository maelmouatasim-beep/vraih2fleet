# Phase 1 — Fondations (livrée le 2026-10-20, en attente du feu vert)

## Livré

- Monorepo pnpm + Turborepo, TypeScript strict (aucun `any`), ESLint
  strict-type-checked + jsx-a11y strict, Prettier, versions ≥ 14 jours.
- CI `.github/workflows/leaseplace-ci.yml` : audit des dépendances, format,
  lint, types, tests (dont RLS sur Postgres 16), build, seed, e2e.
- Design system : tokens clair/sombre (55 contrôles de contraste AA),
  composants, motif zellige, logo.
- Auth Better-Auth : PME par code ou lien magique ; bailleurs et plateforme
  par mot de passe + TOTP obligatoire (enrôlement imposé) ; limitation de
  débit persistée ; inscription fermée.
- Organisations typées, rôles par type (trigger), RBAC dans `domain`
  (100 % de couverture), gardes d'espace serveur, refus audités.
- RLS : rôles `lp_app` / `lp_auth`, contexte de transaction ; 12 tests
  d'isolation (bailleur A ≠ bailleur B, sans contexte = rien, contexte
  forgé, privilèges).
- Journal d'audit append-only chaîné SHA-256, visible au back-office avec
  l'état de la chaîne.
- i18n fr (défaut) / ar (RTL) / en ; parité et typographie testées.
- 3 espaces vides mais stylés, palette ⌘K (bailleur, admin), mode démo.

## Tests : 19 (db) + 19 (domain) + 13 (intégrations) + 55 (ui) + 24 (web) unitaires, 17 e2e.

## Dette technique

- CSP à nonce ⇒ rendu dynamique partout (ADR 0007, à revoir en phase 3).
- Rate limit Better-Auth : clé par IP (`x-forwarded-for`) ; à valider
  derrière l'hébergeur réel.
- Mots de passe des rôles `lp_app` / `lp_auth` à poser à la main sur
  l'hébergement (procédure à écrire au premier déploiement).
- Les sessions ne sont pas révoquées quand un membre est retiré d'une
  organisation (pas encore d'écran de gestion des membres : phase 8).
- Événements d'audit d'un compte supprimé : acteur conservé (uuid), nom
  perdu ; à traiter avec la politique de rétention CNDP (phase 9).
- Ancrage externe du dernier hash d'audit (phase 9).
- Pas encore de Sentry / PostHog / déploiement de prévisualisation :
  nécessitent des comptes (questions ci-dessous).

## Questions ouvertes

1. Hébergement de prévisualisation (Vercel ?) et projet Supabase UE : à créer
   par vous ; je n'ai besoin que des noms de variables, jamais des secrets.
2. Comptes Sentry et PostHog (régions UE) : maintenant ou en phase 9 ?
3. Fournisseur d'envoi de courriels (Resend) : domaine d'envoi à choisir
   avec le nom de marque définitif.

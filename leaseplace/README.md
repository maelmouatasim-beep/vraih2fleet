# LeasePlace Maroc

Marketplace digitale de crédit-bail B2B au Maroc : **un dossier, plusieurs
offres, une décision éclairée.** La plateforme est un intermédiaire sous
mandats écrits des bailleurs (loi 103-12) : elle ne manie aucun fonds et ne
prend aucune décision de crédit.

> Hébergé provisoirement dans `vraih2fleet/leaseplace/` ; dossier autonome,
> à déplacer tel quel dans son propre dépôt (voir ADR 0006).

## Démarrage local

Prérequis : Node 22, pnpm 10 (`corepack enable`), PostgreSQL 16 local.

```bash
pnpm install
pnpm db:local                                   # bases leaseplace + leaseplace_test, migrations, rôles
cp apps/web/.env.example apps/web/.env.local    # puis renseigner BETTER_AUTH_SECRET
pnpm db:seed                                    # 4 organisations et 5 comptes FICTIFS
pnpm dev                                        # http://localhost:3000 (comptes : /demo)
```

## Commandes

| Commande                                | Effet                                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm check`                            | lint + typecheck + tests de tous les paquets, puis Prettier — **avant tout commit** |
| `pnpm test`                             | tests (le paquet `db` exige `DATABASE_URL_TEST`, base de test migrée)               |
| `pnpm build`                            | build de production                                                                 |
| `pnpm e2e`                              | parcours Playwright contre l'app démarrée (`pnpm --filter @leaseplace/web start`)   |
| `pnpm --filter @leaseplace/db generate` | migration SQL depuis le schéma Drizzle                                              |

## Structure

```
apps/web/             Next.js 15 : public, /entreprise, /bailleur, /admin (App Router, next-intl)
packages/domain/      logique métier pure, couverte à 100 % (RBAC, audit, moteur financier)
packages/db/          schéma Drizzle, migrations, contexte RLS, audit ; tests RLS sur vrai Postgres
packages/ai/          IA : prompts versionnés, schémas Zod, client Claude, simulateur, vérificateur de notes
packages/ui/          design system : tokens (contrastes AA testés), composants
packages/integrations/ adaptateurs (courriel, stockage chiffré, antivirus : interfaces + implémentations de test, tests de contrat)
packages/config/      tsconfig et ESLint partagés
docs/                 ADR, glossaire métier, schéma cible
```

## Moteur financier

`packages/domain/src/finance` : loyer, échéancier, TEG implicite,
classement neutre, comparaison crédit-bail / crédit / comptant (ADR 0009).
Cas de référence recalculés par `scripts/finance/reference.py` :
`python3 scripts/finance/reference.py > packages/domain/src/finance/__fixtures__/reference-cases.json`.
Simulateur public : `/simulateur`.

## Site public

`/`, `/simulateur`, `/secteurs/{transport,btp,medical}`, `/bailleurs`
(formulaire de contact → `marketing.leads`, lu dans `/admin/contacts`),
`/mentions-legales`, `sitemap.xml`, `robots.txt`. Performance : ADR 0010.

## Espace entreprise

Inscription par code e-mail → `/bienvenue` (profil) → `/entreprise` :
coffre-fort KYC, assistant de demande en 5 étapes avec sauvegarde
automatique, consentement 09-08 versionné, soumission et historique
(`docs/phases/phase-4.md`). Documents chiffrés (`LP_STORAGE_KEY`, 32 octets
en base64 : `openssl rand -base64 32`) dans `LP_STORAGE_DIR` ; analyse
antivirus et liens signés : ADR 0011.

## Revue des dossiers (back-office)

`/admin/dossiers` : extraction des pièces, contrôles de cohérence, indice
d'orientation explicable (`docs/scoring.md`), note de synthèse vérifiée puis
validée par un humain, qualification ou demande de compléments (ADR 0012).
IA : `LP_AI_PROVIDER=mock` (simulateur, défaut) ou `anthropic`
(`ANTHROPIC_API_KEY`) ; évaluation manuelle : `pnpm --filter @leaseplace/ai eval`.

## Orientation et espace bailleur

À la qualification, les bailleurs éligibles sont calculés d'après leurs
critères d'appétit (ordre neutre). L'entreprise en choisit au plus 4 et
consent, bailleur par bailleur. `/bailleur` : boîte de réception (délai de
72 h), fiche dossier avec pièces filigranées, offre recalculée par le moteur,
refus motivé, critères d'appétit, tableau de bord (ADR 0013,
`docs/phases/phase-6.md`).

## Sécurité, en bref

- Trois rôles Postgres : propriétaire (migrations), `lp_auth` (Better-Auth,
  tables `identity` seulement), `lp_app` (application, **sans BYPASSRLS**).
  Toute requête applicative passe par `withActor()` qui pose `app.user_id`
  pour la transaction ; sans contexte, la RLS ne renvoie rien.
- Journal `audit.events` append-only : écriture par `audit.record()` seule
  (acteur lu dans le contexte, jamais en paramètre), UPDATE/DELETE/TRUNCATE
  refusés par trigger, chaîne SHA-256 vérifiable (`audit.verify_chain()`).
- 2FA TOTP obligatoire pour bailleurs et plateforme (enrôlement imposé ;
  lien magique et code e-mail refusés pour ces comptes ; désactivation
  refusée). PME : code à 6 chiffres ou lien magique, sans mot de passe.
- CSP stricte à nonce, HSTS, `frame-ancestors 'none'`, limitation de débit
  persistée en base, redirections post-connexion limitées aux espaces.

## Mode démo

`LP_DEMO_MODE=true` : bandeau permanent, page `/demo` (identifiants et codes
TOTP courants), boîte d'envoi `/demo/boite-mail` (aucun fournisseur de
courriel branché). Identifiants publics : une base de démo ne contient
jamais de données réelles.

# H2Fleet Planner

Plateforme SaaS de planification de la transition énergétique des flottes
(diesel → électrique / hydrogène) : analyse TCO, infrastructure,
subventions canadiennes, télématique (Geotab/Samsara), feuille de route
pluriannuelle.

**Stack** : React 18 + Vite + TypeScript · Tailwind CSS + shadcn/ui ·
Supabase (Postgres/RLS, Auth, Edge Functions Deno) · i18next (fr/en).

Voir aussi [CLAUDE.md](./CLAUDE.md) pour les conventions de contribution
et la direction produit.

## Installation locale

Prérequis : Node.js ≥ 20 et npm (npm est le seul gestionnaire de paquets
du projet).

```sh
git clone <URL_DU_DEPOT>
cd vraih2fleet
npm ci
cp .env.example .env   # puis remplir les valeurs (voir ci-dessous)
npm run dev            # http://localhost:8080
```

## Variables d'environnement

Copier `.env.example` vers `.env` et remplir. Les principales :

| Variable | Rôle |
| --- | --- |
| `VITE_SUPABASE_PROJECT_ID` | Identifiant du projet Supabase |
| `VITE_SUPABASE_URL` | URL du projet, `https://<id>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique « anon » (Settings → API) |
| `VITE_ADMIN_EMAILS` | Emails admin, séparés par des virgules |

Les variables `VITE_*` sont inlinées dans le bundle : n'y mettre que des
valeurs publiques. Les secrets des edge functions (SendGrid, Lovable AI,
Mapbox, télématique…) se configurent côté Supabase :
`supabase secrets set NOM=valeur` — la liste complète des noms est dans
`.env.example`.

## Supabase en local

Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) installée :

```sh
supabase start                  # démarre Postgres + Auth + functions en local
supabase db reset               # rejoue toutes les migrations (supabase/migrations/)
supabase functions serve        # sert les edge functions localement
```

Pointer ensuite `.env` vers l'instance locale (`VITE_SUPABASE_URL=http://127.0.0.1:54321`
et la clé anon affichée par `supabase start`).

Conventions : migrations additives et horodatées (ne jamais modifier une
migration existante), RLS obligatoire sur toute nouvelle table.

## Tests et qualité

```sh
npm run check          # typecheck + lint (baseline) + tests — le tout-en-un
npm run test           # tests unitaires (Vitest)
npm run test:watch     # Vitest en mode watch
npm run typecheck      # tsc --noEmit
npm run lint           # eslint complet (inclut la dette existante)
npm run lint:ci        # échoue seulement sur les nouvelles erreurs (baseline)
npm run build          # build de production
```

Le lint fonctionne en mode « baseline » : la dette existante est
enregistrée dans `scripts/lint-baseline.json` et seule une **nouvelle**
erreur fait échouer `lint:ci` (et la CI). Après avoir résorbé de la dette,
verrouiller le progrès avec `npm run lint:baseline`.

Les tests d'intégration des edge functions (`supabase/functions/*/index.test.ts`)
s'exécutent avec Deno contre les fonctions déployées :

```sh
deno test --allow-net --allow-env --allow-read supabase/functions
```

Ils lisent `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans
l'environnement (ou `.env`). En CI, ils ne tournent que si ces secrets
sont configurés dans le dépôt GitHub.

## Intégration continue

`.github/workflows/ci.yml` exécute sur chaque push / PR :
`npm ci` → typecheck → lint (baseline) → tests → build, plus les tests
Deno des edge functions quand les secrets sont présents.

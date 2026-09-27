# H2Fleet — guide pour Claude Code

H2Fleet est un SaaS qui aide les flottes (municipalités, sociétés de
transport, transporteurs) à planifier leur transition diesel → électrique /
hydrogène : TCO, infrastructure, subventions canadiennes, télématique
(Geotab/Samsara), feuille de route.

## Stack

- **Frontend** : React 18 + Vite + TypeScript, Tailwind CSS, shadcn/ui
  (Radix), react-router-dom, TanStack Query, react-hook-form + zod,
  Recharts, mapbox-gl, i18next (fr + en).
- **Backend** : Supabase (Postgres + RLS, Auth, Edge Functions en Deno).
- **Tests** : Vitest (unitaires front), `deno test` (intégration edge
  functions). **Gestionnaire de paquets : npm uniquement** (pas de bun/yarn/pnpm).

## Structure des dossiers

- `src/pages/` — une page par route (voir `src/App.tsx` pour le routeur).
- `src/components/` — composants par domaine (`dashboard/`, `landing/`,
  `reports/`, `telematics/`, …) ; `ui/` = primitives shadcn, ne pas y
  mettre de logique métier.
- `src/hooks/` — hooks de données et d'état (Supabase, TanStack Query).
- `src/lib/calculations/` — **moteur de calcul TCO/CAPEX/émissions** ;
  ses tests sont dans `src/lib/calculations/__tests__/`.
- `src/i18n/locales/{fr,en}/translation.json` — tous les textes UI.
- `src/integrations/supabase/` — client et types générés (ne pas éditer
  à la main sauf nécessité ; fichiers marqués « automatically generated »).
- `supabase/migrations/` — migrations SQL horodatées.
- `supabase/functions/` — edge functions Deno (une par dossier).
- `supabase/functions/_shared/` — modules communs des fonctions :
  `cors.ts` (origines depuis ALLOWED_ORIGINS, jamais `*`), `auth.ts`
  (getUserOrThrow, requireCronSecret, requireInternalSecret,
  serviceRoleClient), `validation.ts` (zod, escapeHtml, anti-SSRF).
- `supabase/tests/` — tests d'intégration contre Supabase local
  (helpers + audit RLS) ; exécutés en CI, jamais contre la production.

## Commandes

```bash
npm ci                 # installation reproductible
npm run dev            # serveur de dev (port 8080)
npm run check          # typecheck + lint (baseline) + tests — À LANCER AVANT TOUT COMMIT
npm run test           # vitest seul (test:watch pour le mode watch)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint complet (dette existante incluse)
npm run lint:ci        # échoue seulement sur les NOUVELLES erreurs vs scripts/lint-baseline.json
npm run lint:baseline  # verrouille la baseline après une résorption de dette
npm run build          # build de production
npm run build:preview  # build de l'APERÇU hébergé (hash routing, base ./)
```

## Aperçu du site (règle permanente)

L'utilisateur suit le site via l'aperçu
https://claude.ai/artifact/NLvGfsNLX3qmW7PJeaJbCq — sa seule fenêtre sur
l'application pendant le développement. **Après CHAQUE changement visible
du site** : `npm run build:preview`, republier le dossier `dist/` sur cet
artefact (toujours la même URL, jamais un nouvel artefact), et envoyer une
capture d'écran de la page modifiée dans la conversation. L'aperçu utilise
le hash routing (`VITE_PREVIEW_HASH_ROUTER`) ; la production reste en
BrowserRouter.

## Conventions

- **Migrations Supabase** : additives et horodatées ; **ne jamais modifier
  une migration existante** — toujours en créer une nouvelle.
- **RLS obligatoire** sur toute nouvelle table (policies dès la migration
  de création).
- **Textes UI via i18n**, toujours dans les deux locales `fr` et `en`
  (`src/i18n/locales/*/translation.json`). Pas de chaîne en dur dans le JSX.
- **Montants en CAD** (le produit cible le marché canadien).
- **Tout changement dans `src/lib/calculations/` doit être couvert par un
  test** (nouveau cas ou mise à jour d'un test existant).
- Lint : ne pas ajouter de nouvelles erreurs (`npm run lint:ci` doit
  passer) ; la dette baseline se résorbe progressivement, jamais l'inverse.
- Secrets : jamais de valeur dans le dépôt ; les noms vont dans
  `.env.example`, les valeurs dans `.env` (gitignoré) ou
  `supabase secrets set`.
- **Aucune edge function sans vérification explicite de l'appelant** :
  `verify_jwt` n'est pas une authentification (la clé anon le franchit).
  Toute fonction passe par `_shared/auth.ts` — `getUserOrThrow` (JWT réel),
  `requireCronSecret` ou `requireInternalSecret` — et une fonction agissant
  pour un utilisateur utilise son client RLS, pas le service role.
  Voir SECURITY.md pour le tableau complet.

## Direction produit (à garder en tête pour tout arbitrage)

Le produit sera réorganisé autour d'**une seule tâche** :

> À partir de ma flotte réelle, obtenir un plan de remplacement
> pluriannuel chiffré, finançable et défendable, puis le suivre.

- **Parcours projet en 7 étapes** : Flotte → Faisabilité → Stratégies →
  Plan → Financement → Rapports → Suivi.
- **Planification véhicule par véhicule** (pas seulement par catégories).
- **Menu réduit à 6 entrées** : Accueil, Projets, Ma flotte, Bibliothèque,
  Organisation, Aide.

Prochaines étapes dans l'ordre : sécurité, identifiants télématiques,
moteur TCO unique, puis refonte.

**Ne pas investir** dans les modules appelés à disparaître : annuaire de
fournisseurs, page Scénarios globale, page Incitatifs, pages publiques
vides, kanban de tâches. Corrections minimales seulement si un bug y
bloque autre chose.

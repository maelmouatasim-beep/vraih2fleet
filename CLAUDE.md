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
- `src/components/layout/` — **système de design commun** (à utiliser
  pour toute page) : `Page` + `PageHeader` (conteneur, titre 24 px,
  sous-titre, retour, actions), `StatCard`/`StatGrid` (indicateurs),
  `StatusBadge` + tables de tons `tons.ts` (un sens = une couleur :
  vérifié vert, à valider ambre, estimation bleu, fermé/à risque rouge),
  `EmptyState`, `LoadingState` (squelettes), `ErrorState`, `charts.ts`
  (infobulle des graphiques). `src/hooks/useLargeur.ts` = largeur du
  conteneur (la barre latérale prend 256 px). Formats : `src/lib/format.ts`
  (`formateurCad`, `formateurNombre`, `formaterPourcentage`,
  `formaterDate`, selon la langue — jamais `toLocaleString()` nu ni
  « fr-CA » en dur). Tableaux de 4 colonnes et plus : largeur minimale et
  défilement dans la carte (`index.css`) ; colonnes de chiffres
  `text-right` ; identifiants `whitespace-nowrap`.
- `src/hooks/` — hooks de données et d'état (Supabase, TanStack Query).
- `src/lib/tco/` — **LE moteur de calcul TCO/émissions** (pur, testé,
  hypothèses sourcées) ; spec : `docs/tco-methodologie.md` ; tout import
  passe par le barrel `src/lib/tco`. L'ANCIEN moteur
  (`src/lib/calculations/`) est SUPPRIMÉ (Phase 3, bloc 3) ; le lint
  `no-restricted-imports` empêche sa réintroduction et les constantes
  d'hypothèses hors `src/lib/tco/` restent bloquées par
  `scripts/check-hypothesis-constants.mjs` (baseline décroissante).
  `src/lib/legacy/scenario-types.ts` = types hérités SANS calcul, pour
  lire les tables existantes (scenarios, tco_results, reference_data)
  jusqu'à la refonte des rapports.
- `src/lib/journey/` — logique PURE des étapes du parcours, branchée sur
  `src/lib/tco` : `infrastructure.ts` = SOURCE UNIQUE bornes + raccordement
  par garage (lue par Stratégies, Plan, Financement, PDF, Excel) ;
  `strategies.ts` (dont `strategieRetenue`, `strategieMeilleureEconomie`) ;
  `feasibility.ts` ; `winter.ts` (diagnostic hiver/autonomie) ;
  `categories.ts` (catégories municipales → catégorie du moteur, « à
  reporter ») ; `subsidy-explain.ts` (règle + raison de chaque
  subvention) ; `progress.ts` (état réel des 7 étapes) ;
  `optimizer.ts` (optimiseur de calendrier DÉTERMINISTE, 4e stratégie
  « Optimisée », décisions expliquées) ; `changeLog.ts` (journal des
  actions, aperçu avant → après).
- `src/lib/copilot/outils.ts` — outils du copilote exécutés dans le
  navigateur par le moteur (lire_projet, simuler, optimiser, registres) ;
  aucun chiffre ne vient de l'IA.
- `src/lib/fleet/` — flotte : import (synonymes FR/EN, modèle
  téléchargeable `importTemplate.ts`), garages (`garagesModel.ts` pur,
  `garages.ts` accès base), classe PNBV (`gvwr.ts`), import intelligent
  (`smartImport.ts` pur : correspondance, conversions, validation ligne
  par ligne ; `smartImportFile.ts` : lecture CSV/XLSX/PDF). Un module testé ne
  doit pas importer le client Supabase (la CI n'a pas de `.env`).
- `src/lib/notifications/model.ts` — notifications (PUR, testé) : types
  autorisés (identiques à la contrainte CHECK), catégories (identiques à
  `public.notification_category`), écran cible par type (étapes du
  parcours uniquement), textes fr/en depuis `payload`. Une seule source
  côté client : `NotificationsProvider` (`src/hooks/useNotifications.tsx`,
  monté dans App.tsx — un canal temps réel, compteur exact) ; cloche
  protégée par `NotificationsBoundary`. Côté base : trigger commun
  `notifications_before_insert` (préférences + paramètres des textes),
  alertes du plan et tâches générées versées dans la cloche
  (migration 20261006010000).
- `src/i18n/locales/{fr,en}/translation.json` — tous les textes UI.
- `src/integrations/supabase/` — client et types générés (ne pas éditer
  à la main sauf nécessité ; fichiers marqués « automatically generated »).
- `supabase/migrations/` — migrations SQL horodatées.
- `supabase/functions/` — edge functions Deno (une par dossier).
- `supabase/functions/_shared/` — modules communs des fonctions :
  `cors.ts` (origines depuis ALLOWED_ORIGINS, jamais `*`), `auth.ts`
  (getUserOrThrow, requireCronSecret, requireInternalSecret,
  serviceRoleClient), `validation.ts` (zod, escapeHtml, anti-SSRF),
  `ai.ts` (client Anthropic, réglages par organisation, quotas, débit,
  usage en jetons), `numberCheck.ts` (chaque nombre d'un texte généré
  vérifié contre les sorties du moteur), `copilotTools.ts`,
  `importSchema.ts` (identique à `src/lib/fleet`, testé),
  `documentSchema.ts`, `councilNote.ts` (règles de la note au conseil),
  `smtpConfig.ts` (PUR, testé : SMTP IONOS port 465, 25/587 refusés,
  seul interrupteur SMTP_PASSWORD) + `smtp.ts` (nodemailer, certificat
  toujours vérifié, aucune adresse dans les journaux).
  Fonctions IA : `copilot`, `fleet-import`, `document-reader`,
  `council-note` ; tâche planifiée `plan-alerts-digest`.
- `scripts/mock-anthropic.mjs` — FAUX serveur de l'API Claude (réponses
  scriptées) pour l'e2e ; aucune vraie clé en CI.
- `scripts/mock-smtp.mjs` — FAUX serveur SMTP (TLS implicite, AC de test
  générée au démarrage → `SMTP_TLS_CA_TESTS_ONLY` ajouté à l'env des
  fonctions) ; `supabase/tests/smtp-envoi.test.ts` (étape e2e de la CI).
- Confirmation du courriel : `src/lib/auth/confirmation.ts` (pur, testé),
  `AttenteConfirmation` (même navigateur détecté, code à 6 chiffres,
  « Me connecter », renvoi 60 s), pages `/auth/confirme` et
  `/auth/verifier` ; `scripts/e2e-confirmation.mjs` (4 scénarios +
  anti-énumération + ordre des onglets inversé, URL propres ET hash, en CI ;
  l'entrée dans l'espace passe TOUJOURS par `useAuth().synchroniserSession`) ; modèle Supabase
  bilingue `docs/courriels-auth/confirm-signup.html`. Code saisissable
  partout (2026-10-06) : connexion d'un compte non confirmé
  (`estNonConfirme`) → écran d'attente `origine="connexion"` ; lien « Vous
  avez reçu un code de confirmation ? » (connexion + inscription →
  `/auth/verifier?saisie=1`, `ConfirmerAvecCode`) ; appels partagés dans
  `src/lib/auth/codeConfirmation.ts` ; e2e scénarios 6 et 7.
- Nouvelle version : `version.json` + `<meta name="h2fleet-version">` écrits
  au build (plugin `versionDuBuild`, `src/lib/version/nouvelleVersion.ts`),
  `useNouvelleVersion` (toutes les 5 min + retour sur l'onglet) →
  `BandeauNouvelleVersion` « Recharger » ; JAMAIS de rechargement
  automatique ; `/version.json` en `no-store` (`_headers`) ;
  `scripts/e2e-version.mjs` (déploiement simulé, URL propres + hash, en CI).
  Aperçu : publier aussi `dist/version.json`.
- `supabase/tests/` — tests d'intégration contre Supabase local
  (helpers + audit RLS) ; exécutés en CI, jamais contre la production.

## Commandes

```bash
npm ci                 # installation reproductible
npm run dev            # serveur de dev (port 8080)
npm run check          # typecheck + lint (baseline) + garde des constantes + tests — À LANCER AVANT TOUT COMMIT
npm run test           # vitest seul (test:watch pour le mode watch)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint complet (dette existante incluse)
npm run lint:ci        # échoue seulement sur les NOUVELLES erreurs vs scripts/lint-baseline.json
npm run lint:baseline  # verrouille la baseline après une résorption de dette
npm run build          # build de production
npm run build:preview  # build de l'APERÇU hébergé (hash routing, base ./)
npm run build:prod     # build de PRODUCTION (h2fleet.ca, Cloudflare Pages) : refuse une config incomplète, écrit dist/_headers (CSP) + dist/_redirects
node scripts/serveur-production.mjs 8080 dist-prod   # sert un build comme Cloudflare Pages (en-têtes, 301, repli SPA) — utilisé par la CI e2e
node scripts/alertes/recalcul-alertes.mjs --local    # recalcul serveur des alertes du plan (même code que l'écran) ; --heberge en workflow quotidien
npm run test:tco       # tests du moteur TCO avec seuils de couverture 95 %
npm run docs:tco       # régénère docs/tco-hypotheses.md depuis assumptions.ts
npm run e2e:local      # parcours complet Playwright contre Supabase LOCAL (voir scripts/e2e-parcours.mjs)
npm run e2e:visuel     # régression visuelle : toutes les pages (démo Rivière-Claire), 1440/1024/390, fr/en — échoue sur débordement, texte/mot coupé, chiffres non alignés, bouton hors carte (aussi en CI)
node scripts/typographie-fr.mjs   # typographie des traductions (insécables, « », unités) ; --check en lecture seule, règles testées en CI
npm run e2e:terrain    # cas terrain 12 véhicules / 3 garages : totaux identiques Stratégies/Plan/Financement/PDF/Excel (aussi en CI)
```

Supabase local (Docker) : `npx supabase start` puis `npx supabase db reset
--local` ; tests Deno en local : exporter `supabase status -o env` (comme
dans `.github/workflows/ci.yml`) + `DENO_CERT=/root/.ccr/ca-bundle.crt`
dans l'environnement de Claude. **Après toute nouvelle migration** :
`node scripts/verifier-base.mjs --generer` (manifeste
`supabase/schema-attendu.json`, sinon la CI échoue).

## Projet Supabase hébergé (site de test)

Projet Supabase PROPRE de l'utilisateur : ref `rjyvcogtvcgzwxeprgsm`
(https://rjyvcogtvcgzwxeprgsm.supabase.co, clé publishable — valeurs
publiques ; l'ancien `fihklznbfufhowopwwuc`
appartient à Lovable Cloud, sans accès admin — abandonné, rien n'y est
supprimé). Procédure et liste à cocher : `docs/deploiement.md`.
- `.github/workflows/deploy-supabase.yml` : à chaque push, `db push` +
  `functions deploy` + contrôle de santé (`scripts/verifier-base.mjs
  --heberge`) ; secrets GitHub `SUPABASE_ACCESS_TOKEN`,
  `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` (saisis par
  l'utilisateur ; Claude ne les voit jamais).
- `.github/workflows/e2e-heberge.yml` (manuel) : parcours complet contre
  la base hébergée avec comptes `e2e-…@example.com` créés puis supprimés
  (`scripts/comptes-e2e.mjs`).
- Seules des valeurs PUBLIQUES passent par le chat (ref, URL, clé
  publishable/anon) ; jamais de mot de passe ni de jeton.
- Tâches pg_cron : `supabase/snippets/taches-planifiees.sql` (secrets lus
  dans le Vault), exécuté à la main une fois.

## Aperçu du site (règle permanente)

L'utilisateur suit le site via l'aperçu
https://claude.ai/artifact/NLvGfsNLX3qmW7PJeaJbCq — sa seule fenêtre sur
l'application pendant le développement. **Après CHAQUE changement visible
du site** : `npm run build:preview`, republier le dossier `dist/` sur cet
artefact (toujours la même URL, jamais un nouvel artefact), et envoyer une
capture d'écran de la page modifiée dans la conversation.
ATTENTION : à chaque build, les hashes des fichiers `dist/assets/` changent
— publier TOUS les fichiers régénérés (le JS **et le CSS**, comparer avec
`grep -o 'assets/[^"]*' dist/index.html`), sinon la page s'affiche en HTML
brut sans styles (incident du 27/09 : CSS oublié). L'aperçu utilise
le hash routing (`VITE_PREVIEW_HASH_ROUTER`) ; la production reste en
BrowserRouter.

LIMITE DE L'APERÇU : les pages hébergées sur claude.ai ne peuvent pas
appeler de serveurs externes → **pas de login ni de données Supabase sur
l'aperçu** (« Failed to fetch » attendu) ; il sert au visuel et à la
navigation. Le test fonctionnel (auth, données) se fait sur le site de
test GitHub Pages, redéployé automatiquement à chaque push par
`.github/workflows/deploy-pages.yml` :
https://maelmouatasim-beep.github.io/vraih2fleet/
PRODUCTION (préparée, bascule par l'utilisateur) : https://h2fleet.ca sur
Cloudflare Pages (dépôt privé possible), branche `production`, BrowserRouter,
étapes exactes dans `docs/production.md` ; les aperçus Cloudflare de la
branche de dev remplaceront GitHub Pages quand le dépôt sera privé (le
workflow Pages s'arrête alors de lui-même).
Le projet Supabase visé vient des variables de dépôt
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (Actions > Variables) ; plus aucune
lecture du bundle Lovable. Les liens des courriels d'auth pointent sur la
racine du site (routage par hash) : `src/lib/authRedirect.ts`.

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

## Avancement de la refonte

Plan complet : `docs/refonte.md` (cartographie, classement des pages,
plan détaillé des phases 1 à 4, risques). Méthodologie TCO :
`docs/tco-methodologie.md` (annexe des rapports et future page publique).

- **Phase 0 — cartographie et plan : livrée, ok reçu.**
- **Phase 1 — moteur TCO unique (`src/lib/tco/`) : 1B LIVRÉE, en
  attente du « ok » avant la Phase 2.**
  1B : moteur pur `engine.ts` (engineVersion 1.0.0, empreinte des
  entrées, vue économique + budgétaire) + `sensitivity.ts` (relance le
  vrai moteur, 3 scénarios, tornade, risque calculé) +
  `subsidy-resolver.ts` (plafonds/cumul) ; 61 tests dont les 6 cas de
  référence à ±0,01 $ et des propriétés fast-check ; couverture 100 %
  lignes / 97,6 % branches (`npm run test:tco`, seuil CI 95 %) ;
  garde-fous : lint interdisant tout nouvel import de
  `src/lib/calculations`, constantes d'hypothèses bloquées hors
  `src/lib/tco/` (baseline 20 fichiers hérités) ; supprimés :
  `src/lib/calculations.ts`, `ScenarioDetail.tsx` + route,
  `supabase/functions/calculate-tco` (410 dans api-gateway) ;
  méthodologie v1.1 (§10 : points normatifs tranchés).
  1A (livrée) : `docs/tco-methodologie.md` (spec complète) ;
  `src/lib/tco/{assumption-types,assumptions,subsidy-programs,units,generate-hypotheses-doc}.ts` ;
  `docs/tco-hypotheses.md` GÉNÉRÉ (`npm run docs:tco`, test CI de
  fraîcheur) ; 6 cas de référence contre-calculés par un agent
  indépendant (`docs/tco-cas-de-reference.{md,json}`,
  `docs/tco-verification.xlsx` — formules Excel auditables) ; analyse
  des écarts vs l'ancien moteur (fin de tco-cas-de-reference.md).
  Sources officielles lues via
  `.github/workflows/verify-tco-sources.yml` (l'environnement de dev ne
  peut pas les atteindre) — statuts vérifiés le 2026-09-28 : iMHZEV
  FERMÉ, PAVÉ actif (5 000 $, ≤ 50 k$), Roulez vert 2 000 $ jusqu'au
  2026-12-31, Écocamionnage 2025-2028 (plafonds 30/75/100/150 k$ + 15 %
  achat local), PIVEZ fermé aux demandes, diesel QC ≈ 2,95 $/L
  (2026-09-21), tarif M HQ 6,292 ¢/kWh + 18,242 $/kW.
- **Phase 2 — fondations des données + navigation : LIVRÉE, en attente
  du « ok » avant la Phase 3.**
  2a organizations/organization_members (admin/member/reader, org auto
  à l'inscription, projets rattachés, RLS + tests Deno, fix
  listProjects/getProjectById) ; 2b table vehicles (« Ma flotte »,
  /dashboard/fleet, import CSV/Excel validé ligne à ligne) +
  project_vehicles (année de remplacement + techno cible par véhicule) ;
  2c télématique sans AUCUNE valeur aléatoire (défauts de catégorie du
  moteur TCO marqués estimation, VIN/marque/année importés, échec API =
  erreur, mode démo explicite avec bandeau) ; 2d tco_results.is_current
  (index unique partiel + trigger, lecteurs filtrés, agrégats « une
  flotte par projet ») ; 2e i18n fr par défaut, doublons fusionnés,
  parité fr↔en 0 écart + test CI, préférences persistées (CAD/QC sur
  l'organisation) ; 2f menu 6 entrées (Accueil, Projets, Ma flotte,
  Bibliothèque, Organisation, Aide), parcours projet 7 étapes
  (`/dashboard/projects/:id/{flotte,faisabilite,strategies,plan,financement,rapports,suivi}`,
  coquilles — contenu en Phase 3), pages Library/Organization,
  retraits + redirections (scenarios global, subsidies/incentives,
  suppliers, tasks autonome, admin mock, pages publiques vides), code
  mort supprimé (13 pages + module fournisseurs).
- **Phase 3 — contenu des 7 étapes : LIVRÉE, en attente du « ok »
  avant la Phase 4.** Les 8 blocs :
  (1) Flotte : sélection des véhicules du projet (project_vehicles),
  année suggérée = mise en service + durée de vie de la catégorie ;
  (2) Faisabilité : verdict BEV/FCEV par véhicule chiffré par le moteur
  (économie/surcoût, payback, CO2, subventions, réserves qualitatives,
  données estimées signalées) — `src/lib/journey/feasibility.ts` ;
  (3) Stratégies : 3 stratégies (Plan actuel / Tout électrique /
  Économies d'abord, `strategies.ts`) + stress test sur sensitivity.ts
  (tornade, 3 scénarios, risque calculé) ; **moteur 1.1.0** :
  `anneeAcquisition` par véhicule (§10.11, méthodologie v1.2, cas de
  référence inchangés à ±0,01 $), `parametresParDefaut` (assemblage
  traçable du registre, testé ≡ PARAMETRES_CAS), résolveur filtrant les
  programmes échus avant l'année d'achat + `statutEffectif(dates)` ;
  **`src/lib/calculations/` SUPPRIMÉ** (critère bloquant, −19 750
  lignes) avec l'ancien flux scénarios/wizard/Infrastructure/
  RiskAnalysisPanel (redirections posées, types hérités sans calcul
  dans `src/lib/legacy/scenario-types.ts`, baselines lint 186→88 et
  constantes 20→12 verrouillées) ;
  (4) Plan : budget annuel (vueBudgetaire) + remplacements par année ;
  (5) Financement : subventions du plan par véhicule + registre des
  programmes à statut CALCULÉ, date de vérification et source visibles ;
  (6) Rapports : PDF conseil fr/en (résumé, stress test, budget, annexe
  des 40 hypothèses, empreinte en pied de page) + vrai .xlsx 3 feuilles
  (`report.ts` pur testé) — téléchargements validés par clic Playwright ;
  (7) Suivi : réalisé vs prévu, kanban réutilisé, tâches liées
  véhicule/année/subvention, génération idempotente (auto_key), fix du
  double trigger de notification d'assignation (migration
  20260928170000, qui répare aussi l'INSERT cassé) ;
  (8) Démo « Ville de Rivière-Claire » (municipalité FICTIVE, 40
  véhicules déterministes, aucun résultat pré-calculé — remplace la
  démo STM) + assistant IA réaligné (zéro chiffre figé, renvoi aux
  écrans avec source/date).
- **Revue externe (blocs A → E) : LIVRÉE, en attente du « ok » avant la
  Phase 4.** Un commit par point, un test par correction.
  A (moteur 2.1.0) : taxes symétriques, résolveur (classe exacte, cumul,
  PAVÉ dégressif), prix de l'énergie en 3 couches + snapshots de
  rapport, cas de référence régénérés. B : RLS (UPDATE projects
  verrouillé, can_view/can_edit étendus, gouvernance d'org, is_current
  concurrent), exceljs au lieu de xlsx vulnérable, procédure
  `docs/deploiement.md`, subventions CONFIRMÉES par le client
  (`confirmed_subsidies`, prioritaires dans le moteur, citées au
  rapport avec la référence du document). C : Ma flotte (édition,
  suppression, import strict + mises à jour), choix groupés, appliquer
  une stratégie au plan (`projects.selected_strategy`), remplacement
  réalisé (`project_vehicles.completed_date/actual_cost`), suivi des
  demandes (`subsidy_applications`), infrastructure par dépôt, démo
  propre, création de projet → étape Flotte. D : Accueil réel,
  Bibliothèque = registre, Aide/assistant sans chiffres figés,
  Analytics/Comparaison/ProjectDetail retirés (redirections), taux
  d'actualisation en FRACTION (bug 0,05 % corrigé, migration), import
  télématique → Ma flotte, invitations d'équipe
  (`organization_invitations`, sans envoi de courriel). E : test CI
  des clés i18n appelées absentes, exports et registre en anglais,
  `<html lang>` dynamique + sélecteur fiable, parcours complet
  automatisé (`npm run e2e:local`, 12/12 étapes, 0 erreur) qui a révélé
  et fait corriger : 403 à la génération des tâches (défaut
  `tasks.created_by`), débordement horizontal du layout, assistant
  d'accueil obsolète de Projets, libellés tronqués, kanban coupé.
  Migrations de la revue : 20260929010000 → 20260930050000 (toutes
  additives) — à appliquer sur la base hébergée via docs/deploiement.md.
- **Migration vers le projet Supabase propre : BASCULÉE le 2026-10-02.**
  Site de test sur `rjyvcogtvcgzwxeprgsm` (63 migrations, 9 fonctions,
  contrôle de santé conforme) ; l'ancienne base Lovable n'est plus
  utilisée par le site de test. Livré : workflows deploy-supabase /
  e2e-heberge, deploy-pages sur variables de dépôt, contrôle de santé du
  schéma (manifeste vérifié en CI), tâches pg_cron via Vault (non encore
  planifiées), page /reset-password + liens de courriel compatibles
  GitHub Pages, services non branchés → 503 `service_non_configure` +
  message clair (courriels, IA, Mapbox reportés par l'utilisateur).
- **Test terrain (petite ville, 12 véhicules, 3 garages) — blocs 1 à 3 :
  LIVRÉS, en attente du « ok » avant la Phase 4.**
  Bloc 1 (cohérence des chiffres, moteur 2.3.0, méthodologie v2.3) :
  infrastructure = une seule source par garage ; raccordement selon kW
  demandés vs disponibles (paliers « estimation », devis prioritaire) ;
  « Économies d'abord » compte bornes + raccordement par garage avant de
  choisir ; récupération « jamais » + raison (plus de « 0 an ») ; badge
  « Meilleure économie » seulement si VAN > 0 et électrification ; Plan,
  PDF, Excel et snapshot nomment la stratégie RÉELLEMENT retenue ;
  subventions explicables (règle + raison ; bug corrigé : un barème
  dégressif échu ne bascule plus sur la classe 3) ; CO2 au pot / cycle
  complet côte à côte, référence ESSENCE pour les véhicules à essence
  (prix StatCan et facteur du guide GES QC lus et archivés le 2026-10-02).
  Bloc 2 : table `garages` (puissance, tarif HQ, fenêtre de recharge,
  devis ; `vehicles.garage_id` synchronisé avec `depot` par trigger) ;
  classe PNBV `vehicles.gvwr_class` (proposition à confirmer) ;
  catégories municipales (déneigeuse, souffleuse, camion à benne,
  spécialisé, urgence) ; diagnostic hiver avec `vehicles.max_daily_km` ;
  modèle d'import Excel/CSV avec « Lisez-moi ».
  Bloc 3 : source de consommation « import » ; barre des 7 étapes à
  l'état réel (terminé / en cours / à faire + ce qui manque) ;
  recommandation + « Appliquer » pour les véhicules sans cible ; cas
  terrain en e2e permanent (CI). Migrations 20261002010000 →
  20261002050000 (additives), appliquées par Deploy Supabase.
- **Phase 4 — site public et conformité : LIVRÉE SAUF TARIFS (« on
  arrangera les tarifs à la fin »), en attente du « ok ».** Un commit et
  un test par point (`src/pages/__tests__/`) :
  4.1 études de cas → « Exemples illustratifs » FICTIFS, calculés en
  direct par le moteur depuis `docs/tco-cas-de-reference.json`
  (`src/lib/caseStudies.ts` supprimé) ; 4.2 promesses non livrées
  retirées (essai gratuit, délais de réponse, faux liens sociaux,
  « Rejoignez… », chiffres de guides non sourcés, page Support →
  /dashboard/help, index.html sans @H2Fleet ni image Lovable) — test
  `promises.test.ts` (exclut `landing.pricing`, à refaire) ; 4.3
  /methodology = rendu de `docs/tco-methodologie.md` + registre généré
  (`MarkdownDoc`, remark-gfm) ; 4.4 pages légales fr/en
  (`LegalPage`, clés `legal.*`) : droit du Québec, Loi 25 (responsable,
  CAI, EFVP, portabilité), version française prévaut, pilote sans
  paiement — **nom légal, adresse et responsable en placeholders
  « [… à confirmer] »** (pas encore d'entreprise) + mention « à faire
  valider par un juriste » ; 4.5 admin = `user_roles`/`has_role` seul
  (VITE_ADMIN_EMAILS retiré), README à jour.
  Reste pour la fin : tarification (Pricing.tsx démonté, clés
  `landing.pricing` et badges d'abonnement, DEMO_MODE).
- **Phase 5 — H2Fleet intelligent : points 1 à 7 LIVRÉS + démonstration
  finale, en attente du « ok ».** Règles : l'IA ne produit JAMAIS un
  chiffre (moteur via outils, nombres vérifiés, sinon réponse rejetée) ;
  toute action = aperçu avant → après + confirmation + journal
  (`plan_change_log`, immuable) ; API Claude d'Anthropic par fonction
  Edge (secret `ANTHROPIC_API_KEY`, côté serveur ; sans clé → 503
  `service_non_configure`, message propre) ; chaque fonction IA
  désactivée par défaut et activable par organisation
  (`organization_ai_settings`), quotas jour/mois par organisation, débit
  par utilisateur, usage journalisé en jetons seulement
  (`ai_usage_events`).
  5.1 optimiseur de calendrier (`optimizer.ts`, déterministe, aucune
  IA) : budgets, cibles ZE/GES, kW et places par garage, échéances de
  subventions, technologies par catégorie ; jamais moins bien qu'une
  stratégie existante réalisable ; infaisabilité chiffrée + leviers ;
  méthodologie §11. 5.2 copilote de projet (`copilot`, panneau du
  parcours, historique d'équipe `copilot_messages`, remplace
  assistant-chat / LOVABLE_API_KEY). 5.3 import intelligent (« Ma
  flotte › Import intelligent », `fleet-import`) : CSV/XLSX/PDF de
  n'importe quelle structure ; l'IA ne voit qu'entêtes + ≤ 3 exemples et
  ne propose qu'une correspondance ; colonnes personnelles exclues ;
  libellé incertain = champ vide signalé ; doublons exclus par défaut ;
  « Historique de la flotte ». Import strict resserré : « 12 000 mi » ou
  un texte collé à un nombre = erreur. Démo : export fictif
  « GestFlotte » ; e2e terrain : 13 étapes dont copilote et import
  (faux serveur Claude). Migrations 20261003010000, 20261003020000.
  5.4 factures et devis (`document-reader`, `src/lib/documents/`,
  `client_documents` + stockage privé `client-documents`) : extraction
  vérifiée (chaque nombre retrouvé dans le texte du PDF, total faux
  signalé), valeurs DÉRIVÉES par le code (formule affichée), aperçu avant
  → après, confirmation, couche 3 « donnée client » ; pièce immuable une
  fois confirmée, citée aux rapports (SHA-256) ; méthodologie §12.
  5.5 veille des subventions (`.github/workflows/veille-subventions.yml`,
  `scripts/veille/`, `src/lib/veille/detection.ts`, aucune IA) : pages et
  PDF officiels relus chaque lundi, texte archivé dans `data/veille/`,
  changements de montant/date/statut déposés dans
  `subsidy_watch_changes` (admins H2Fleet seulement), validés ou rejetés
  dans Bibliothèque › Veille ; jamais appliqués au registre
  automatiquement ; événements validés → alerte au Financement.
  Correctifs du 2026-10-06 : statut retenu seulement s'il porte sur le
  programme (`statutsDeLigne`, faux « suspendu » Revenu Québec écarté,
  `scripts/veille/recalculer-etat.mjs` recalcule `etat.json` depuis les
  archives) ; lisibilité par source (`data/veille/lisibilite.json`,
  `src/lib/veille/lisibilite.ts`) → badge « vérification manuelle
  requise » + `quoiVerifier` dans la Bibliothèque ; repli Chromium pour
  les programmes `lectureNavigateur` (FTCZE) ; PDF de modalités explicite
  (`modalitesUrl`) ; PAGTCP lu sur quebec.ca (modalités 2025-2028).
  5.6 surveillance du plan (`src/lib/journey/surveillance.ts`, pur) :
  prix de l'énergie ±5 % depuis le rapport (stress test relancé, effet du
  prix isolé à plan égal, plan modifié signalé par l'empreinte), échéance
  de programme retenu, remplacements en retard, programmes modifiés,
  capacité de garage ; état dans `plan_alerts` (vue tracée) ; panneau
  dans Suivi, carte « Santé du plan » sur l'Accueil ; résumé courriel
  `plan-alerts-digest` (pg_cron, 503 tant que le SMTP n'est pas branché) ;
  méthodologie §13. 5.7 note au conseil (`src/lib/journey/councilNote.ts`,
  `council-note`, `_shared/councilNote.ts`, `council_notes`) : faits du
  moteur → rédaction IA à jetons `{{fait}}` (aucun chiffre écrit par
  l'IA, brouillon rejeté sinon) ou modèle sans IA → édition (chaque nombre
  vérifié, export bloqué sinon) → PDF (`CouncilNotePDF.tsx`) et Word
  (`councilNoteDocx.ts`, bibliothèque docx) liés à un snapshot
  (`note_pdf`/`note_docx`) ; méthodologie §14. Gabarit PDF « cabinet »
  commun (`src/components/journey/pdf/theme.tsx`, titres d'action =
  première phrase, pièces numérotées et sourcées) appliqué aussi au
  rapport détaillé. Migrations 20261004010000 → 20261004040000
  (additives). e2e terrain : 17 étapes (faux serveur Claude, veille
  fictive `scripts/veille/fixtures/`).

- **Passe visuelle (A + B) : LIVRÉE, en attente du « ok ».** A : barre
  des 7 étapes refaite (`JourneyStepper`, `src/lib/journey/stepper.ts` :
  grille de 7 colonnes égales, un seul système d'états, modes complet /
  compact / cercles selon la largeur du conteneur, AA, tests) ; menu en
  tiroir sous 768 px. B : système de design `src/components/layout/`,
  toutes les pages de l'application migrées ; typographie française des
  traductions (script + test) ; formats selon la langue ; pastilles,
  indicateurs, chargements unifiés ; `scripts/e2e-visuel.mjs` en CI
  (156 captures, 0 problème ; 17 débordements avant).

- **Retours du test en ligne (5 points) : LIVRÉS, en attente du « ok ».**
  (1) « Économies d'abord » = meilleur sous-ensemble PAR GARAGE (sac à
  dos sur les kW par marche de raccordement, `selectionGarage.ts`,
  re-chiffrage moteur + amélioration locale, méthodologie §11.1),
  explication à l'écran ; l'optimiseur essaie les mêmes sous-ensembles ;
  (2) moteur 2.4.0 : récupération « sans objet » (`aucun_ecart`, « — »)
  quand aucun véhicule ne change ; (3) démo réaliste (PNBV, garages
  renseignés, PAGTCP fictive, plan nuancé, CL-01 hydrogène justifié par
  l'hiver) + subventions confirmées comptées en Faisabilité ; (4) carte
  projet = vrai nombre de véhicules ; (5) rapports : exigences du Fonds
  municipal vert (`src/lib/journey/fmv.ts` : équité par service/secteur,
  scénario de réduction, hypothèse `seuil_sous_utilisation_flotte` à
  valider). Liste « prêt pour un premier client » :
  `docs/pret-premier-client.md` (à tenir à jour).

- **Audit acheteur (points 1 à 11 + ajustements A, B, C) : LIVRÉ, en
  attente du « ok » avant le prompt de mise en production.** Rapport :
  https://claude.ai/artifact/V7Xyg4VH4CFy2YVWEnJzxW (tableau avant/après).
  (1) PDF lisible à toute taille (pièces sécables, en-têtes de tableau
  répétés, test pdfjs de non-chevauchement à 40/80/300 véhicules) ;
  (2) import d'un vrai Excel (titre fusionné, ligne d'en-tête détectée,
  totaux ignorés, « n/d », séparateurs de milliers, synonymes, messages
  sans nom technique) ; (3) erreurs d'auth en français
  (`src/lib/authErrors.ts`), écran « courriel envoyé », réglages SMTP dans
  `docs/deploiement.md` ; (4) note au conseil cohérente (étapes selon la
  VAN, subventions confirmées vs à demander, statu quo, pluriels) ;
  (5) démo : plan retenu « Économies d'abord » appliqué (VAN positive,
  nuancé), garages en station H2 externe ; (6) appliquer une stratégie =
  une écriture atomique (`apply_project_vehicle_changes`) ; (7) rattrapage
  lissé des remplacements en retard (`lisserRattrapage`, paramétrable) +
  investissement brut / statu quo / écart partout ; (8) bandeau « puissance
  de garage présumée » → Ma flotte › Garages ; (9) libellés en clair
  (électrique, hydrogène, thermique neuf, « à l'échappement », hypothèses
  prudentes, conditions de subvention lisibles, vrais pluriels — garde-fou
  CI) ; (10) formats selon la langue (tonnes, annexe du PDF, Excel arrondi,
  % au lieu de ratio), derniers textes anglais ; (11) nom d'organisation
  demandé (accueil, Rapports), jamais « Mon organisation » sur un rapport.
  A : **moteur 2.5.0** — ravitaillement H2 par garage auto/dépôt/externe
  (prix livré, détour, aucun capex de station), seuil
  `seuil_station_h2_depot_vehicules` (estimation), méthodologie §3.5.
  B : VAN décomposée par poste (Σ = VAN) à l'écran, au PDF et dans l'Excel
  (`synthese.ts`, `VanDecompositionCard`). C : optimiseur borné à 5 s,
  progression, meilleur résultat « approché », plus aucune relance
  automatique (Web Worker complet : plus tard). Migrations 20261007010000,
  20261007020000 (additives).
  Contre-audit (même jour) : fichier Excel BRUT importé tel quel (76/80,
  « Description » = catégorie si aucune colonne catégorie, libellés usuels
  → catégorie, dates « mai 2016 », années « 2015? », libellé ambigu jamais
  deviné) ; PDF > 500 véhicules réparé (pied de page positionné par le
  haut : `bottom` + numéro de page dynamique faisait planter react-pdf ;
  test à 600 véhicules) ; langue « en-CA » respectée (`startsWith`, garde-fou
  CI) ; préparation de l'optimiseur découpée (gel 5,5 s → ~3 s) ; plus aucun
  « (s) », « BEV », « au pot » ; scripts e2e alignés. Mesures à 1 000
  véhicules : application 4,7 s, optimiseur 9,7 s « approché », PDF 16,9 s,
  écran Stratégies 3,2–4,9 s (Web Worker du point 14 encore à faire).

- **Mise en production et sécurité (points 1 à 6) : LIVRÉ, en attente du
  « ok » (validation de la bascule) ; point 7 lancé à la demande de
  l'utilisateur (« fais ce qu'il reste de ton côté »).** Un commit et des tests par point.
  (1) production h2fleet.ca : `src/lib/production/site.ts` (redirections
  301 = même liste que le routeur, CSP construite depuis l'URL Supabase,
  anciens liens « /#/ » → chemins, garde de config `build:prod`),
  `scripts/serveur-production.mjs`, CI e2e sur le bundle de production
  (toute violation de CSP = échec), CORS `https://*.domaine` (aperçus),
  dépôt privé anticipé (Pages s'arrête, job lourd de nuit/manuel/production),
  `docs/production.md` (Cloudflare, DNS, DKIM/DMARC — jamais d'Email Routing, MX IONOS,
  bascule, dépôt privé, retour arrière) ; (2) `docs/historique-git.md` +
  `scripts/historique/nettoyer-courriel.sh` (simulation par défaut, testé
  sur dépôt factice, NON exécuté) ; (3) identifiants télématiques chiffrés
  AES-256-GCM (`_shared/telematicsCrypto.ts`, clé TELEMATICS_ENCRYPTION_KEY,
  AAD user:provider, contrainte NOT VALID 20261008010000, navigateur sans
  identifiants), `get-mapbox-token` sur `_shared/`, fonctions retirées
  supprimées par Deploy Supabase (`scripts/fonctions-retirees.json`),
  `docs/securite-secrets.md` ; (4) favicon du dépôt, /dashboard/roadmap →
  Suivi, recalcul serveur des alertes (`surveillanceProjet.ts` partagé
  écran/serveur, `recalculAlertesServeur.ts`, workflow quotidien,
  `sync_plan_alerts_serveur` service_role, CI : 0 écart écran/serveur) ;
  (5) courriels : un seul interrupteur (aujourd'hui `SMTP_PASSWORD`, `docs/courriels.md`),
  gabarit `organization_invite`, statut GET send-email (VITE_EMAILS_ACTIVE
  retiré), pg_cron planifié par le déploiement (`scripts/taches-cron.mjs`) ;
  (6) `docs/legal/` (EFVP IA, entente de pilote, entente de traitement —
  brouillons à faire valider par un juriste), confidentialité mise à jour.
  Migrations 20261008010000, 20261008020000 (additives).

- **Courriels IONOS + confirmation du courriel (parties A et B) : LIVRÉ,
  en attente du « ok ».** A : arrivée « Adresse confirmée ✅ » 2,5 s puis
  l'espace ; attente « Vérifiez vos courriels » (session détectée entre
  onglets, code à 6 chiffres `verifyOtp`, « Me connecter » prérempli,
  renvoi avec délai de 60 s, « Modifier l'adresse ») ; liens expirés /
  déjà utilisés / invalides expliqués + « Renvoyer un lien » ; aucune
  énumération ; hash routing compatible (aucune Redirect URL de plus).
  B : SendGrid retiré ; `send-email` et `plan-alerts-digest` par SMTP
  IONOS (`smtp.ionos.com:465`, `noreply@h2fleet.ca`), courriel de test
  admin dans Paramètres, contrôle de santé (SMTP_PASSWORD, secret de test
  interdit), DNS IONOS relevé (`docs/production.md`, phase D), Brevo
  documenté pour plus tard (SPF à fusionner, non fait).

- **Point 7 — traçabilité trésorier + tornade (audit 12 et 13) : LIVRÉ,
  en attente du « ok ».** `src/lib/library/liens.ts` (PUR, testé : liens
  profonds `/dashboard/library?h=…`, `?onglet=categories&cat=…&col=prix`,
  hypothèses par poste de la VAN, raccordement par palier) ; Bibliothèque
  adressable (onglet piloté par l'URL, hypothèses ciblées filtrées et
  surlignées, nouvel onglet « Catégories de véhicules »,
  `CategoryDefaultsTab`) ; liens `LienBibliotheque` depuis la VAN par
  poste, l'infrastructure par garage, la catégorie en Faisabilité et
  chaque barre de la tornade. `src/lib/journey/tornade.ts` (PUR, testé :
  libellés complets fr/en, unités, échelle commune, statu quo expliqué
  par scénario, `libelleEcart` jamais « économie » négative) ; barres de
  la sensibilité enrichies (`basse/centrale/haute/sens`, additif) ;
  tornade HTML (plus de Recharts). `src/lib/journey/annexeSources.ts`
  (sources numérotées, prix par catégorie, URL sécables) → PDF annexes E
  et F + tableau de tornade + statu quo par scénario. Excel : cellules
  `CelluleFormule`/`CelluleLien` (`valeurCellule`, `valeurExcelJs`),
  vraies formules vérifiées par un évaluateur (`classeurFormules.test.ts`)
  et par l'e2e terrain.

Rappels de méthode : chaque phase finit par `npm run check` vert → push →
résumé court → **attendre le « ok » de l'utilisateur** ; kanban intégré à
l'étape Suivi (pas de module autonome) ; aucune suppression de données en
base (retraits = routes/menus seulement) ; identifiants télématiques non
touchés ; hypothèses de calcul : jamais de valeur, URL ou montant
inventé — statut « vérifié » seulement si la source a été réellement lue,
sinon « à_valider » avec l'URL à consulter.

### Liste pré-pilote (à tenir à jour)

- Clé `TELEMATICS_ENCRYPTION_KEY` à poser (chiffrement livré ; sans clé,
  la télématique répond 503).
- Secrets à régénérer / créer (audit sécurité : CRON_SECRET,
  INTERNAL_FUNCTION_SECRET, ALLOWED_ORIGINS…).
- IA (Phase 5) : ajouter `ANTHROPIC_API_KEY` dans les secrets Supabase ;
  compléter l'EFVP (communication de renseignements hors Québec vers
  Anthropic, États-Unis) avant d'activer une fonction IA pour un client
  (brouillon : `docs/legal/efvp-ia-anthropic.md`) ; coût estimé à
  confirmer sur la facture réelle.
- Courriels d'auth : SMTP IONOS branché (fait par l'utilisateur) ; RECOLLER
  le modèle « Confirm signup » mis à jour le 2026-10-06 (dit où saisir le
  code : page de connexion H2Fleet) — `docs/courriels-auth/confirm-signup.html`.
- Facturation réelle (DEMO_MODE donne le plan le plus élevé à tous).
- Revue juridique des pages légales (Loi 25, CGU, confidentialité).
- Hypothèses et programmes « à_valider » : vérification par
  l'utilisateur (sources listées dans la Bibliothèque). Nouvelles
  estimations du test terrain à confirmer : paliers de raccordement,
  puissance présumée d'un garage, batterie utile par catégorie, charge
  utile, réserve, jours d'utilisation, fenêtre présumée, majoration amont
  de l'essence (reprise du diesel) ; prix de l'essence saisi au registre
  (la collecte hebdomadaire ne couvre que le diesel).
- Services reportés : secrets SMTP des courriels applicatifs
  (`SMTP_PASSWORD` = seul interrupteur, `docs/courriels.md`), Mapbox, clé IA,
  secrets du Vault (les tâches pg_cron sont alors planifiées par Deploy
  Supabase).
- **Sauvegardes de la base : AUCUNE aujourd'hui.** Solution la plus
  simple : plan Supabase incluant les sauvegardes quotidiennes
  automatiques (Database → Backups, restauration en un clic ; plan et
  rétention à vérifier sur la grille tarifaire). Alternative gratuite :
  workflow planifié `supabase db dump` chiffré (dépôt public : jamais
  d'artefact en clair). À faire AVANT toute donnée client réelle.
- Administrateur H2Fleet et fonctions IA du compte de l'utilisateur :
  secret GitHub `H2FLEET_ADMIN_EMAIL` → étape idempotente du workflow
  Deploy Supabase (`scripts/admin-heberge.mjs`) ; ne fait qu'activer
  (retirer le secret pour garder une fonction désactivée).
- Veille des subventions : la file est traitée par les administrateurs
  H2Fleet (`user_roles`, voir ci-dessus) ; la première lecture hebdomadaire
  établit l'état initial ; un changement validé ne met PAS le registre à
  jour (mise à jour dans `subsidy-programs.ts` après lecture de la
  source).
- Note au conseil : faire relire le modèle et la note IA par un
  responsable municipal avant le premier dépôt ; les montants restent
  ceux du moteur (hypothèses « à valider » listées en annexe).
- DNS courriel (IONOS) : vérifier l'activation DKIM (sélecteur
  `s42582890` sans clé publiée), ajouter `rua=` au DMARC puis passer à
  `p=quarantine` ; ne jamais toucher aux MX ni au SPF d'IONOS.
- Bascule h2fleet.ca, réécriture de l'historique (adresse courriel) et
  passage du dépôt en privé : décisions de l'utilisateur
  (`docs/production.md`, `docs/historique-git.md`).
- Récapitulatif hebdomadaire (préférence courriel) non implémenté.
- Tarifs à définir (fin de projet) : `landing.pricing`, Pricing.tsx,
  badges d'abonnement.
- Pages légales : remplacer les placeholders (nom légal, adresse,
  responsable Loi 25) une fois l'entreprise créée + revue par un juriste.
- npm audit : avis sur le serveur de dev Vite/esbuild (correctif =
  Vite 8, montée de version majeure à planifier) ; avis modérés
  react-router 6 et uuid (correctifs = versions majeures, à planifier).

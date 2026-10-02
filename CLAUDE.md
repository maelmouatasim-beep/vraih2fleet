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
  subvention) ; `progress.ts` (état réel des 7 étapes).
- `src/lib/fleet/` — flotte : import (synonymes FR/EN, modèle
  téléchargeable `importTemplate.ts`), garages (`garagesModel.ts` pur,
  `garages.ts` accès base), classe PNBV (`gvwr.ts`). Un module testé ne
  doit pas importer le client Supabase (la CI n'a pas de `.env`).
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
npm run test:tco       # tests du moteur TCO avec seuils de couverture 95 %
npm run docs:tco       # régénère docs/tco-hypotheses.md depuis assumptions.ts
npm run e2e:local      # parcours complet Playwright contre Supabase LOCAL (voir scripts/e2e-parcours.mjs)
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
  message clair (SendGrid, IA, Mapbox reportés par l'utilisateur).
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

Rappels de méthode : chaque phase finit par `npm run check` vert → push →
résumé court → **attendre le « ok » de l'utilisateur** ; kanban intégré à
l'étape Suivi (pas de module autonome) ; aucune suppression de données en
base (retraits = routes/menus seulement) ; identifiants télématiques non
touchés ; hypothèses de calcul : jamais de valeur, URL ou montant
inventé — statut « vérifié » seulement si la source a été réellement lue,
sinon « à_valider » avec l'URL à consulter.

### Liste pré-pilote (à tenir à jour)

- Chiffrement des identifiants télématiques (aujourd'hui simple base64).
- Secrets à régénérer / créer (audit sécurité : CRON_SECRET,
  INTERNAL_FUNCTION_SECRET, ALLOWED_ORIGINS…).
- Assistant IA : choisir un fournisseur hors passerelle Lovable
  (`assistant-chat` dépend de `LOVABLE_API_KEY`).
- SMTP personnalisé (courriels d'auth vers des testeurs externes).
- Facturation réelle (DEMO_MODE donne le plan le plus élevé à tous).
- Revue juridique des pages légales (Loi 25, CGU, confidentialité).
- Hypothèses et programmes « à_valider » : vérification par
  l'utilisateur (sources listées dans la Bibliothèque). Nouvelles
  estimations du test terrain à confirmer : paliers de raccordement,
  puissance présumée d'un garage, batterie utile par catégorie, charge
  utile, réserve, jours d'utilisation, fenêtre présumée, majoration amont
  de l'essence (reprise du diesel) ; prix de l'essence saisi au registre
  (la collecte hebdomadaire ne couvre que le diesel).
- Services reportés sur le site de test : SendGrid (+ réactiver
  « Confirm email »), Mapbox, clé IA, tâches pg_cron
  (`supabase/snippets/taches-planifiees.sql`).
- `get-mapbox-token` : CORS `*` et pas de vérification explicite de
  l'appelant (jeton public, risque faible) — à aligner sur `_shared/`.
- Invitations d'équipe : aucun courriel envoyé automatiquement (la
  personne voit l'invitation en se connectant) — brancher send-email.
- Récapitulatif hebdomadaire (préférence courriel) non implémenté.
- /dashboard/roadmap encore accessible hors menu (à retirer ou
  intégrer au Suivi).
- Tarifs à définir (fin de projet) : `landing.pricing`, Pricing.tsx,
  badges d'abonnement.
- Pages légales : remplacer les placeholders (nom légal, adresse,
  responsable Loi 25) une fois l'entreprise créée + revue par un juriste.
- npm audit : avis sur le serveur de dev Vite (correctif = Vite 8,
  montée de version majeure à planifier).

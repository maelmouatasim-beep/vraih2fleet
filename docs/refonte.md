# Refonte H2Fleet — Phase 0 : cartographie et plan

Document de référence de la refonte (voir la section « Avancement de la
refonte » de `CLAUDE.md` pour l'état courant). Établi à partir d'une
cartographie complète du code sur la branche
`claude/code-integration-site-o88hza`.

## 1. État des lieux

### 1.1 Routes actuelles

**Publiques** : `/` (Home), `/about`, `/contact`, `/ecosystem`, `/docs`,
`/api`, `/careers`, `/press`, `/changelog`, `/roadmap` (placeholder
public), 9 pages guides (`/guides/*`), `/login`, `/signup`,
`/forgot-password`, `/reset-password`, `/oauth/consent`.

**Protégées** (`/dashboard/*`) : dashboard, projects, projects/:id,
scenarios (page globale), scenarios/new, scenarios/new-flexible,
scenarios/comparison, scenario/:id (mock), analytics, infrastructure,
roadmap (RoadmapBuilder), wizard (TransitionWizard), telematics,
donnees-ref, custom-data, suppliers, subsidies, incentives (rend en fait
Subsidies), tasks (kanban), api, help, support, settings.

**Anomalies relevées** :
- `/dashboard/incentives` rend `Subsidies`, pas `IncentivesPage.tsx`
  (importée mais jamais routée — code mort).
- `Auth.tsx` : page jamais routée (code mort).
- `ScenarioDetail.tsx` : 100 % de données mock.
- `Admin.tsx` : mock, aucun lien dans la sidebar.
- `/dashboard/scenarios/new` sans `projectId` : la sauvegarde échoue
  (bouton cassé depuis la page globale Scénarios).
- `TasksQuickStats`, `incentives/IncentivesCalculator.tsx` (507 l.) :
  jamais importés.

### 1.2 Classement des pages (décisions actées)

| Page / module | Décision | Détail |
|---|---|---|
| Annuaire fournisseurs (`SuppliersPage`, `SuppliersDirectory`, `SuppliersMap`, hooks `useSuppliers`, `useFavoriteSuppliers`) | **Retirer** | Routes et menu supprimés ; tables `hydrogen_suppliers`/`user_favorite_suppliers` conservées en base (aucune suppression de données). Section fournisseurs d'`Ecosystem.tsx` retirée aussi. |
| Page Scénarios globale (`Scenarios.tsx`, 796 l.) | **Retirer** | La comparaison de scénarios devient l'étape « Stratégies » du parcours projet. Les pages par-projet (`NewScenario`, `NewFlexibleScenario`, `ScenarioComparison`) sont réutilisées/absorbées. |
| Page Incitatifs / Subventions autonome (`Subsidies.tsx` + `components/subsidies/*`) | **Retirer (absorber)** | Le contenu (programmes, calculateur, échéancier) alimente l'étape « Financement » du parcours projet. |
| Pages publiques vides (`Api`, `Careers`, `Press`, `Changelog`, `Roadmap` public) | **Retirer** | Placeholders de 42 lignes ; redirections propres vers `/`. |
| `Docs.tsx` | **Retirer** | Squelettique (EN en dur, ancres cassées) ; redirigée vers `/` ; l'aide vit dans « Aide ». |
| Kanban de tâches (`TaskBoardPage`, `components/tasks/*`, hooks `useTasks`/`useTaskComments`, tables `tasks`/`task_comments`/`task_attachments`) | **Garder et intégrer** | Plus de module autonome dans le menu : les tâches vivent dans l'étape « Suivi » de chaque projet, liées à projet/véhicule/année/subvention. Tables et composants réutilisés. |
| `ScenarioDetail.tsx` (mock), `Admin.tsx` (mock), `IncentivesPage.tsx`, `Auth.tsx`, `TasksQuickStats`, `IncentivesCalculator.tsx` | **Supprimer (code mort)** | Aucun impact utilisateur. |
| Dashboard, Projects, ProjectDetail, Analytics, Infrastructure, RoadmapBuilder, TransitionWizard, Telematics, donnees-ref, custom-data, Help, Support, Settings | **Garder / fusionner** | Réorganisés dans le menu 6 entrées et le parcours 7 étapes (détail en §3). |

### 1.3 Sites de calcul TCO / coûts / CO₂

**Trois moteurs TCO indépendants qui ne partagent aucune constante :**

1. `src/lib/calculations/*` — moteur client principal (capex, opex,
   emissions, tco, flexibleTCO, infrastructure, conditions,
   multiplicateurs). Utilisé par les pages scénarios, l'infra, le wizard,
   les PDF.
2. `supabase/functions/calculate-tco` — moteur serveur divergent
   (assurance 1 %/an absente côté client, CO₂ EV/H2 ~6× le client,
   `npv = -tcoTotal`). Seul appelant : `api-gateway` avec la clé service
   role → `getUserOrThrow` le rejette : **probablement en 401 permanent,
   jamais appelé par le front**.
3. `src/lib/calculations.ts` — ancien moteur, seul à déduire les
   subventions, utilisé uniquement par `ScenarioDetail.tsx` (100 % mock).

**+ ~15 calculs « maison »** dans hooks/composants avec leurs propres
constantes : `useEnhancedAnalytics` (prix ZE 380k/550k, subventions
100k/150k, inflation 2 %/1 %), `useRiskAnalysis`, `useRealDataMetrics`,
`useCustomPricing` (diesel 1,85 !), `useScenarioRecommendations`
(subventions 100k/200k), `InfrastructureEconomics` (économies = 30 % de
l'OPEX), `GridCapacityManager`, `ScenarioForm` (duplique fleetMix),
`caseStudies.ts`, `recommendations/thresholds.ts`, etc.

**Hypothèses dupliquées** (extrait — le rapport complet liste ~25 lignes) :
CO₂ diesel 2,68 kg/L à **12 emplacements** (+ variantes 2,6 / 2,69) ;
conso BEV 120 kWh/100km à 4 endroits mais **0,2 kWh/km** dans
`emissions.ts` (facteur 6 d'écart client/serveur sur le CO₂) ; prix
diesel 1,48 / 1,50 / 1,52 / 1,68 / 1,85 selon le fichier ; station H2
1,5 M / 2,5 M / 3,35 M ; valeur résiduelle 12 ans-plancher 10 % vs
20 %-10 ans ; jours 365 / 300 / 250.

**Incohérences majeures à corriger par construction dans le nouveau moteur :**
- Les **subventions ne sont jamais déduites** du TCO principal (stockées,
  ignorées).
- La référence « diesel seul » de `tco.ts` est faussée dès qu'un
  `vehicleConfiguration` existe (payback null, baseline faux).
- La moitié des champs de `ScenarioForm` (résiduel, durée de vie, consos,
  h2Type, pile à combustible…) sont stockés mais **ignorés par le moteur**.
- `reference_data_ranges` : catégories cherchées ≠ catégories seedées
  (élec/H2/véhicules retombent toujours sur les défauts) ; facteur CO₂
  réseau injecté en kg/kWh dans un champ en kg/MWh (erreur ×1000).
- Surcharges d'experts (CO₂, conso, infra) éditables dans l'UI mais lues
  par aucun calcul.
- PDF : taux d'actualisation ×100 sur une valeur déjà en % (« 500 % »).
- `WizardTCOStep` : upsert `onConflict: scenario_id` sans contrainte
  UNIQUE en base.

## 2. Cible produit (rappel)

> À partir de ma flotte réelle, obtenir un plan de remplacement
> pluriannuel chiffré, finançable et défendable, puis le suivre.

- Menu 6 entrées : **Accueil, Projets, Ma flotte, Bibliothèque,
  Organisation, Aide**.
- Parcours projet 7 étapes : **Flotte → Faisabilité → Stratégies → Plan →
  Financement → Rapports → Suivi**, avec barre de progression.
- Planification véhicule par véhicule.

## 3. Plan détaillé des phases 1 à 3

### Phase 1 — Moteur TCO unique (`src/lib/tco/`)

**Objectif** : un seul module pur, testé, source unique de toutes les
hypothèses ; les moteurs dupliqués morts sont supprimés.

**Fichiers créés** :
- `src/lib/tco/types.ts` — `VehicleInput` (type, âge, km/an, conso
  actuelle, techno cible, prix d'achat, coût énergie, maintenance, part
  d'infra, subventions, valeur résiduelle, horizon), `ProjectAssumptions`,
  `VehicleTcoResult`, `PlanTcoResult`.
- `src/lib/tco/assumptions.ts` — **la** table d'hypothèses par défaut
  (prix énergie, facteurs CO₂, consos par catégorie, coûts infra,
  actualisation, inflation), visible et surchargée par projet.
- `src/lib/tco/engine.ts` — fonctions pures : TCO par véhicule par année,
  coût total du plan, économies vs statu quo (statu quo = flotte actuelle
  réelle, pas des défauts), CO₂ évité. **Subventions déduites du CAPEX.**
  NPV avec taux en % converti une seule fois.
- `src/lib/tco/__tests__/engine.test.ts` + `assumptions.test.ts` — cas
  CAD : diesel vs BEV vs FCEV, subvention, résiduel, inflation, CO₂,
  statu quo, horizon variable.

**Fichiers supprimés** (duplication morte, aucun impact utilisateur) :
- `src/lib/calculations.ts` (ancien moteur) + `src/pages/ScenarioDetail.tsx`
  (mock) + sa route.
- `supabase/functions/calculate-tco/` (injoignable : 401 permanent depuis
  api-gateway ; le front ne l'appelle jamais) + l'appel dans
  `api-gateway` remplacé par 501/410.

**Gardé provisoirement** : `src/lib/calculations/*` reste tel quel tant
que les pages scénarios existantes s'en servent — elles disparaissent en
phase 2/3 ; le retirer ici casserait la moitié du site pour rien.
(Décision simple notée, réversible.)

**Ordre** : types → assumptions → engine → tests → suppressions → check.

**Risques** : divergence temporaire ancien/nouveau moteur (assumée,
documentée ici) ; suppression de calculate-tco = nouvelle migration
inutile (aucune table touchée). Aucune donnée supprimée en base.

### Phase 2 — Navigation : menu 6 entrées + parcours 7 étapes

**Menu** (`DashboardLayout.tsx` réécrit) : Accueil (`/dashboard`),
Projets (`/dashboard/projects`), Ma flotte (`/dashboard/fleet`),
Bibliothèque (`/dashboard/library` : données de référence + données
personnalisées + télématique), Organisation (`/dashboard/organization` :
profil, équipe, paramètres), Aide (`/dashboard/help` + support fusionné).

**Parcours projet** : `src/pages/project/ProjectJourney.tsx` — layout
avec barre de progression 7 étapes, routes
`/dashboard/projects/:id/{flotte,faisabilite,strategies,plan,financement,rapports,suivi}` ;
en phase 2 chaque étape est une coquille qui embarque l'existant quand il
y en a (ProjectDetail éclaté), le contenu réel arrive en phase 3.

**Accueil** : tableau de bord recentré (projets en cours, prochaine
échéance de subvention, avancement du plan).

**Retraits** (routes + menu + redirections `<Navigate>` ; les tables
restent en base) : suppliers, scenarios (page globale), subsidies/
incentives autonomes, tasks autonome, pages publiques vides (api,
careers, press, changelog, roadmap public, docs), Ecosystem §fournisseurs.

**Code mort supprimé** : IncentivesPage, Auth.tsx, Admin.tsx,
TasksQuickStats, IncentivesCalculator, composants suppliers/*.

**i18n** : nouvelles clés fr + en (insertions ciblées — jamais de
réécriture des JSON : clés dupliquées).

**Risques** : liens internes cassés (balayage `grep` des `to=`/`navigate`
avant push) ; l'aperçu artifact et Pages doivent être republiés (hash
routing).

### Phase 3 — Contenu des 7 étapes + démo

Ordre de construction (chaque bloc = commit) :
1. **Flotte** : import CSV/Excel (papaparse/xlsx), table véhicules
   éditables → « Ma flotte » partagée, sélection par projet.
2. **Faisabilité** : verdict par véhicule (faisable BEV / FCEV / à
   reporter) + raison chiffrée (km/j vs autonomie, âge, catégorie).
3. **Stratégies** : 2-3 scénarios comparés côte à côte (moteur
   `src/lib/tco/`), absorbe NewFlexibleScenario/ScenarioComparison ;
   suppression de `src/lib/calculations/*` à la fin de ce bloc.
4. **Plan** : remplacements véhicule par véhicule sur l'horizon, budget
   annuel, graphique de trésorerie.
5. **Financement** : programmes + montants + échéances (absorbe les
   composants subsidies), rattachés au plan.
6. **Rapports** : PDF fr/en « prêt pour le conseil » (react-pdf existant,
   taux d'actualisation corrigé).
7. **Suivi** : réalisé vs prévu + **tâches intégrées** (composants kanban
   réutilisés ; migration additive : colonnes `vehicle_id`, `plan_year`,
   `subsidy_program_id` sur `tasks` + RLS ; tâches auto-créées depuis les
   échéances de subventions ; vue liste par statut ; assignation).
8. **Démo** : municipalité québécoise ~40 véhicules (seed local,
   `seedDemoData` réécrit sur le nouveau moteur).

**Risques** : volume — découpé en 8 commits testables ; migration tasks
(additive, RLS, jamais modifier l'existant) ; i18n massif (deux locales à
chaque bloc).

## 4. Limites connues / hors périmètre refonte

- Stockage des identifiants télématiques : **non touché** (étape dédiée
  après la refonte).
- Tables devenues orphelines (hydrogen_suppliers, user_favorite_suppliers,
  scenarios globaux…) : conservées en base, aucune suppression.
- `calculate-tco` supprimé du dépôt mais la fonction déployée chez
  Supabase doit être retirée à la main (liste pré-pilote).

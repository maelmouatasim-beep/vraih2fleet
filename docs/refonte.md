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

### 1.3 Sites de calcul TCO / coûts / CO₂ (rapport agent 2)

_(à compléter — rapport en cours)_

## 2. Cible produit (rappel)

> À partir de ma flotte réelle, obtenir un plan de remplacement
> pluriannuel chiffré, finançable et défendable, puis le suivre.

- Menu 6 entrées : **Accueil, Projets, Ma flotte, Bibliothèque,
  Organisation, Aide**.
- Parcours projet 7 étapes : **Flotte → Faisabilité → Stratégies → Plan →
  Financement → Rapports → Suivi**, avec barre de progression.
- Planification véhicule par véhicule.

## 3. Plan détaillé des phases 1 à 3

_(complété avec le rapport calculs — voir ci-dessous)_

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

## 3. Plan des phases (mis à jour après l'audit du 2026-09-28)

### Phase 1 — Moteur TCO unique (`src/lib/tco/`)

Exigence absolue : chiffres **exacts, traçables et défendables** — ils
seront présentés à des conseils municipaux et audités. Deux sous-phases,
arrêt pour « ok » à la fin de 1A.

**1A — Méthode, hypothèses, cas de référence (aucun code moteur)**
- `docs/tco-methodologie.md` : spécification complète en français,
  formules écrites, lisible par un directeur des finances municipal.
  Conventions : année 0 = acquisition ; flux en fin d'année ; flux
  NOMINAUX avec inflation par poste (diesel, électricité, H2, entretien,
  général) actualisés au taux NOMINAL ; CAD de l'année de référence du
  projet ; taux stockés en décimal (0.05), % à l'affichage seulement ;
  unités explicites et typées avec une seule fonction de conversion
  testée. Entrées PAR VÉHICULE alignées sur la future table `vehicles` ;
  conso « inconnue » → défaut de catégorie marqué « estimation ».
- Postes : acquisition (taxes NON récupérables paramétrées par type
  d'organisation) ; subventions déduites l'année de versement (plafonds,
  admissibilité, cumul ; programme suspendu/fermé non compté par défaut) ;
  énergie (diesel $/L ; élec = kWh véhicule ÷ rendement de recharge, coût
  effectif avec frais de puissance Hydro-Québec ; H2 $/kg livré ;
  majoration hivernale paramétrable) ; entretien $/km + événements
  majeurs datés ; infrastructure calculée UNE FOIS au niveau site/plan
  puis répartie (somme des parts = total) ; assurance/immatriculation si
  fournies ; valeur résiduelle dégressive avec plancher, ≤ prix d'achat ;
  horizon ≠ durée de vie (re-remplacement ou résiduel de fin d'horizon).
- Référence statu quo corrigée : même flotte réelle, même calendrier de
  fin de vie, remplacement diesel neuf équivalent, mêmes hypothèses ;
  économies = alternative − référence, poste par poste.
- Émissions réservoir-à-roue ET puits-à-roue (diesel avec CH4/N2O — ECCC
  RIN ; électricité par province, QC par défaut ; H2 par filière) ;
  tCO2e/an, cumulées, évitées, coût/tonne évitée ; coût social du
  carbone d'ECCC affiché SÉPARÉMENT, hors TCO.
- Sorties : vue économique (TCO actualisé, TCO/km, VAN différentielle,
  récupération simple et actualisée avec null expliqué, coût/tonne) et
  vue budgétaire (flux nominaux par année, investissement PTI vs
  fonctionnement, subventions à leur année, reste à financer) ;
  ventilation ligne par ligne ; engineVersion + empreinte des hypothèses.
- Incertitude : `src/lib/tco/sensitivity.ts` relance le VRAI moteur sur
  la flotte réelle (remplace la logique inventée de useRiskAnalysis) ;
  chaque hypothèse externe a une plage basse/centrale/haute sourcée ou
  « à_valider » ; 3 scénarios cohérents (Prudent/Central/Favorable),
  toujours une fourchette ; trajectoire du prix d'achat (batteries)
  sourcée et désactivable ; change USD-CNY/CAD et douanes selon
  l'origine ; devis Hydro-Québec saisi prioritaire sur l'estimation ;
  niveau de risque CALCULÉ + 3 paramètres les plus influents.
- `src/lib/tco/assumptions.ts` : SOURCE UNIQUE des défauts — valeur,
  unité, plage, région, année des dollars, source {organisme, document,
  année, tableau/page, URL}, date de vérification, statut
  `vérifié | estimation | à_valider`. Règle d'honnêteté : « vérifié »
  seulement si la source a été réellement ouverte ; sinon « à_valider »
  + URL exacte ; aucune valeur/URL/montant inventé.
- `src/lib/tco/subsidy-programs.ts` : admissibilité, montant ou %,
  plafond, cumul, statut, date limite, date de vérification.
- Sort de `reference_data_ranges` : défauts dans le code, versionnés et
  sourcés ; en base, seulement des surcharges par projet réellement lues
  par le moteur (les catégories seedées ≠ cherchées et les surcharges
  d'experts ignorées disparaissent avec l'ancien système).
- `docs/tco-hypotheses.md` GÉNÉRÉ depuis assumptions.ts + test CI de
  fraîcheur.
- 6 cas de référence québécois calculés INDÉPENDAMMENT par un sous-agent
  n'ayant accès qu'à la méthodologie et aux hypothèses (jamais au code) :
  camionnette BEV, autobus 12 m BEV, camion lourd BEV, véhicule léger
  BEV, camion/autobus H2, mini-plan 5 véhicules (infra partagée,
  2 subventions cumulées, re-remplacement). Livrables :
  `docs/tco-cas-de-reference.md` (année par année) +
  `docs/tco-verification.xlsx` (formules visibles, aucune valeur collée)
  + écart ancien moteur → nouveau avec causes.
- Fin 1A : résumé (conventions, tableau des hypothèses, « à valider »
  avec URL, écarts ancien/nouveau) → push → **attendre ok**.

**1B — Moteur, tests, nettoyage (après ok)**
- `src/lib/tco/{types,units,assumptions,subsidy-programs,engine,sensitivity}.ts` :
  fonctions PURES, déterministes (ni réseau, ni base, ni date implicite),
  centimes entiers ou décimal (arrondi à l'affichage), zod, jamais de
  NaN/Infinity. La spec est mise à jour si le code révèle un trou.
- Tests ≥ 95 % lignes et branches : 6 cas ±0,01 $ (en cas d'écart,
  trouver qui a tort, jamais modifier un cas pour passer) ; fast-check
  (km↑⇒énergie↑ ; subvention↑⇒TCO↓ jamais sous le coût net ; taux 0 ⇒
  somme simple ; équivalence Fisher nominal/réel ; référence vs
  elle-même = 0 ; N identiques = N×1 ; Σ parts infra = total ;
  résiduel ≤ prix ; plafonds/cumul ; sens de chaque sensibilité) ;
  conversions d'unités ; régression figée.
- Reproductibilité : engineVersion + empreinte d'hypothèses dans chaque
  résultat ; type « snapshot d'hypothèses » prêt pour la persistance.
- Garde-fous CI : constantes d'hypothèses (2.68, 2.6, 2.69, prix diesel,
  365/300/250…) interdites hors `src/lib/tco/` ; tout NOUVEL import de
  `src/lib/calculations/` interdit (lint).
- Nettoyage : `src/lib/calculations.ts`, `ScenarioDetail.tsx` + route,
  `supabase/functions/calculate-tco` (410 dans api-gateway).
- **Critère bloquant noté** : `src/lib/calculations/` entièrement
  supprimé à la fin du bloc 3 de la Phase 3.
- Hors périmètre Phase 1 : aucun changement d'interface ; identifiants
  télématiques non touchés.

### Phase 2 — Fondations des données + navigation

- **2a. Organisations** : aucune entité organisation n'existe
  (`profiles.company` = texte libre). Créer `organizations` +
  `organization_members` (admin / membre / lecteur), rattacher projets et
  flotte à une organisation, RLS dès la migration, migration de
  peuplement : chaque utilisateur existant reçoit sa propre organisation
  (aucune perte de données). `pending_invitations` réutilisée pour
  inviter l'équipe ; `project_collaborators` conservé pour les invités
  externes. Corriger `getProjectById`/`listProjects` (filtre `user_id` →
  un projet partagé devient « introuvable »).
- **2b. Table `vehicles` (« Ma flotte »)** au niveau organisation, une
  ligne par véhicule : numéro d'unité, VIN (opt.), marque, modèle,
  année, mise en service, catégorie/classe, carburant, km/an, conso
  réelle + source (saisie / télématique / estimation), usage/trajet,
  département, dépôt, statut. Import CSV/Excel validé. Lien
  `telematics_vehicles` → `vehicles`. Table `project_vehicles` : les
  véhicules d'un projet avec année de remplacement + techno cible.
- **2c. Télématique** : supprimer TOUTE valeur aléatoire (conso, trajet,
  km/an) ; conso mesurée sinon « inconnue » → défaut de catégorie marqué
  « estimation » ; importer VIN/marque/année quand l'API les fournit ;
  plus de bascule silencieuse vers une flotte factice — mode démo
  explicite, impossible à confondre. (Stockage des identifiants : hors
  périmètre.)
- **2d. tco_results** : un seul résultat courant par scénario
  (`is_current` ou versionnage, migration additive, historique conservé) ;
  les agrégats comptent chaque flotte UNE fois par projet (bug actuel :
  120 véh. affichés pour une flotte de 40 ; 178 088 t CO2/an).
- **2e. Langue et région** : fr par défaut (détection navigateur, repli
  fr) ; clés i18n en double réparées (`pages_marketing`, `onboarding` —
  la page Confidentialité affiche des clés brutes) ; test CI échouant
  sur clé en double ou manquante ; textes en dur des pages conservées
  traduits ; région QC, devise CAD ; paramètres langue/région/devise
  réellement enregistrés (CAD ajouté).
- **2f. Menu 6 entrées + parcours 7 étapes** : comme au plan initial
  (layout `ProjectJourney`, retraits + redirections, code mort supprimé).

### Phase 3 — Contenu des 7 étapes — LIVRÉE (2026-09-28)

Les 8 blocs du plan initial (Flotte/import, Faisabilité, Stratégies,
Plan, Financement, Rapports, Suivi, Démo ~40 véhicules), livrés avec :
- **Stratégies** : le stress test d'Analytics (RiskAnalysisPanel) y
  déménage, rebranché sur `src/lib/tco/sensitivity.ts`.
- **Financement** : modèle de subventions enrichi (montant ou %,
  plafonds, cumul, programmes d'infrastructure, statut CALCULÉ à partir
  des dates, date de vérification visible). Aujourd'hui 3 des
  6 programmes en base sont échus mais marqués actifs.
- **Rapports** : un vrai export .xlsx (les boutons « Excel » actuels
  produisent des CSV) ; taux « 500 % » corrigé.
- **Suivi** : tâches intégrées ; correction du double trigger de
  notification d'assignation.
- **Assistant IA** : base de connaissances et liens réalignés sur la
  nouvelle structure et le nouveau moteur, aucun chiffre figé non sourcé.
- Fin du bloc 3 (Stratégies) : **suppression complète de
  `src/lib/calculations/`** (critère bloquant) — FAIT (−19 750 lignes ;
  ancien flux scénarios, wizard, page Infrastructure et
  RiskAnalysisPanel retirés avec redirections ; types hérités sans
  calcul dans `src/lib/legacy/scenario-types.ts`).
- Moteur 1.1.0 : année d'acquisition par véhicule (méthodologie v1.2,
  §10.11), `parametresParDefaut` traçable, programmes échus exclus à
  l'année d'achat, `statutEffectif` calculé des dates.
- Démo réécrite : « Ville de Rivière-Claire » (municipalité FICTIVE,
  40 véhicules déterministes, aucun résultat pré-calculé) — l'ancienne
  démo STM (organisation réelle, chiffres inventés) est supprimée.

### Phase 4 — Site public et conformité (obligatoire avant toute démo)

- **Études de cas** (STM, Winnipeg, ERA/AZETEC) : chiffres inventés
  présentés comme « résultats prouvés » pour des organisations non
  clientes → retirer, ou transformer en « exemples illustratifs »
  clairement étiquetés, calculés par le nouveau moteur, sans suggérer de
  relation client.
- **Tarification** : 3 versions contradictoires dans le code → une seule
  page ; **les prix sont demandés à l'utilisateur, aucun choix autonome**.
- **Retirer les promesses non livrées** : API publique, SSO/SAML, marque
  blanche, SLA, essai 14 jours, paiement ACH, faux liens sociaux,
  « partenaires vérifiés », « rejoignez les entreprises… », calculateur
  gratuit sans suite.
- **Méthodologie publique** = rendu de `docs/tco-methodologie.md`.
- **Légal** : CGU, confidentialité, remboursement en fr ET en, droit du
  Québec, conformité Loi 25 ; **nom légal de l'entreprise demandé à
  l'utilisateur** (ne pas inventer) ; pages marquées « à faire valider
  par un juriste ».
- `/dashboard/admin` protégé par `has_role` (aujourd'hui accessible à
  tout utilisateur connecté) ; README à jour (VITE_ADMIN_EMAILS obsolète,
  tests Deno).

## 4. Liste pré-pilote (tenue à jour dans CLAUDE.md)

- Chiffrement des identifiants télématiques (aujourd'hui simple base64).
- Secrets à régénérer / créer (liste de l'audit sécurité : CRON_SECRET,
  INTERNAL_FUNCTION_SECRET, ALLOWED_ORIGINS…).
- Retrait de la fonction `calculate-tco` déployée chez Supabase.
- Facturation réelle (aujourd'hui DEMO_MODE donne le plan le plus élevé
  à tous).
- Revue juridique des pages légales (Loi 25, CGU, confidentialité).

## 5. Limites connues / hors périmètre refonte

- Stockage des identifiants télématiques : **non touché** (étape dédiée
  après la refonte).
- Tables devenues orphelines (hydrogen_suppliers, user_favorite_suppliers,
  scenarios globaux…) : conservées en base, aucune suppression.

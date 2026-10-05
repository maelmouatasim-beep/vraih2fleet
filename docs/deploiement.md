# Déploiement : projet Supabase propre + site de test GitHub Pages

L'ancienne base (`fihklznbfufhowopwwuc`) appartient à Lovable Cloud :
aucun accès administrateur, aucune des tables récentes. Le site de test
bascule sur **ton propre projet Supabase**, déployé automatiquement par
GitHub Actions. Rien n'est supprimé chez Lovable, et aucune donnée n'est
reprise automatiquement : si des comptes ou projets de l'ancienne base
doivent être conservés, le signaler avant la bascule.

**Règle absolue** : seules des valeurs PUBLIQUES transitent par le chat
(ref du projet, URL, clé publishable/anon). Mot de passe de la base,
jetons d'accès, clés secrètes : saisis directement par toi dans GitHub ou
Supabase, jamais ailleurs.

---

## Statut (2026-10-02)

**Bascule faite.** Le site de test (GitHub Pages) utilise le projet
`rjyvcogtvcgzwxeprgsm` ; l'ancienne base Lovable (`fihklznbfufhowopwwuc`)
n'est plus utilisée par le site de test (rien n'y a été supprimé).
Premier déploiement : 63 migrations appliquées, 9 edge functions
déployées, contrôle de santé « Base conforme au dépôt » ; les tables
`vehicles`, `organizations`, `project_vehicles`, `energy_client_inputs`,
`report_snapshots` répondent (HTTP 200, `[]` en anonyme grâce à la RLS).

Fait : étapes 1, 2, 3 ; étape 4 : URLs d'auth + secrets `ALLOWED_ORIGINS`,
`CRON_SECRET`, `INTERNAL_FUNCTION_SECRET`, `APP_BASE_URL`,
`CONTACT_INBOX_EMAIL`. Courriels d'authentification : SMTP IONOS
configuré dans le tableau de bord (2026-10-05). **Reportés** : secrets SMTP
des courriels applicatifs, Mapbox, clé IA de l'assistant, tâches pg_cron
(voir « Services non branchés »).

## Projet retenu (valeurs publiques)

- Ref : `rjyvcogtvcgzwxeprgsm`
- URL : `https://rjyvcogtvcgzwxeprgsm.supabase.co`
- Clé publishable : celle transmise dans le chat (`sb_publishable_…`),
  à saisir dans la variable `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Étape 1 — Créer le projet Supabase (toi) — FAIT

1. https://supabase.com/dashboard → connexion (compte GitHub possible).
2. Si demandé : **New organization** → nom libre, plan **Free**.
3. **New project** :
   - Name : `h2fleet-test`
   - Database password : **Generate a password** → copie-le dans ton
     gestionnaire de mots de passe (il servira au secret GitHub
     `SUPABASE_DB_PASSWORD` — jamais dans le chat).
   - Region : **Canada (Central)** si la liste la propose ; sinon
     **East US (North Virginia)** (la plus proche du Québec).
   - Options de sécurité : laisser les valeurs par défaut.
   - **Create new project** → attendre ~2 minutes (statut « Healthy »).
4. Relever les trois valeurs PUBLIQUES :
   - **Project ref** : Project Settings → General → *Project ID*
     (20 lettres minuscules/chiffres).
   - **URL** : `https://<ref>.supabase.co`.
   - **Clé publique** : Project Settings → API Keys → *Publishable key*
     (`sb_publishable_…`) ; si un onglet *Legacy API keys* affiche une clé
     `anon` (`eyJ…`), l'une ou l'autre convient.
5. **Jeton d'accès** (pour GitHub Actions) : avatar en haut à droite →
   Account preferences → **Access Tokens** → *Generate new token* →
   nom `github-actions-vraih2fleet` → copie-le directement dans le secret
   GitHub de l'étape 2 (il n'est affiché qu'une fois).

**À me transmettre dans le chat** : le *Project ref*, l'URL et la clé
publishable/anon. Rien d'autre.

## Étape 2 — Secrets GitHub (toi) — FAIT

https://github.com/maelmouatasim-beep/vraih2fleet/settings/secrets/actions
(Settings → Secrets and variables → Actions → onglet **Secrets** →
**New repository secret**), un par un :

| Nom exact | Valeur |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | le jeton d'accès (étape 1.5) |
| `SUPABASE_DB_PASSWORD` | le mot de passe de la base (étape 1.3) |
| `SUPABASE_PROJECT_REF` | le Project ref (étape 1.4) |
| `H2FLEET_ADMIN_EMAIL` | (facultatif) l'adresse de TON compte sur le site de test : rôle administrateur H2Fleet (file de la veille des subventions) + les 4 fonctions IA activées pour tes organisations, quotas de test (2 000 000 jetons/mois, 200 requêtes/jour) — étape « Administrateur H2Fleet et fonctions IA » du workflow Deploy Supabase (`scripts/admin-heberge.mjs`, idempotent, adresse masquée dans les journaux) |

Le dépôt est PUBLIC : l'adresse ne vit que dans ce secret. Après l'avoir
créé, relancer **Deploy Supabase** (Actions → Deploy Supabase → Run
workflow) ou pousser un commit. Le script ne fait qu'activer : pour garder
une fonction IA désactivée, retirer le secret après l'activation.

## Étape 3 — Variables GitHub (toi) — FAIT

Même page, onglet **Variables** → **New repository variable** :

| Nom exact | Valeur |
|---|---|
| `VITE_SUPABASE_PROJECT_ID` | le Project ref |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | la clé publishable/anon (remplace l'ancienne) |

Je n'ai pas d'outil pour écrire ces variables : c'est toi qui les saisis.
Le workflow *Deploy Pages* vérifie que l'URL correspond au ref.

## Étape 4 — Configuration côté Supabase (toi) — liste à cocher

**Authentification** (Authentication → URL Configuration)
- [ ] Site URL : `https://maelmouatasim-beep.github.io/vraih2fleet/`
- [ ] Redirect URLs : ajouter `https://maelmouatasim-beep.github.io/vraih2fleet/**`
      et `http://localhost:8080/**`
- [ ] (Authentication → Sign In / Providers → Email) « Confirm email »
      activé. NB : le service d'envoi par défaut de Supabase n'envoie qu'aux
      membres de l'équipe du projet et à faible débit — pour des testeurs
      externes, configurer un SMTP (Authentication → Emails → SMTP
      Settings : IONOS, section « SMTP personnalisé » plus bas — fait).

**Secrets des edge functions** (Edge Functions → Secrets, ou
`supabase secrets set`) — noms exacts :
- [ ] `ALLOWED_ORIGINS` = `https://maelmouatasim-beep.github.io,http://localhost:8080`
      (origines seulement, sans chemin)
- [ ] `CRON_SECRET` = une valeur neuve (`openssl rand -hex 32`)
- [ ] `INTERNAL_FUNCTION_SECRET` = une autre valeur neuve (`openssl rand -hex 32`)
- [ ] `APP_BASE_URL` = `https://maelmouatasim-beep.github.io/vraih2fleet`
- [ ] Courriels applicatifs (SMTP IONOS, port 465) : `SMTP_HOST` =
      `smtp.ionos.com`, `SMTP_PORT` = `465`, `SMTP_USER` =
      `noreply@h2fleet.ca`, `SMTP_PASSWORD` = mot de passe de la boîte
      (toi seul — c'est l'interrupteur), `EMAIL_FROM` =
      `noreply@h2fleet.ca`, `EMAIL_FROM_NAME` = `H2Fleet` ; et
      `CONTACT_INBOX_EMAIL` (boîte qui reçoit le formulaire de contact).
      Détails et courriel de test : `docs/courriels.md`.
- [ ] `MAPBOX_PUBLIC_TOKEN` (cartes), si utilisé
- [ ] `ANTHROPIC_API_KEY` : clé de l'API Claude (console Anthropic →
      API Keys), saisie PAR TOI dans Supabase → Edge Functions → Secrets
      (jamais dans le dépôt ni le chat). Facultatifs : `ANTHROPIC_MODEL`
      (défaut `claude-opus-5-5`), `AI_FEATURES_DISABLED=true` pour tout
      couper. Ensuite, un administrateur active chaque fonction IA dans
      Organisation › Intelligence artificielle (désactivées par défaut).
- [ ] (facultatif) `GEOTAB_API_URL`, `SAMSARA_API_URL` : seulement pour
      remplacer les URLs par défaut des fournisseurs.
- [ ] Ne PAS définir `FEATURE_PUBLIC_API` (API publique et MCP restent en 404).

**Tâches planifiées** (pg_cron, extensions activées par les migrations)
- [ ] Integrations → Vault → *Add new secret* : `h2fleet_project_url` =
      `https://<ref>.supabase.co` ; `h2fleet_cron_secret` = la MÊME valeur
      que `CRON_SECRET`.
- [ ] SQL Editor → coller et exécuter `supabase/snippets/taches-planifiees.sql`
      (3 tâches : rappels d'échéances de subventions chaque matin,
      synchro télématique toutes les 6 h, purge du journal de limite de
      débit). La dernière requête du script liste les 3 tâches.

## Étape 5 — Déploiement automatique (GitHub Actions)

À chaque push sur `claude/code-integration-site-o88hza` :

- **Deploy Supabase** (`.github/workflows/deploy-supabase.yml`) :
  `supabase link` → `supabase db push --dry-run` (liste) →
  `supabase db push` (toutes les migrations, additives) →
  `supabase functions deploy` (toutes les fonctions, `verify_jwt` de
  `supabase/config.toml`) → contrôle de santé. Sans les 3 secrets : le
  run s'arrête proprement avec un avertissement.
- **Deploy Pages** (`.github/workflows/deploy-pages.yml`) : build avec les
  3 variables du dépôt → https://maelmouatasim-beep.github.io/vraih2fleet/.
  Sans les variables : pas de redéploiement (le site en ligne reste tel
  quel), avertissement.

Chaque lundi (et à la demande) :

- **Veille des subventions** (`.github/workflows/veille-subventions.yml`,
  Phase 5.5) : relit les pages et PDF officiels des programmes du
  registre, archive le texte lu dans `data/veille/<date>/` (commit sur la
  branche), compare à la lecture précédente (`data/veille/etat.json`) et
  dépose chaque changement de montant, date ou statut dans la file de
  validation (`subsidy_watch_changes`) par l'API de gestion. Un
  administrateur H2Fleet (`user_roles`) valide ou rejette dans
  Bibliothèque › Veille des subventions ; rien n'est appliqué
  automatiquement. La première lecture établit l'état initial (aucun
  changement). Sans les secrets : détections archivées dans le dépôt
  seulement.

Tâches pg_cron (`supabase/snippets/taches-planifiees.sql`, à exécuter
une fois) : rappels d'échéances, synchronisation télématique, purge du
journal de débit et, depuis la Phase 5.6, `h2fleet-plan-alerts-digest`
(résumé quotidien des nouvelles alertes de surveillance ; 503
`service_non_configure` tant que `SMTP_PASSWORD` n'est pas posé, rien n'est
perdu : les alertes partent au premier passage après branchement).

Premier déploiement : après les étapes 2 et 3, relancer les deux
workflows (Actions → workflow → **Run workflow**) ou pousser un commit.

En cas d'échec de `db push` : il s'arrête à la première migration en
erreur, sans rien appliquer d'elle (chaque migration est une
transaction). Le journal du run nomme le fichier ; on corrige par une
NOUVELLE migration.

## Étape 6 — Contrôles après migration

1. **Santé de la base** : dernière étape de *Deploy Supabase*
   (`node scripts/verifier-base.mjs --heberge`). Elle compare le projet au
   manifeste `supabase/schema-attendu.json` (47 tables avec RLS,
   161 policies, 37 fonctions SQL, 45 triggers, 1 bucket — régénéré et
   vérifié en CI à chaque migration), puis vérifie : chaque edge function
   déployée et active avec le bon `verify_jwt`, l'absence de
   `calculate-tco`, les NOMS des secrets requis (les valeurs ne sont
   jamais lues), la Site URL et les Redirect URLs GitHub Pages, les
   3 tâches pg_cron.
2. **Parcours complet** : Actions → **E2E base hébergée** → Run workflow.
   Le site est construit comme GitHub Pages et servi dans le runner ;
   deux comptes `e2e-…@example.com` sont créés confirmés (mot de passe
   aléatoire masqué), le parcours des 7 étapes + rapports fr/en +
   invitation d'équipe est joué contre la base hébergée (toute requête
   vers un autre projet Supabase fait échouer le run), puis les comptes et
   leurs organisations sont **supprimés** — même en cas d'échec. Les
   captures sont jointes au run (artefact `e2e-captures`, 7 jours).
3. **À la main** sur https://maelmouatasim-beep.github.io/vraih2fleet/ :
   inscription avec ta vraie adresse, courriel de confirmation reçu,
   lien → tableau de bord ; « Mot de passe oublié » → courriel → lien →
   nouveau mot de passe.

## Services non branchés (site de test)

Tant qu'une clé manque, le contrôle de santé n'émet qu'un
**avertissement** (jamais un échec) et l'application affiche un message
clair — les edge functions répondent `503 {"error":"service_non_configure"}`
(`src/lib/serviceNonConfigure.ts`) :

| Service manquant | Comportement |
|---|---|
| `SMTP_PASSWORD` | Formulaires contact / démo : la demande est **enregistrée** (`email_leads`, message compris) et l'écran le dit (« Demande enregistrée — l'envoi automatique de courriels n'est pas encore activé »). Support : « votre demande n'a pas été transmise ». Invitation de collaborateur : créée, « prévenez la personne vous-même ». |
| `ANTHROPIC_API_KEY` | Le copilote, l'analyse IA de l'import intelligent et la lecture de factures répondent « pas encore branché sur ce site (clé ANTHROPIC_API_KEY à ajouter) » ; aucune erreur, rien n'est envoyé. L'import intelligent (synonymes connus + association manuelle) et les pièces justificatives (saisie à côté du document) restent utilisables sans IA. |
| `MAPBOX_PUBLIC_TOKEN` | Aucune carte n'est affichée dans les écrans actuels ; la fonction répond 503. |
| Tâches pg_cron | Pas de rappels d'échéances ni de synchro télématique planifiée ; à activer avec `supabase/snippets/taches-planifiees.sql` (planifiées automatiquement par *Deploy Supabase* dès que les secrets du Vault existent). |

### Courriels d'authentification sans SMTP (historique)

Sans SMTP personnalisé, le service intégré de Supabase n'envoie qu'aux
adresses des membres de l'équipe du projet, à très faible débit (il
fallait alors décocher « Confirm email » pour tester avec d'autres
adresses). Ce n'est plus le cas depuis le branchement d'IONOS : garder
**Confirm email** activé. Le workflow « E2E base hébergée » n'en dépend
pas (comptes créés confirmés par l'API d'administration).

### SMTP personnalisé — IONOS (fait le 2026-10-05)

Même boîte pour les deux circuits : `noreply@h2fleet.ca`, créée chez
IONOS (le domaine h2fleet.ca y est déjà : SPF et DKIM IONOS publiés).
**Ports** : 465 (TLS implicite). Les fonctions Edge de Supabase bloquent
25 et 587 ; le SMTP d'auth du tableau de bord accepte 465 aussi, on garde
le même partout.

1. **Supabase** → projet `rjyvcogtvcgzwxeprgsm` → **Authentication →
   Emails → SMTP Settings** → **Enable custom SMTP** (fait) :

   | Champ | Valeur |
   |---|---|
   | Sender email | `noreply@h2fleet.ca` |
   | Sender name | `H2Fleet` |
   | Host | `smtp.ionos.com` |
   | Port number | `465` |
   | Username | `noreply@h2fleet.ca` (adresse complète) |
   | Password | mot de passe de la boîte (saisi par toi, jamais dans le dépôt ni le chat) |

2. **Authentication → Rate Limits** : envoi de courriels `30` par heure
   (fait ; à relever si la boîte IONOS le permet).
3. **Authentication → Sign In / Providers → Email** : **Confirm email**
   coché (fait).
4. **Authentication → URL Configuration** : Site URL
   `https://maelmouatasim-beep.github.io/vraih2fleet/` et Redirect URLs
   `https://maelmouatasim-beep.github.io/vraih2fleet/**` (déjà en place ;
   **aucune URL de plus** pour la confirmation : en routage par hash, le
   lien revient à la racine du site, `src/lib/authRedirect.ts`). Après la
   bascule en production : ajouter `https://h2fleet.ca/**` (le lien vise
   alors `https://h2fleet.ca/auth/confirme`) et passer la Site URL à
   `https://h2fleet.ca`.
5. **Authentication → Emails → Templates** (bilingues, FR puis EN) :
   - *Confirm signup* : objet et corps dans
     `docs/courriels-auth/confirm-signup.html` (lien
     `{{ .ConfirmationURL }}` **et** code à 6 chiffres `{{ .Token }}`, pour
     confirmer depuis un autre appareil — écran « Vérifiez vos
     courriels »). Le code expire avec le lien (réglage « Email OTP
     Expiration », 1 h par défaut).
   - *Reset password* : même gabarit, lien `{{ .ConfirmationURL }}`.
6. **Courriels applicatifs** (invitations, résumés, rappels) : secrets des
   fonctions listés à l'étape 4, puis Paramètres → *Courriel de test*
   (`docs/courriels.md`).

### Plus tard : Brevo (service transactionnel) — NON fait

Si le volume dépasse la limite de la boîte IONOS, Brevo (ex-Sendinblue)
offre un relais SMTP et un suivi de délivrabilité. Points d'attention,
**rien n'est à faire aujourd'hui** :

- le domaine reste chez IONOS : Brevo demande d'ajouter son propre
  enregistrement DKIM (CNAME ou TXT, sans conflit) **et** d'autoriser ses
  serveurs dans le SPF. Un domaine ne peut avoir **qu'un seul**
  enregistrement SPF : il faudrait **fusionner** l'existant
  (`v=spf1 include:_spf-us.ionos.com ~all`) en un seul enregistrement qui
  contient les deux `include:` — jamais en créer un second ;
- les enregistrements MX d'IONOS ne changent pas (la réception reste chez
  IONOS) ;
- côté code, seuls `SMTP_HOST`, `SMTP_USER` et `SMTP_PASSWORD` changent
  (Brevo propose aussi le port 465).

## Points ouverts

- **Sauvegardes** : aucune sauvegarde restaurable de la base de test
  aujourd'hui. Solution la plus simple : passer le projet à un plan
  Supabase qui inclut les sauvegardes quotidiennes automatiques
  (Database → Backups ; restauration depuis le tableau de bord — vérifier
  le plan et la rétention sur la grille tarifaire avant de souscrire).
  Alternative sans abonnement : workflow GitHub planifié `supabase db
  dump` CHIFFRÉ (dépôt public : jamais d'artefact en clair).

- **IA** : fournisseur = API Claude d'Anthropic (fonctions `copilot`,
  Phase 5.2, `fleet-import`, Phase 5.3, `document-reader`, Phase 5.4, et `council-note`, Phase 5.7) ; l'ancienne fonction `assistant-chat` (passerelle Lovable)
  est retirée du dépôt — si elle reste déployée sur la base hébergée,
  la supprimer : `supabase functions delete assistant-chat`.
- **Courriels** : SMTP IONOS branché pour l'authentification ; courriels
  applicatifs dès que les secrets SMTP sont posés (`docs/courriels.md`).

## Supabase local (développement, CI)

`npx supabase start` puis `npx supabase db reset --local` ; les URLs de
redirection locales sont dans `supabase/config.toml` (section `[auth]`,
sans effet sur le projet hébergé). Après toute nouvelle migration :
`node scripts/verifier-base.mjs --generer` pour mettre à jour le
manifeste (la CI échoue sinon). Parcours local : `npm run e2e:local`.

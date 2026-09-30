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

## Étape 2 — Secrets GitHub (toi)

https://github.com/maelmouatasim-beep/vraih2fleet/settings/secrets/actions
(Settings → Secrets and variables → Actions → onglet **Secrets** →
**New repository secret**), un par un :

| Nom exact | Valeur |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | le jeton d'accès (étape 1.5) |
| `SUPABASE_DB_PASSWORD` | le mot de passe de la base (étape 1.3) |
| `SUPABASE_PROJECT_REF` | le Project ref (étape 1.4) |

## Étape 3 — Variables GitHub (toi, ou moi si tu me donnes les valeurs publiques)

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
      Settings, ex. SendGrid).

**Secrets des edge functions** (Edge Functions → Secrets, ou
`supabase secrets set`) — noms exacts :
- [ ] `ALLOWED_ORIGINS` = `https://maelmouatasim-beep.github.io,http://localhost:8080`
      (origines seulement, sans chemin)
- [ ] `CRON_SECRET` = une valeur neuve (`openssl rand -hex 32`)
- [ ] `INTERNAL_FUNCTION_SECRET` = une autre valeur neuve (`openssl rand -hex 32`)
- [ ] `APP_BASE_URL` = `https://maelmouatasim-beep.github.io/vraih2fleet`
- [ ] `SENDGRID_API_KEY` (envoi des courriels applicatifs) et
      `CONTACT_INBOX_EMAIL` (boîte qui reçoit le formulaire de contact)
- [ ] `MAPBOX_PUBLIC_TOKEN` (cartes), si utilisé
- [ ] Assistant IA : **à décider** — la fonction `assistant-chat` passe
      aujourd'hui par la passerelle IA de Lovable (`LOVABLE_API_KEY`),
      qui n'existe pas hors Lovable. Voir « Points ouverts ».
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

## Points ouverts

- **Assistant IA** : `assistant-chat` appelle la passerelle Lovable
  (modèle Gemini via `LOVABLE_API_KEY`), indisponible hors Lovable.
  Choix à faire : brancher un fournisseur dont tu as une clé (par ex.
  l'API Anthropic avec `ANTHROPIC_API_KEY`, adaptation de la fonction à
  prévoir) ou laisser l'assistant désactivé sur le site de test.
- **Courriels** : SMTP personnalisé nécessaire pour des testeurs externes
  (voir étape 4).

## Supabase local (développement, CI)

`npx supabase start` puis `npx supabase db reset --local` ; les URLs de
redirection locales sont dans `supabase/config.toml` (section `[auth]`,
sans effet sur le projet hébergé). Après toute nouvelle migration :
`node scripts/verifier-base.mjs --generer` pour mettre à jour le
manifeste (la CI échoue sinon). Parcours local : `npm run e2e:local`.

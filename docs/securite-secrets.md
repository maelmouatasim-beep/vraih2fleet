# Régénérer les secrets des fonctions (avec h2fleet.ca)

Procédure **de ton côté**, à faire pendant la phase B de `docs/production.md`
(compte environ 15 minutes). Les valeurs ne passent **jamais** par le chat ni par
le dépôt : tu les génères sur ton ordinateur et tu les colles directement dans
Supabase.

**Où** : Supabase → projet `rjyvcogtvcgzwxeprgsm` → **Edge Functions →
Secrets**. Un secret modifié est pris en compte par les fonctions sans
redéploiement.

**Générer une valeur** (Terminal macOS / Linux, ou Git Bash sous Windows) :

```bash
openssl rand -hex 32        # CRON_SECRET, INTERNAL_FUNCTION_SECRET
openssl rand -base64 32     # TELEMATICS_ENCRYPTION_KEY (32 octets exactement)
```

## Ordre (sans interruption de service)

### 1. `ALLOWED_ORIGINS` (origines autorisées à appeler les fonctions)

Remplace la valeur par cette liste exacte, en une seule ligne, sans espace ni
barre finale :

```
https://h2fleet.ca,https://www.h2fleet.ca,https://h2fleet.pages.dev,https://*.h2fleet.pages.dev,https://maelmouatasim-beep.github.io,http://localhost:8080
```

- `https://*.h2fleet.pages.dev` couvre les aperçus Cloudflare : un seul
  niveau de sous-domaine, en HTTPS (règle testée,
  `supabase/tests/cors.test.ts`).
- Retire `https://maelmouatasim-beep.github.io` quand le dépôt sera privé
  (GitHub Pages arrêté).
- **Vérification** : sur `https://h2fleet.pages.dev`, connecté, ouvre le
  copilote ou une carte. Sans erreur CORS dans la console, c'est bon.

### 2. `CRON_SECRET` (tâches planifiées pg_cron)

Le secret est lu à deux endroits, qui doivent porter la **même** valeur :

1. Génère une valeur : `openssl rand -hex 32`.
2. **Vault d'abord** : Supabase → Integrations → **Vault** → secret
   `h2fleet_cron_secret` → *Edit* → colle la valeur.
3. **Puis** Edge Functions → Secrets → `CRON_SECRET` → même valeur.
4. **Vérification** : SQL Editor →
   `select jobname, status, return_message from cron.job_run_details order by start_time desc limit 5;`.
   Après la prochaine exécution, une tâche réussie est `succeeded` et la
   fonction répond 200, pas 401.

Entre les étapes 2 et 3, une tâche peut échouer une fois (401). Elle
réessaie à l'heure suivante : aucune donnée n'est perdue.

### 3. `INTERNAL_FUNCTION_SECRET` (appels de fonction à fonction)

Utilisé par `notify-subsidy-deadlines` et `plan-alerts-digest` pour
appeler `send-email`.

1. Génère une valeur : `openssl rand -hex 32`.
2. Edge Functions → Secrets → `INTERNAL_FUNCTION_SECRET` → colle la
   valeur. Les deux côtés lisent le même secret : la rotation est
   instantanée.

### 4. `TELEMATICS_ENCRYPTION_KEY` (nouveau : chiffrement des identifiants télématiques)

1. Génère une clé : `openssl rand -base64 32`. Il faut 32 octets, sinon la
   fonction refuse la clé.
2. Edge Functions → Secrets → **Add new secret** →
   `TELEMATICS_ENCRYPTION_KEY` → colle la clé.
3. **Garde une copie hors ligne** (gestionnaire de mots de passe). **Si la
   clé est perdue, les connexions Geotab/Samsara enregistrées sont
   illisibles** : chaque utilisateur doit alors se reconnecter. Aucune autre
   donnée n'est touchée.
4. **Rotation plus tard** (au moins une fois par an, ou si la clé a pu
   fuiter) :
   - copie la clé actuelle dans `TELEMATICS_ENCRYPTION_KEY_PREVIOUS` ;
   - mets une nouvelle clé dans `TELEMATICS_ENCRYPTION_KEY` ;
   - les connexions sont re-chiffrées avec la nouvelle clé à leur prochaine
     utilisation et par la synchronisation planifiée ;
   - après une semaine, supprime `TELEMATICS_ENCRYPTION_KEY_PREVIOUS`.

Sans cette clé, l'écran Télématique affiche « service non configuré »
(503). Rien ne casse ailleurs.

### 5. `APP_BASE_URL` (à la bascule, phase C)

`https://h2fleet.ca`

### 6. Vérification d'ensemble

GitHub → Actions → **Deploy Supabase** → *Run workflow*. Le contrôle de
santé doit lister :
- `secret de fonction … défini` pour `ALLOWED_ORIGINS`, `CRON_SECRET` et
  `INTERNAL_FUNCTION_SECRET` ;
- aucun avis pour `TELEMATICS_ENCRYPTION_KEY`.

## Ce que le dépôt fait déjà (aucune action de ta part)

- **Fonctions retirées supprimées automatiquement** : `assistant-chat` et
  `calculate-tco` (`scripts/fonctions-retirees.json`) sont supprimées du
  projet hébergé par le workflow Deploy Supabase si elles y sont encore. Le
  contrôle de santé échoue si l'une d'elles réapparaît. Une fonction encore
  présente dans le dépôt n'est jamais supprimée.
- **`get-mapbox-token`** : vérifie désormais l'utilisateur (comme les autres
  fonctions) et n'autorise que les origines d'`ALLOWED_ORIGINS`. Elle ne
  renvoie qu'un jeton **public** Mapbox (`pk.…`) ; un jeton secret `sk.…`
  collé par erreur est refusé.
- **Identifiants télématiques** :
  - chiffrés AES-256-GCM côté serveur, jamais renvoyés au navigateur ;
  - la base refuse toute nouvelle écriture en clair ;
  - la déconnexion efface les identifiants (marqueur `revoque`) ;
  - les anciennes connexions encodées en base64, s'il y en a, sont
    re-chiffrées à la première utilisation.

## Si un secret a fuité

Régénère-le immédiatement selon la procédure ci-dessus. Pour un jeton
d'accès Supabase (`SUPABASE_ACCESS_TOKEN`) ou le mot de passe de la base :
- jeton : supabase.com → Account → Access Tokens → *Revoke*, puis crée un
  nouveau jeton ;
- mot de passe : Project Settings → Database → *Reset database password*.

Mets ensuite à jour les secrets GitHub correspondants (Settings → Secrets
and variables → Actions).

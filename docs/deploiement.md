# Déploiement sur le Supabase hébergé (B10)

Procédure exacte pour mettre la base hébergée (`fihklznbfufhowopwwuc`) au
niveau du dépôt : **51 migrations** (dont `20260929010000_energy_client_inputs`
et `20260929013000_report_snapshots`, nécessaires au test du site) et
**9 edge functions**. À exécuter depuis ta machine — l'environnement de
développement de Claude n'a que la clé anon, aucun accès d'administration.

Tout est **additif** : aucune migration ne détruit de données.

## 0. Prérequis (une fois)

```bash
# CLI Supabase (>= 2.x). Au choix :
npm install -g supabase        # ou : brew install supabase/tap/supabase
supabase login                 # ouvre le navigateur, crée un access token
```

Il te faut aussi le **mot de passe de la base** : Dashboard Supabase →
projet → Settings → Database → « Database password » (bouton *Reset
database password* si tu ne l'as plus — sans effet sur l'application,
seule la connexion directe l'utilise).

## 1. Lier le dépôt au projet hébergé

Depuis la racine du dépôt (`vraih2fleet/`) :

```bash
supabase link --project-ref fihklznbfufhowopwwuc
# demande le mot de passe de la base
```

## 2. Vérifier l'état des migrations

```bash
supabase migration list --linked
```

Trois cas possibles :

- **Toutes les lignes ont Local ET Remote** → déjà à jour, passe à l'étape 4.
- **Les lignes récentes (2026-09-25 → 2026-09-29) n'ont que Local** →
  cas attendu ; passe à l'étape 3.
- **Les ANCIENNES lignes (2026-01-xx, appliquées du temps de Lovable)
  n'apparaissent pas côté Remote alors que les tables existent** → il faut
  d'abord « réparer » l'historique pour que `db push` ne les rejoue pas :

  ```bash
  # marque comme déjà appliquées les versions dont les tables existent déjà
  supabase migration repair --status applied <version1> <version2> ...
  # <version> = le préfixe horodaté du fichier, ex. 20260126174225
  ```

  Pour savoir si une ancienne migration est déjà en base : SQL Editor →
  `select * from supabase_migrations.schema_migrations order by version;`
  et compare avec `ls supabase/migrations/`.

## 3. Appliquer les migrations en attente

```bash
supabase db push --dry-run   # montre ce qui serait joué, ne touche à rien
supabase db push             # applique, dans l'ordre horodaté
```

## 4. Vérification post-migration (SQL Editor)

```sql
-- Les tables du bloc A/B doivent exister :
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('organizations','organization_members','vehicles',
    'project_vehicles','energy_client_inputs','report_snapshots')
order by table_name;      -- attendu : les 6 lignes

-- Aucune table publique sans RLS :
select c.relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- attendu : 0 ligne
```

## 5. Redéployer les edge functions

`supabase/config.toml` porte les réglages `verify_jwt` par fonction — le
déploiement depuis le dépôt les applique.

```bash
supabase functions deploy api-gateway
supabase functions deploy assistant-chat
supabase functions deploy authenticate-telematics
supabase functions deploy fetch-telematics-vehicles
supabase functions deploy get-mapbox-token
supabase functions deploy mcp
supabase functions deploy notify-subsidy-deadlines
supabase functions deploy send-email
supabase functions deploy sync-telematics-data

# l'ancienne fonction calculate-tco a été SUPPRIMÉE du dépôt (Phase 1B) :
supabase functions delete calculate-tco
```

## 6. Secrets des fonctions (noms dans .env.example, valeurs jamais dans le dépôt)

```bash
supabase secrets set \
  ALLOWED_ORIGINS="https://maelmouatasim-beep.github.io,http://localhost:8080" \
  CRON_SECRET="<génère : openssl rand -hex 32>" \
  INTERNAL_FUNCTION_SECRET="<génère : openssl rand -hex 32>" \
  APP_BASE_URL="https://maelmouatasim-beep.github.io/vraih2fleet"
# + selon les besoins : SENDGRID_API_KEY, CONTACT_INBOX_EMAIL,
#   MAPBOX_PUBLIC_TOKEN, LOVABLE_API_KEY, GEOTAB_API_URL, SAMSARA_API_URL
# (liste complète et rôles : .env.example et SECURITY.md)
```

Rappel de l'audit sécurité : CRON_SECRET et INTERNAL_FUNCTION_SECRET
doivent être **régénérés** (jamais réutiliser d'anciennes valeurs).

## 7. Côté site de test (GitHub Pages)

1. La clé « anon public » du projet (Dashboard → Settings → API Keys) va
   dans la **variable de dépôt** GitHub `VITE_SUPABASE_PUBLISHABLE_KEY`
   (Settings → Secrets and variables → Actions → Variables).
2. Relancer le workflow **Deploy Pages** (Actions → Deploy Pages →
   Run workflow) ou pousser n'importe quel commit.
3. Tester : https://maelmouatasim-beep.github.io/vraih2fleet/ —
   inscription/connexion, puis le parcours projet.

## En cas d'échec de `db push`

- `db push` s'arrête à la PREMIÈRE migration en erreur et n'applique pas
  les suivantes : copie le message d'erreur tel quel dans la conversation,
  rien n'est corrompu (chaque migration est une transaction).
- Erreur du type « relation already exists » sur une ancienne migration :
  c'est le cas « historique à réparer » de l'étape 2 (`migration repair`).

# Sécurité — H2Fleet

## Signaler une faille

Écrire à **contact@h2fleet.ca** avec l'objet `[SECURITY]`. Décrire le
problème, les étapes de reproduction et l'impact estimé. Ne pas ouvrir
d'issue GitHub publique pour une faille non corrigée. Nous accusons
réception sous 72 h.

## Modèle de menace

H2Fleet est un SaaS multi-locataires destiné à des municipalités et des
sociétés de transport. Les données sensibles sont : les inventaires de
flotte et scénarios financiers des clients, les identifiants télématiques
(Geotab/Samsara), les emails et préférences des utilisateurs, et les leads
commerciaux.

Adversaires considérés :

1. **Anonyme sur Internet** — ne doit rien pouvoir lire, ne peut qu'envoyer
   les formulaires publics (démo, contact), sous limite de débit + pot de
   miel, et ne choisit jamais le destinataire ni le contenu HTML d'un email.
2. **Utilisateur authentifié malveillant** — ne doit accéder qu'à ses
   propres données. Toute isolation passe par la RLS Postgres ; les edge
   functions qui agissent pour un utilisateur utilisent un client portant
   son JWT (jamais le service role) pour que la RLS s'applique aussi côté
   fonctions.
3. **Collaborateur "viewer"** — lecture seule : les politiques RLS séparent
   SELECT (tout membre) et INSERT/UPDATE/DELETE (owner/editor).
4. **Contenu fourni par l'utilisateur ou des tiers** (noms de véhicules,
   fournisseurs, messages, URLs) — traité comme donnée : rendu DOM via
   textContent (`src/lib/safeDom.ts`), emails échappés (`escapeHtml`),
   URLs limitées à https vers des hôtes publics (anti-XSS et anti-SSRF),
   contexte de l'assistant IA borné et validé (anti-injection de prompt).

## Authentification des edge functions

`verify_jwt` (config.toml) n'est **pas** une authentification : la clé anon
publique suffit à le franchir. Chaque fonction vérifie explicitement son
appelant via `supabase/functions/_shared/auth.ts` :

| Fonction | Appelant attendu | Vérification |
| --- | --- | --- |
| `send-email` (demo_request, contact) | public | rate limit IP + pot de miel, destinataire fixé côté serveur |
| `send-email` (support_request, collaboration_invite, task_mention) | utilisateur | `getUserOrThrow` (JWT réel), destinataire résolu en base |
| `send-email` (subsidy_reminder, plan_alerts_digest) | interne | `requireInternalSecret` (x-internal-secret) ; lien du résumé construit côté serveur à partir de l'UUID du projet, textes échappés |
| `notify-subsidy-deadlines` | pg_cron | `requireCronSecret` (x-cron-secret) |
| `plan-alerts-digest` | pg_cron | `requireCronSecret` ; sans `SENDGRID_API_KEY` → 503 `service_non_configure` sans rien marquer ; destinataires résolus en base (propriétaire + admins/membres de l'organisation, préférence `plan_alerts`) ; aucune adresse dans les journaux |
| `sync-telematics-data` | pg_cron ou utilisateur | secret cron, OU JWT + propriété de la connexion |
| `calculate-tco` | — | **RETIRÉE (Phase 1B refonte)** : moteur remplacé par `src/lib/tco` côté client ; `api-gateway` répond 410 sur `/scenarios/:id/calculate`. La fonction encore déployée chez Supabase doit être supprimée à la main (liste pré-pilote). |
| `copilot` | utilisateur | `getUserOrThrow` + projet relu avec le client RLS + fonction activée pour l'organisation + quotas jour/mois par organisation + débit par utilisateur ; clé `ANTHROPIC_API_KEY` côté serveur seulement ; chaque nombre de la réponse vérifié contre les résultats d'outils |
| `fleet-import` | utilisateur | `getUserOrThrow` + réglages lus avec le client RLS (membre de l'organisation) + « import intelligent » activé + quotas par organisation + débit par utilisateur ; reçoit seulement entêtes + ≤ 3 exemples par colonne (colonnes personnelles filtrées dans le navigateur) ; réponse filtrée : entêtes et libellés absents de la requête rejetés, valeurs hors listes vidées ; rien n'est stocké |
| `document-reader` | utilisateur | `getUserOrThrow` + réglages et pièce relus avec le client RLS (même organisation, pièce encore « à vérifier ») + « lecture de factures et devis » activée + quotas + débit ; texte du PDF seul quand il existe, sinon fichier téléchargé avec le client RLS ; champs hors type et garages inconnus rejetés, nombres retrouvés dans le texte ; rien n'est écrit par la fonction (confirmation dans l'application) |
| `authenticate-telematics`, `fetch-telematics-vehicles` | utilisateur | `getUserOrThrow` |
| `get-mapbox-token` | utilisateur | verify_jwt (jeton public Mapbox uniquement) |
| `api-gateway`, `mcp` | reportés | 404 sauf `FEATURE_PUBLIC_API=true` |

Stockage `client-documents` (privé) : chemin `<organisation>/<uuid>`, lecture par les membres, dépôt par les rôles d'écriture, aucune modification ni suppression ; registre `client_documents` immuable une fois la pièce confirmée (trigger), confirmation signée par la base.

CORS : jamais `*`. Les origines viennent d'`ALLOWED_ORIGINS`
(`_shared/cors.ts`) ; sans configuration, seuls les localhost de dev.

## Drapeau FEATURE_PUBLIC_API

L'API publique (page `/dashboard/api`, webhooks, `api-gateway`, serveur
MCP) est hors produit pour l'instant. Par défaut : les deux fonctions
répondent 404 et l'UI masque la page et l'entrée de menu. Pour réactiver :
`FEATURE_PUBLIC_API=true` (secrets des fonctions) et
`VITE_FEATURE_PUBLIC_API=true` (build front). Les failles connues y ont été
corrigées malgré la désactivation (clé cherchée par hash, webhooks limités
à https vers hôtes publics).

## Secrets requis en production

À définir via `supabase secrets set` (jamais dans le dépôt ni le bundle) :

- `ALLOWED_ORIGINS` — origines du front, séparées par des virgules ;
- `CRON_SECRET` — aléatoire fort (ex. `openssl rand -hex 32`), utilisé par
  les jobs pg_cron ;
- `INTERNAL_FUNCTION_SECRET` — aléatoire fort, appels internes
  notify-subsidy-deadlines → send-email ;
- `SENDGRID_API_KEY`, `ANTHROPIC_API_KEY`, `MAPBOX_PUBLIC_TOKEN` ;
- `CONTACT_INBOX_EMAIL`, `APP_BASE_URL` (facultatifs, valeurs par défaut) ;
- `GEOTAB_API_URL`, `SAMSARA_API_URL` (facultatifs).

Le rôle admin s'attribue en base uniquement :
`INSERT INTO user_roles (user_id, role) VALUES ('<uuid>', 'admin');`

## Base de données

- RLS activée sur toutes les tables du schéma public (vérifié par
  `supabase/tests/rls-audit.test.ts`, exécuté en CI contre Supabase local).
- Écritures sensibles réservées au serveur : `subscriptions` (tier/status),
  compteurs d'`api_keys`, `notifications` (triggers SECURITY DEFINER).
- Les contacts de `hydrogen_suppliers` ne sont lisibles que par les admins ;
  l'annuaire passe par la vue `hydrogen_suppliers_directory`.
- Migrations : additives et horodatées, jamais modifiées après coup ; toute
  nouvelle table reçoit sa RLS dans la migration de création.
- Surveillance du plan (Phase 5.6) : `plan_alerts` lisible par les
  membres du projet (`can_view_project`), sans policy d'écriture ; état
  synchronisé et « vue » par les fonctions SECURITY DEFINER
  `sync_plan_alerts` / `dismiss_plan_alert`, réservées aux éditeurs
  (`can_edit_project` ; un lecteur reçoit `false`, rien n'est écrit).
  Les textes enregistrés sont rendus par l'application à partir des
  sorties du moteur ; un éditeur pourrait techniquement y écrire un autre
  texte, que le courriel échappe (pas de HTML, lien fixé côté serveur).
- Veille des subventions (Phase 5.5) : `subsidy_watch_changes` (file de
  validation) lisible par les seuls administrateurs H2Fleet
  (`has_role 'admin'`), sans aucune policy d'écriture ; le dépôt est fait
  par le workflow `veille-subventions.yml` via l'API de gestion (secrets
  GitHub existants `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`), le
  contenu des pages lues passant dans une chaîne « dollar-quoted » à
  étiquette aléatoire (aucune injection SQL possible). Décision par les
  fonctions SECURITY DEFINER `validate_subsidy_change` /
  `reject_subsidy_change` (admin vérifié, changement encore en attente,
  atomique). `subsidy_program_events` : lecture par tout utilisateur
  connecté, écriture par la seule fonction de validation. Un changement
  validé ne modifie JAMAIS le registre des programmes (mise à jour dans le
  code après lecture de la source).

## Tests de sécurité

- `deno test supabase/functions/ supabase/tests/` contre `supabase start`
  local (les helpers refusent toute URL non-localhost) ;
- audit RLS : RLS activée partout, isolation utilisateur A/B, viewer en
  lecture seule, politiques durcies (voir `supabase/tests/rls-audit.test.ts`) ;
- front : `npm run test` (XSS safeDom, redirections OAuth).

# Courriels : SMTP IONOS, un seul interrupteur

Deux circuits distincts, **la même boîte d'envoi** `noreply@h2fleet.ca`
(IONOS) :

| Circuit | Quoi | Où c'est réglé |
|---|---|---|
| Courriels d'**authentification** | confirmation d'inscription, mot de passe oublié, changement d'adresse | tableau de bord Supabase → Authentication → Emails → SMTP Settings (**fait**) |
| Courriels **applicatifs** | invitations d'équipe, résumé des alertes, rappels de subventions, mentions, formulaires | fonction Edge `send-email` → secrets des fonctions (ci-dessous) |

Tant que l'envoi applicatif n'est pas branché, chaque fonction répond
proprement « service non configuré » (503) et l'interface l'indique. Rien
ne casse.

## L'interrupteur

Supabase → **Edge Functions → Secrets** → `SMTP_PASSWORD` = le mot de
passe de la boîte `noreply@h2fleet.ca` (saisi par toi, jamais dans le
dépôt ni le chat).

Les autres réglages ont des valeurs par défaut adaptées à IONOS ; les
poser explicitement rend la configuration lisible :

| Secret | Valeur | Défaut si absent |
|---|---|---|
| `SMTP_HOST` | `smtp.ionos.com` | `smtp.ionos.com` |
| `SMTP_PORT` | `465` | `465` |
| `SMTP_USER` | `noreply@h2fleet.ca` (identifiant IONOS = adresse complète) | `EMAIL_FROM` |
| `SMTP_PASSWORD` | mot de passe de la boîte — **toi seul** | aucun : envoi coupé |
| `EMAIL_FROM` | `noreply@h2fleet.ca` | `noreply@h2fleet.ca` |
| `EMAIL_FROM_NAME` | `H2Fleet` | `H2Fleet` |
| `CONTACT_INBOX_EMAIL` | une boîte que tu lis (formulaires du site public) | `contact@h2fleet.ca` |
| `APP_BASE_URL` | `https://maelmouatasim-beep.github.io/vraih2fleet` (site de test), puis `https://h2fleet.ca` après la bascule | `https://h2fleet.ca` |

**Port 465 obligatoire** : les fonctions Edge de Supabase bloquent les
ports sortants 25 et 587. Un `SMTP_PORT` à 25 ou 587 est refusé par le
code (« service non configuré ») plutôt que d'échouer en silence. Le
port 465 utilise le TLS dès la connexion ; le certificat du serveur est
toujours vérifié (TLS 1.2 minimum).

Aucune variable `VITE_…` n'est nécessaire : l'écran demande à la fonction
si l'envoi est branché (`GET send-email` → `{ active }`).

## Vérifier : le courriel de test (2 minutes)

Paramètres → **Notifications par courriel** → *Courriel de test*
(visible pour les administrateurs H2Fleet seulement, `user_roles`) :
saisir une adresse → *Envoyer le test*. Résultat affiché :

| Résultat | Signification |
|---|---|
| Envoyé | remis au serveur IONOS ; vérifier la réception (et les indésirables) |
| Non branché | `SMTP_PASSWORD` absent, ou port 25/587 choisi |
| Identifiant ou mot de passe refusé | `SMTP_USER` / `SMTP_PASSWORD` à corriger |
| Connexion impossible | `SMTP_HOST` / `SMTP_PORT` à corriger |
| Message refusé | `EMAIL_FROM` n'est pas la boîte IONOS (ou un de ses alias) |

Limite : 10 tests par heure. Dans Gmail, « Afficher l'original » du
courriel reçu doit montrer **SPF PASS**, **DKIM PASS** (`d=h2fleet.ca`)
et **DMARC PASS**.

## Ce qui s'active alors, sans autre changement

| Courriel | Déclencheur | Destinataires | Contrôles |
|---|---|---|---|
| **Invitation d'équipe** (`organization_invite`, fr/en) | Organisation → Équipe → *Inviter* | la personne invitée (adresse lue dans l'invitation en base) | auteur de l'invitation **et** admin de l'organisation, invitation non expirée, 20 invitations / heure / utilisateur |
| **Résumé des alertes du plan** (`plan_alerts_digest`) | chaque jour à 11 h 52 UTC (pg_cron), après le recalcul serveur de 10 h 23 UTC | propriétaire + membres de l'organisation du projet ayant laissé la préférence « alertes du plan » active (activée par défaut) | secret cron ; une alerte n'est envoyée qu'une fois |
| Rappels d'échéance de subvention (`subsidy_reminder`) | chaque jour à 11 h 45 UTC (pg_cron) | utilisateurs concernés | secret cron + secret interne |
| Mention dans une tâche (`task_mention`) | commentaire avec @mention | la personne mentionnée (collaboratrice du projet) | appelant qui voit la tâche |
| Formulaires de contact / démo | site public | `CONTACT_INBOX_EMAIL` | débit par adresse IP, pot de miel |
| Courriel de test (`test_email`) | Paramètres | l'adresse saisie | administrateur H2Fleet, 10 / heure |

Ce qui s'adapte aussi tout seul :

- **Paramètres → Notifications par courriel** : le bandeau « envoi pas
  encore activé » disparaît.
- **Invitation** : le message après *Inviter* passe de « courriel non
  envoyé : prévenez la personne » à « courriel d'invitation envoyé ».
- **Liens des courriels** : `https://h2fleet.ca/…` en production (secret
  `APP_BASE_URL`), `…/#/…` sur le site de test GitHub Pages.

**Débit** : IONOS applique une limite d'envoi par boîte qui dépend de
l'offre (à vérifier dans ton espace IONOS). Les courriels d'auth sont en
plus plafonnés par Supabase (réglé à 30 / heure). Pour un pilote, c'est
suffisant ; un service transactionnel (Brevo, voir `docs/deploiement.md`)
devient utile au-delà.

## Prérequis déjà automatisés

- **Tâches pg_cron** (rappels, résumé, synchronisation télématique, purge) :
  planifiées par le workflow *Deploy Supabase* dès que les deux secrets du
  Vault existent (`h2fleet_project_url`, `h2fleet_cron_secret`, voir
  `docs/securite-secrets.md`). Le contrôle de santé les liste.
- **Recalcul des alertes côté serveur** : chaque nuit (workflow *Recalcul
  des alertes du plan*), avec le même code que l'écran. Le résumé couvre
  donc aussi les projets que personne n'a ouverts.
- **Contrôle de santé** (*Deploy Supabase*) : avertit si `SMTP_PASSWORD`
  manque ; échoue si un secret réservé aux tests locaux
  (`SMTP_TLS_CA_TESTS_ONLY`) est présent sur le projet hébergé.

## Tests automatisés

- `supabase/functions/_shared/smtpConfig.test.ts` : valeurs par défaut,
  ports bloqués, classement des erreurs.
- `supabase/tests/smtp-envoi.test.ts` (CI, étape e2e) : envoi RÉEL par le
  runtime Edge vers un faux serveur SMTP local (`scripts/mock-smtp.mjs`,
  TLS implicite, AC de test générée au démarrage) — statut, courriel de
  test refusé à un non-admin, reçu pour un admin (expéditeur, identifiant),
  invitation, mot de passe refusé. Aucun courriel ne quitte la machine.

## Plus tard : le résumé sans attendre le lendemain

- Actions → *Recalcul des alertes du plan* → *Run workflow* ;
- SQL Editor →
  `select cron.alter_job((select jobid from cron.job where jobname = 'h2fleet-plan-alerts-digest'), schedule := '*/5 * * * *');`
- attends 5 minutes, puis remets l'horaire normal avec la même commande
  et `'52 11 * * *'`.

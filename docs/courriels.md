# Courriels : tout est prêt, un seul interrupteur

Le code des courriels est **entièrement en place**. Tant que l'envoi n'est
pas branché, chaque fonction répond proprement « service non configuré »
(503) et l'interface l'indique. Rien ne casse.

## L'interrupteur

Supabase → Edge Functions → Secrets → **`SENDGRID_API_KEY`** (la clé
« Mail Send » créée à la phase D de `docs/production.md`, après
l'authentification du domaine h2fleet.ca).

C'est tout. Facultatif : `EMAIL_FROM` (défaut `no-reply@h2fleet.ca`) et
`CONTACT_INBOX_EMAIL` (défaut `contact@h2fleet.ca`).

> Les courriels d'**authentification** (confirmation d'inscription, mot de
> passe oublié) passent par le SMTP de Supabase : section « SMTP
> personnalisé » de `docs/deploiement.md`. C'est un réglage séparé, avec la
> même clé SendGrid.

## Ce qui s'active alors, sans autre changement

| Courriel | Déclencheur | Destinataires | Contrôles |
|---|---|---|---|
| **Invitation d'équipe** (`organization_invite`, fr/en) | Organisation → Équipe → *Inviter* | la personne invitée (adresse lue dans l'invitation en base) | auteur de l'invitation **et** admin de l'organisation, invitation non expirée, 20 invitations / heure / utilisateur |
| **Résumé des alertes du plan** (`plan_alerts_digest`) | chaque jour à 11 h 52 UTC (pg_cron), après le recalcul serveur de 10 h 23 UTC | propriétaire + membres de l'organisation du projet ayant laissé la préférence « alertes du plan » active (activée par défaut) | secret cron ; une alerte n'est envoyée qu'une fois |
| Rappels d'échéance de subvention (`subsidy_reminder`) | chaque jour à 11 h 45 UTC (pg_cron) | utilisateurs concernés | secret cron + secret interne |
| Mention dans une tâche (`task_mention`) | commentaire avec @mention | la personne mentionnée (collaboratrice du projet) | appelant qui voit la tâche |
| Formulaires de contact / démo | site public | `CONTACT_INBOX_EMAIL` | débit par adresse IP, pot de miel |

Ce qui s'adapte aussi tout seul :

- **Paramètres → Notifications par courriel** : le bandeau « envoi pas
  encore activé » disparaît. L'écran interroge la fonction ; il n'y a plus
  de variable `VITE_EMAILS_ACTIVE` à poser.
- **Invitation** : le message après *Inviter* passe de « courriel non
  envoyé : prévenez la personne » à « courriel d'invitation envoyé ».
- **Liens des courriels** : `https://h2fleet.ca/…` en production (secret
  `APP_BASE_URL`), `…/#/…` sur le site de test GitHub Pages.

## Prérequis déjà automatisés

- **Tâches pg_cron** (rappels, résumé, synchronisation télématique, purge) :
  planifiées par le workflow *Deploy Supabase* dès que les deux secrets du
  Vault existent (`h2fleet_project_url`, `h2fleet_cron_secret`, voir
  `docs/securite-secrets.md`). Le contrôle de santé les liste.
- **Recalcul des alertes côté serveur** : chaque nuit (workflow *Recalcul
  des alertes du plan*), avec le même code que l'écran. Le résumé couvre
  donc aussi les projets que personne n'a ouverts.

## Vérifier après activation (5 minutes)

1. Paramètres : le bandeau ambre a disparu.
2. Organisation → Équipe → invite une de tes adresses secondaires. Le
   message indique « courriel envoyé » et le courriel arrive (expéditeur
   `no-reply@h2fleet.ca`, SPF/DKIM/DMARC **PASS** dans « Afficher
   l'original »).
3. Le lendemain matin : un projet avec des alertes actives non vues produit
   un résumé.
4. Pour tester le résumé sans attendre le lendemain :
   - Actions → *Recalcul des alertes du plan* → *Run workflow* ;
   - SQL Editor →
     `select cron.alter_job((select jobid from cron.job where jobname = 'h2fleet-plan-alerts-digest'), schedule := '*/5 * * * *');`
   - attends 5 minutes, puis remets l'horaire normal avec la même commande
     et `'52 11 * * *'`.

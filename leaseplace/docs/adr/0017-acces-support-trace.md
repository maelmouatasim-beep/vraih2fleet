# ADR 0017 — Accès support « en tant que », en lecture seule

Statut : accepté (2026-10-26)

## Contexte

Le support doit voir ce que voit un client pour l'aider, sans pouvoir agir
à sa place ni consulter plus que nécessaire. Les solutions de
« connexion en tant que » donnent en général tous les droits du compte.

## Décisions

- **Rôles** : `platform_admin` et `platform_support` (`user.impersonate`) ;
  jamais vers un compte de la plateforme, jamais vers soi-même.
- **Motif obligatoire** (15 caractères au moins), **30 minutes** au plus,
  durée posée par la base ; un seul accès ouvert par session d'agent ;
  historique conservé (`privacy.impersonations`, suppression refusée).
- **Lecture seule garantie par Postgres** : toute transaction d'un acteur
  avec `impersonatorId` commence par `SET TRANSACTION READ ONLY`
  (`withActor`) — aucune écriture possible, même par un oubli applicatif.
  Les écritures « de consultation » (accusés de lecture, dossier consulté)
  sont sautées pendant l'accès.
- **Minimisation** : aucune pièce, facture ni export téléchargeable pendant
  l'accès (403).
- **Traçabilité** : `support.impersonation_started` (motif, cible) et
  `support.impersonation_ended` au journal, sous l'identité de l'agent ;
  bandeau permanent dans l'espace consulté, avec le nom de l'agent, l'heure
  de fin et « Terminer l'accès ».

## Conséquences

- Le support ne peut pas « corriger » une donnée à la place du client :
  il guide, ou la plateforme agit par ses propres écrans métier.
- Informer le client à chaque accès (notification, courriel) : à décider
  (questions ouvertes).

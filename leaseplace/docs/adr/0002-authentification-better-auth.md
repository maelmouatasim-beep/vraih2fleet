# ADR 0002 — Better-Auth plutôt que Clerk

Statut : accepté (validé par le fondateur, 2026-10-20)

## Contexte

Loi 09-08 (CNDP) : un fournisseur d'identité hébergé aux États-Unis
(Clerk) impose un transfert de données personnelles hors du Maroc à faire
autoriser. Besoins : organisations et rôles, 2FA obligatoire pour bailleurs
et plateforme, lien magique et code pour les PME.

## Décision

Better-Auth 1.7 (bibliothèque, données dans **notre** base), adaptateur
Drizzle, plugins `organization`, `twoFactor` (TOTP), `magicLink`,
`emailOTP`, `nextCookies`. Télémétrie désactivée. Inscription fermée en
phase 1 (comptes créés par la plateforme). Identifiants uuid v7.

Règles propres à LeasePlace (`apps/web/src/lib/auth-policy.ts`, testées) :
une session d'un compte à 2FA obligatoire ne naît que d'un mot de passe
(puis TOTP) ou d'une vérification TOTP / code de secours ; aucun courriel
de connexion n'est envoyé à ces comptes ; la 2FA ne peut pas y être
désactivée. Les réponses ne permettent pas d'énumérer les comptes.

## Conséquences

Nous opérons l'authentification (mises à jour de sécurité à suivre). Les
tables `identity.*` suivent le schéma attendu par Better-Auth.

# ADR 0001 — Monorepo pnpm + Turborepo, monolithe modulaire

Statut : accepté (2026-10-20)

## Contexte

Un seul ingénieur (assisté par IA), cinq portails, des intégrations
nombreuses mais aucune charge justifiant des services séparés.

## Décision

Une application Next.js (`apps/web`) servant tous les portails par groupes
de routes, et des paquets internes aux frontières nettes : `domain` (pur,
sans dépendance de framework), `db`, `ui`, `integrations`, `config`.
Gestionnaire pnpm avec `minimumReleaseAge` de 14 jours (aucune version
fraîchement publiée) et versions exactes.

## Conséquences

Un seul déploiement, une seule base. Les paquets sont consommés en source
(`transpilePackages`) : pas d'étape de build interne. Un module de
`domain` n'importe jamais `db` ni Next.

# ADR 0006 — Hébergement provisoire dans le dépôt vraih2fleet

Statut : accepté, temporaire (2026-10-20)

À la demande du fondateur, LeasePlace démarre dans `vraih2fleet/leaseplace/`
en attendant un dépôt vide dédié. Le dossier est autonome : son propre
`package.json`, lockfile pnpm, configs (y compris `vitest.config.ts` dans
chaque paquet pour ne jamais remonter vers la configuration de H2Fleet).
H2Fleet ignore le dossier (ESLint) ; la CI LeasePlace
(`.github/workflows/leaseplace-ci.yml`) ne se déclenche que sur
`leaseplace/**`.

Déplacement : `git subtree split --prefix=leaseplace -b leaseplace` puis
pousser cette branche dans le nouveau dépôt (historique conservé), y
déplacer le workflow et retirer `working-directory` et le filtre `paths`.

# ADR 0019 — Sauvegardes chiffrées et testées

Statut : accepté (2026-10-26)

## Décisions

- `pg_dump` quotidien, chiffré à la volée (AES-256, PBKDF2), empreinte
  SHA-256 ; 35 jours de conservation ; scripts portables
  (`scripts/sauvegarde/`) en attendant le service géré de l'hébergeur.
- **Restauration testée à chaque intégration continue** : sauvegarde du jeu
  de démonstration, restauration dans une base vide, vérification des
  volumes, de la chaîne d'audit et de la RLS.
- Restauration toujours à côté de la base vivante, jamais par-dessus.
- Clé de chiffrement des pièces sauvegardée séparément des données.

Détail et procédure : `docs/exploitation/sauvegardes-et-conservation.md`.

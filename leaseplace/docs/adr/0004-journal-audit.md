# ADR 0004 — Journal d'audit append-only et chaîné

Statut : accepté (2026-10-20)

`audit.events` : écriture uniquement via `audit.record(action, entité, id,
avant, après, métadonnées)` (SECURITY DEFINER) ; l'acteur, l'organisation,
l'usurpation (support), l'IP, l'agent et la trace sont lus dans le contexte
de transaction. UPDATE, DELETE, TRUNCATE : refusés par trigger, même au
propriétaire. Chaque ligne porte `prev_hash` et `hash = sha256(prev_hash ||
contenu canonique)` ; `audit.verify_chain()` renvoie la première ligne
altérée. Écritures sérialisées par verrou consultatif (volume attendu
faible). Lecture : rôles portant `audit.read` (`platform_admin`,
`platform_ops`), vérifié par test contre la matrice de `domain`. Actions
nommées `objet.action` (contrainte CHECK + catalogue typé dans `domain`).

Limite connue : un superutilisateur peut désactiver le trigger ; la chaîne
le rend détectable, pas impossible. Ancrage externe périodique du dernier
hash (phase 9).

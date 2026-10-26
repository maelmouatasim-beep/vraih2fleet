# ADR 0015 — Mandats, commissions et facturation

Statut : accepté (2026-10-26)

## Contexte

La plateforme est rémunérée par les bailleurs, au succès, selon une grille
dégressive prévue au mandat écrit (loi 103-12). Le montant dû doit être
incontestable : calculé une fois, sur des données figées, et traçable
jusqu'à la facture.

## Décisions

- **Mandat versionné** : un mandat signé n'est jamais modifié. Une nouvelle
  version remplace l'ancienne à sa mise en vigueur. Sans mandat en vigueur,
  un bailleur est exclu du routage.
- **Grille marginale** (tranches) plutôt qu'un taux unique par palier, pour
  éviter les effets de seuil (cf. questions ouvertes).
- **Commission calculée par la base**, dans le trigger de mise en loyer,
  avec le mandat en vigueur à l'acceptation. Grille et montants copiés dans
  la commission. La fonction SQL est testée identique au calcul du domaine.
- **Facture immuable**, numérotée par une séquence de la base ; une erreur
  se corrige par un avoir (commission annulée, motif obligatoire), jamais
  par modification.
- **Droits** : l'administration de la plateforme gère mandats et
  facturation ; les opérations lisent ; côté bailleur, seul l'administrateur
  voit commissions et factures, tous les membres voient le mandat.
- **PDF** généré à la demande (pdf-lib), audité à chaque téléchargement.

## Conséquences

- Changer de grille n'affecte jamais les opérations déjà acceptées.
- La TVA (20 %) est figée sur chaque commission ; un changement de taux ne
  touchera que les nouvelles commissions.

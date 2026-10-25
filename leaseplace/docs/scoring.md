# Indice d'orientation v1.0.0

> Indice d'orientation — la décision appartient exclusivement au bailleur.

Grille explicable, codée dans `packages/domain/src/scoring/model.ts` (testée
à 100 %). Chaque évaluation est conservée avec ses entrées, ses ratios et la
version de la grille (`credit.risk_assessments`, immuable). **Tous les seuils
et poids ci-dessous sont des hypothèses de départ, à calibrer avec les
bailleurs partenaires** ; toute modification change la version.

## Facteurs

| Facteur               | Poids | Ratio                                         | Points (du meilleur au moins bon)                                                  |
| --------------------- | ----: | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Couverture des loyers |    30 | CAF (résultat net + dotations) / loyer annuel | ≥ 2 : 100 · ≥ 1,5 : 80 · ≥ 1,2 : 60 · ≥ 1 : 40 · ≥ 0,7 : 20 · sinon 0              |
| Endettement           |    15 | dettes financières / capitaux propres         | ≤ 0,5 : 100 · ≤ 1 : 80 · ≤ 2 : 60 · ≤ 3 : 35 · sinon 10 ; capitaux propres ≤ 0 : 0 |
| Rentabilité           |    10 | résultat net / CA                             | ≥ 10 % : 100 · ≥ 5 % : 80 · ≥ 2 % : 60 · ≥ 0 : 40 · sinon 10                       |
| Trésorerie            |    10 | trésorerie / loyer mensuel                    | ≥ 6 mois : 100 · ≥ 3 : 75 · ≥ 1 : 50 · sinon 20                                    |
| Poids du financement  |     5 | montant HT / CA                               | ≤ 10 % : 100 · ≤ 25 % : 75 · ≤ 50 % : 45 · sinon 15                                |
| Ancienneté            |    10 | mois depuis la création                       | ≥ 10 ans : 100 · ≥ 5 : 80 · ≥ 3 : 60 · ≥ 2 : 45 · ≥ 1 : 30 · sinon 15              |
| Secteur               |    10 | risque sectoriel (table)                      | faible 90 · moyen 65 · élevé 40                                                    |
| Revente de l'actif    |    10 | liquidité de l'occasion (table)               | liquide 90 · moyenne 65 · difficile 35 ; occasion −10, plus de 10 ans −30          |

Loyer annuel de référence : moteur financier, taux de **8 %** (hypothèse),
loyers à échoir, premier loyer et valeur résiduelle de la demande.

Score = moyenne pondérée des facteurs évaluables. Note : A ≥ 80, B ≥ 65,
C ≥ 50, D ≥ 35, E en dessous.

## Plafonds et drapeaux

- **Sans états financiers** (entreprise de moins de 12 mois, liasse
  illisible) : les cinq facteurs financiers sont « non évaluables », le
  score porte sur les trois autres et la note est **plafonnée à C**.
- **Drapeaux graves** (note plafonnée à D) : capitaux propres négatifs, CAF
  négative, CAF inférieure au loyer annuel, contrôle de cohérence en échec.
- **Drapeaux d'alerte** : perte nette, trésorerie < 1 mois de loyer,
  financement > 50 % du CA, entreprise de moins de 2 ans, CA en baisse de
  plus de 20 %, actif d'occasion de plus de 10 ans, derniers exercices
  antérieurs à N−2.

## Tables à valider

- Risque sectoriel : santé faible ; transport, industrie, commerce, services,
  technologies, autre moyen ; BTP, agriculture, tourisme élevé.
- Revente : véhicules légers, poids lourds, remorques, engins de chantier
  liquides ; matériel agricole, machines industrielles, équipement médical
  moyens ; informatique et autre difficiles.

## Correction humaine

Un relecteur (opérations, administration) peut corriger la note avec un
motif d'au moins 20 caractères (`credit.risk_overrides`, immuable, audité).
La note retenue est la dernière correction ; la note calculée reste visible.

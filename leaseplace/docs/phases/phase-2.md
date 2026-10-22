# Phase 2 — Moteur financier et simulateur (livrée le 2026-10-22, en attente du feu vert)

## Livré

- `packages/domain/src/finance` : loyer constant (à échoir / échu, premier
  loyer majoré, valeur résiduelle, périodicités mensuelle à annuelle),
  échéancier normalisé sur grille mensuelle, TEG implicite (Newton +
  bissection), totaux HT/TVA/TTC, coût du financement, classement neutre,
  comparaison crédit-bail / crédit classique / comptant avec effet d'IS.
  Conventions : ADR 0009.
- Tests : 67 (dont 6 cas de référence indépendants et 4 propriétés
  fast-check), couverture 100 % lignes et branches.
- Page publique `/simulateur` (fr, ar RTL, en) : calcul en direct, URL
  partageable, échéancier dépliable, comparaison des trois options,
  hypothèses modifiables et affichées, mention « ne vaut pas offre ».
- Formats `1 250 000,00 DH` / `8,30 %` (`lib/format.ts`, testés), isolat
  bidi pour l'arabe.
- e2e : 6 scénarios du simulateur (cas de référence à l'écran, clavier,
  saisie libre, échéancier, arabe, lien invalide), axe-core.

## Dette technique

- Événements PostHog (`simulator_viewed`, `simulator_changed`) : en
  attente du compte PostHog.
- Pré-hydratation : les poignées des curseurs apparaissent après le
  chargement du JavaScript (Radix) ; à soigner avec la landing (phase 3).
- Assurance : hors TVA, taxe sur les contrats d'assurance non modélisée.
- Comparaison : effet d'IS simplifié (mois de la charge, pas d'échéancier
  d'acomptes) ; dotations après l'horizon ignorées.

## Questions à trancher (associé / avocat)

1. Convention de taux des bailleurs marocains : proportionnelle (retenue) ou
   actuarielle ?
2. Le premier loyer majoré est-il payé à la signature même en terme échu ?
   (retenu : il suit le terme choisi)
3. Définition légale du TEG à afficher pour le crédit-bail.
4. Taux par défaut du simulateur (8 %, hypothèse) et taux d'IS (20 %) :
   à remplacer par des valeurs validées.

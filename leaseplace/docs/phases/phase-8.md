# Phase 8 — Mandats, commissions, factures, pilotage (livrée le 2026-10-26)

## Livré

- **Mandats** (`/admin/bailleurs`) :
  - versions successives par bailleur : version du contrat signé, date de signature, clause anti-contournement (6 à 36 mois), grille de commission, note ;
  - cycle brouillon → en vigueur → suspendu → résilié ;
  - un mandat signé ne se modifie plus : on crée une nouvelle version, dont la mise en vigueur résilie l'ancienne ;
  - **un bailleur sans mandat en vigueur ne reçoit aucun dossier** (loi 103-12) : nouveau motif d'exclusion du routage.
- **Grille dégressive marginale** (1,5 % → 0,4 % par défaut) : chaque tranche du montant financé est commissionnée à son taux, sans effet de seuil. La grille saisie est contrôlée en direct (part de 0, seuils croissants, taux non croissants entre 0,1 % et 5 %).
- **Commission née à la mise en loyer**, dans la même transaction que l'opération :
  - calculée par la base avec la grille du mandat **en vigueur à l'acceptation**, puis figée (grille et montant) ;
  - le calcul SQL est vérifié identique au calcul du domaine sur 200 montants tirés au hasard.
- **Facturation** (`/admin/commissions`) :
  - à facturer → facturée → payée, avoir motivé avant paiement ;
  - factures numérotées par la base (`LP-F-aaaa-000001`), immuables, échéance à 30 jours, retards signalés ;
  - **facture PDF** téléchargeable, chaque téléchargement audité.
- **Espace bailleur** :
  - **Facturation** : mandat en vigueur et sa grille (tous les membres), commissions et factures (administrateur du bailleur seulement) ;
  - le tableau de bord affiche les commissions à régler.
- **Pilotage** (vue d'ensemble, administration et opérations) :
  - entonnoir soumises → vérifiées → transmises → première offre → acceptée → financée ;
  - délai médian jusqu'à la première offre, offres par dossier, économie moyenne générée ;
  - production intermédiée, commissions à encaisser et encaissées.
- **Utilisateurs** (`/admin/utilisateurs`, administration) : organisation, rôle, double authentification (lecture seule).
- **Vue d'ensemble** : file de revue réelle, nombre de mandats en vigueur.
- **Démonstration** :
  - mandat en vigueur pour les 5 bailleurs ;
  - une opération Atlas mise en loyer chez Cèdre, avec sa facture.
- **Tests** :
  - domaine 206 (100 %) : grille, calcul, propriétés, mandats, commissions, indicateurs ;
  - base 95 : domaine ≡ SQL (listes, transitions, calcul, validité des grilles), droits, cloisonnement, commission à la mise en loyer, refus sans mandat, facture, paiement, avoir ;
  - web 64 (dont le contenu du PDF) ;
  - **e2e 57** : commission jusqu'à l'encaissement avec PDF, nouvelle version de mandat, pilotage et droits.

## Tables (à valider — aucune base hébergée)

| Table                 | Contenu                                                                                                                      | Règles                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing.mandates`    | bailleur, statut, version du contrat, signature, grille (jsonb), clause anti-contournement (mois), note, dates               | administration de la plateforme seule ; un seul en vigueur par bailleur ; contenu figé après signature ; jamais supprimé ; lisible par le bailleur |
| `billing.commissions` | opération (unique), demande, bailleur, mandat, montant financé, grille figée, HT, TVA, TTC, statut, facture, paiement, avoir | créée par la base à la mise en loyer ; transitions ≡ domaine ; administration seule ; lisible par l'administrateur du bailleur                     |
| `billing.invoices`    | numéro (séquence), bailleur, émission, échéance, montants                                                                    | émise par l'administration ; numéro posé par la base ; immuable                                                                                    |

## À tester manuellement

1. Compte administration → Commissions → émettre la facture de la
   commission « À facturer », télécharger le PDF, encaisser l'autre.
2. Bailleurs et mandats → un bailleur → nouvelle version (essayer un taux
   croissant), mettre en vigueur → l'ancienne est résiliée.
3. Vue d'ensemble → pilotage et entonnoir.
4. Compte Cèdre (administrateur) → Facturation ; compte Argane (analyste)
   → mandat seul.

## Dette technique

- Identité juridique de la plateforme sur les factures en placeholders
  (`src/lib/brand.ts`) ; mentions légales de facture à valider (expert-comptable).
- Une facture par commission (pas de relevé mensuel), pas de relance
  automatique des factures en retard, pas de rapprochement bancaire.
- Contrat de mandat signé non stocké dans la plateforme (référence de
  version seulement) ; signature électronique non intégrée.
- Accès « en tant que » du support (impersonation tracée) non ouvert ;
  gestion des utilisateurs en lecture seule.
- Pilotage sans historique ni filtres de période ; visites et simulations
  à instrumenter (PostHog, phase 9).

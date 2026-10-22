# ADR 0009 — Conventions du moteur financier

Statut : accepté (2026-10-22) — conventions marquées « à valider » à
confirmer avec l'associé (ex-banquier) et l'avocat.

- **Précision** : calcul en double précision, tout montant payé ou affiché
  arrondi au centime (moitié loin de zéro). Le TEG est calculé sur les
  montants **arrondis**, ceux que le client paie réellement.
- **Loyer à partir d'un taux** : taux périodique = taux nominal annuel /
  nombre de périodes par an (convention proportionnelle bancaire,
  _à valider_). Premier loyer majoré = montant fixé, les loyers suivants
  s'en déduisent.
- **Échéances** : loyer k au mois (k−1)·p (à échoir) ou k·p (échu), p = mois
  par période ; frais de dossier à la signature (mois 0) ; valeur résiduelle
  au dernier mois du contrat.
- **TEG implicite** : taux actuariel annuel `(1 + i_m)^12 − 1`, i*m TRI
  mensuel du flux réel du client (financement reçu, loyers, frais, valeur
  résiduelle, assurance si exigée). Grille mensuelle commune : des offres
  de périodicités différentes sont directement comparables. Définition
  réglementaire du TEG applicable au crédit-bail au Maroc : *à valider\_.
- **TRI** : Newton-Raphson (60 itérations), repli par bissection sur
  [−99 %, +∞[ ; erreur explicite si aucun taux n'existe.
- **TVA** : 20 % par défaut, paramétrable ; sur loyers, frais et valeur
  résiduelle ; l'assurance est hors TVA (taxe sur les contrats d'assurance
  non modélisée).
- **Classement des offres** : par coût du financement HT par défaut
  (paiements obligatoires − montant financé) ; égalités : TEG puis
  identifiant. Le type d'entrée du classement ne contient **aucun** champ
  commercial (commission, partenariat) : impossible d'influencer l'ordre.
- **Comparaison crédit-bail / crédit / comptant** : HT (TVA récupérée),
  propriété du bien à la fin dans les trois cas, valeur actuelle au taux
  d'actualisation choisi, économie d'IS au mois de la charge (loyers et
  frais ; intérêts et amortissement linéaire). Hypothèses affichées à
  l'écran et modifiables.
- **Contrôle** : 6 cas de référence recalculés par une implémentation
  indépendante (`scripts/finance/reference.py`, Decimal + bissection) à
  ±0,01 DH ; propriétés fast-check (TEG retrouve le taux, coût croissant
  avec le taux, TTC = HT + TVA, classement indépendant de l'ordre) ;
  couverture 100 % exigée en CI.
- **Formats** : un format unique quelle que soit la langue — `1 250 000,00 DH`,
  `8,30 %` — isolé de gauche à droite dans l'interface arabe.

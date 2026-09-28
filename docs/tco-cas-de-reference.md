# Cas de référence TCO — vérification indépendante

**Statut : contre-calcul indépendant** — 2026-09-28.
Ces six cas ont été recalculés **à la main** (scripts Python écrits pour
l'occasion, sans lire ni réutiliser le code applicatif) en suivant
exclusivement `docs/tco-methodologie.md` et les valeurs de
`src/lib/tco/assumptions.ts` / `src/lib/tco/subsidy-programs.ts`. Ils servent
de valeurs attendues pour les tests du futur moteur unique `src/lib/tco/`.
Le classeur `docs/tco-verification.xlsx` (généré par
`scripts/tco-verification-xlsx.py`) reproduit chaque calcul en **formules
Excel auditable** ; ses résultats, évalués indépendamment, coïncident au cent
près avec les valeurs de ce document et de `docs/tco-cas-de-reference.json`.

## Paramètres communs (scénario Central, dollars courants, année de référence 2026, municipalité)

| Paramètre | Valeur |
|---|---:|
| Taux d'actualisation nominal r | 5,0 % |
| Inflations par poste | diesel 3,0 % ; électricité 3,5 % ; H₂ 0,0 % ; entretien 2,5 % ; générale 2,1 % |
| Prix année 0 | diesel 2,95 $/L ; électricité effective au compteur 0,10 $/kWh ; H₂ livré 16,50 $/kg |
| Rendement de recharge | 0,90 (kWh compteur = kWh véhicule ÷ 0,90) |
| Majoration hivernale (BEV et FCEV) | × (1 + 0,25 × 0,33) = × 1,0825 |
| Taxes non récupérables (municipalité) | 4,9875 % du prix avant taxes (50 % de la TVQ 9,975 % ; TPS remboursée à 100 %), véhicules **et** infrastructure, calculées sur le prix **avant** subventions |
| Valeur résiduelle véhicule | max(prixAvantTaxes × (1−d)ᴴ ; 10 % × prixAvantTaxes), nominale, fin d'horizon ; d = 0,15 diesel / 0,18 BEV / 0,20 FCEV |
| Infrastructure | payée an 0 (+ taxes non récup.) ; entretien 3 % du capex avant taxes, indexé 2,5 % ; vie 15 ans ; VR linéaire fin d'horizon = capex × (15−H)/15 |
| Émissions | diesel TTW 2,741 kg CO₂e/L (légers/camionnettes) ou 2,724 (moyens/lourds/autobus), WTW = TTW × 1,25 ; électricité 1,2 g CO₂e/kWh au compteur (WTW) ; H₂ électrolyse QC 1,0 kg CO₂e/kg (WTW) |
| Conventions | année 0 = acquisition (CAPEX non actualisé) ; flux d'exploitation en fin d'année n, actualisés 1/(1+r)ⁿ ; flux nominaux ; VR = recette fin d'année H ; subventions à leur année de versement ; référence = diesel neuf équivalent **sans** infrastructure |

Délai de récupération **simple** : plus petite année n telle que
Σₖ₌₀..ₙ (flux_référenceₖ − flux_alternativeₖ) ≥ 0 en dollars nominaux
(subventions et valeurs résiduelles comptées à leur année) ; **actualisé** :
même définition sur flux actualisés. Coût par tonne évitée =
(TCO_actualisé_alt − TCO_actualisé_réf) ÷ t CO₂e WTW évitées cumulées
(négatif = gain net par tonne).

## Synthèse des six cas

| Cas | TCO act. alternative | TCO act. référence | VAN différentielle | Payback simple | Payback actualisé | t CO₂e évitées (WTW) | Coût (+) / gain (−) par t WTW |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1. Camionnette BEV | 142 986,72 $ | 219 655,59 $ | **+76 668,87 $** | 4 ans | 4 ans | 154,043 | −497,71 $/t |
| 2. Autobus 12 m BEV | 2 399 979,76 $ | 1 914 849,96 $ | −485 129,80 $ | null | null | 918,138 | +528,38 $/t |
| 3. Camion lourd BEV | 820 198,54 $ | 944 294,76 $ | **+124 096,22 $** | 7 ans | 9 ans | 734,484 | −168,96 $/t |
| 4. Véhicule léger BEV | 78 346,91 $ | 123 558,80 $ | **+45 211,89 $** | 3 ans | 3 ans | 77,018 | −587,03 $/t |
| 5. Camion lourd FCEV | 1 396 177,13 $ | 944 294,76 $ | −451 882,37 $ | null | null | 683,520 | +661,11 $/t |
| 6. Mini-plan 5 véhicules | 1 110 461,52 $ | 1 580 097,03 $ | **+469 635,51 $** | 5 ans | 5 ans | 1 112,596 | −422,11 $/t |

---

## Cas 1 — Camionnette de service BEV

### Entrées

| Entrée | Référence (diesel neuf) | Alternative (BEV) |
|---|---:|---:|
| Prix avant taxes | 68 000 $ | 95 000 $ |
| Consommation | 15 L/100 km | 32 kWh/100 km (batterie) |
| Entretien | 0,14 $/km | 0,10 $/km |
| Kilométrage | 30 000 km/an | 30 000 km/an |
| Subvention | — | Écocamionnage classe 2b : 2 500 $, versés à l'**année 1** |
| Infrastructure | aucune | 1 borne, 15 000 $ avant taxes (an 0) |
| FE diesel TTW | 2,741 kg CO₂e/L | — |
| Horizon | 10 ans | 10 ans |

kWh facturés au compteur : 30 000 × 32/100 × 1,0825 ÷ 0,90 = **11 546,67 kWh/an**.
VR fin d'horizon : réf 68 000 × 0,85¹⁰ = 13 387,46 $ ; alt 95 000 × 0,82¹⁰ = 13 057,56 $ ; infra 15 000 × (15−10)/15 = 5 000 $.

### Tableau année par année (dollars nominaux ; deux dernières colonnes actualisées)

Colonnes « alt » = scénario alternatif (composantes) ; le flux net de la référence est reconstitué dans le classeur Excel colonne par colonne.

| n | Acquisition alt | Subventions | Énergie alt | Entretien alt | Opex infra | Résiduels alt | Flux net alt | Flux net réf | Économie nominale | Flux act. alt | Flux act. réf |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 115 486,25 | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | 115 486,25 | 71 391,50 | -44 094,75 | 115 486,25 | 71 391,50 |
| 1 | 0,00 | 2 500,00 | 1 195,08 | 3 075,00 | 461,25 | 0,00 | 2 231,33 | 17 978,25 | 15 746,92 | 2 125,08 | 17 122,14 |
| 2 | 0,00 | 0,00 | 1 236,91 | 3 151,87 | 472,78 | 0,00 | 4 861,56 | 18 496,07 | 13 634,51 | 4 409,58 | 16 776,48 |
| 3 | 0,00 | 0,00 | 1 280,20 | 3 230,67 | 484,60 | 0,00 | 4 995,47 | 19 028,89 | 14 033,42 | 4 315,28 | 16 437,87 |
| 4 | 0,00 | 0,00 | 1 325,01 | 3 311,44 | 496,72 | 0,00 | 5 133,16 | 19 577,14 | 14 443,98 | 4 223,06 | 16 106,16 |
| 5 | 0,00 | 0,00 | 1 371,38 | 3 394,22 | 509,13 | 0,00 | 5 274,74 | 20 141,28 | 14 866,54 | 4 132,90 | 15 781,22 |
| 6 | 0,00 | 0,00 | 1 419,38 | 3 479,08 | 521,86 | 0,00 | 5 420,32 | 20 721,76 | 15 301,43 | 4 044,73 | 15 462,89 |
| 7 | 0,00 | 0,00 | 1 469,06 | 3 566,06 | 534,91 | 0,00 | 5 570,02 | 21 319,06 | 15 749,03 | 3 958,51 | 15 151,05 |
| 8 | 0,00 | 0,00 | 1 520,48 | 3 655,21 | 548,28 | 0,00 | 5 723,97 | 21 933,66 | 16 209,70 | 3 874,21 | 14 845,57 |
| 9 | 0,00 | 0,00 | 1 573,69 | 3 746,59 | 561,99 | 0,00 | 5 882,27 | 22 566,09 | 16 683,82 | 3 791,76 | 14 546,30 |
| 10 | 0,00 | 0,00 | 1 628,77 | 3 840,25 | 576,04 | 18 057,56 | -12 012,50 | 9 829,39 | 21 841,89 | -7 374,63 | 6 034,39 |
| **Σ** | 115 486,25 | 2 500,00 | 14 019,95 | 34 450,40 | 5 167,56 | 18 057,56 | **148 566,60** | **262 983,09** | **114 416,49** | **142 986,72** | **219 655,59** |

### Résultats

| Indicateur | Valeur |
|---|---:|
| TCO actualisé — alternative | 142 986,72 $ |
| TCO actualisé — référence | 219 655,59 $ |
| VAN différentielle (réf − alt) | 76 668,87 $ |
| km actualisés (dénominateur commun) | 231 652,05 km |
| TCO/km actualisé — alternative | 0,6172 $/km |
| TCO/km actualisé — référence | 0,9482 $/km |
| Délai de récupération simple | 4 |
| Délai de récupération actualisé | 4 |
| CO₂e évité cumulé TTW | 123,345 t |
| CO₂e évité cumulé WTW | 154,043 t |
| Coût par tonne WTW évitée | **gain net de 497,71 $/t** (TCO alternatif inférieur à la référence) |

**Lecture.** Le payback simple et le payback actualisé tombent tous deux à l'année 4 : le surcoût net initial (~44 095 $ nominal) est couvert par des économies d'exploitation d'environ 13 600-15 700 $/an (subvention de 2 500 $ encaissée à l'an 1).

---

## Cas 2 — Autobus urbain 12 m BEV

### Entrées

| Entrée | Référence (diesel neuf) | Alternative (BEV) |
|---|---:|---:|
| Prix avant taxes | 750 000 $ | 1 720 000 $ |
| Consommation | 45 L/100 km | 140 kWh/100 km (base été ; majoration hivernale standard appliquée) |
| Entretien | 0,95 $/km | 0,70 $/km |
| Kilométrage | 60 000 km/an | 60 000 km/an |
| Subvention | — | **AUCUNE comptée** : FTCZE et PAGTCP sont des montants par projet (plafond automatique 0 au registre) |
| Infrastructure | aucune | borne 150 000 $ + raccordement 100 000 $ = 250 000 $ avant taxes |
| FE diesel TTW | 2,724 kg CO₂e/L | — |
| Horizon | 10 ans | 10 ans |

kWh compteur : 60 000 × 140/100 × 1,0825 ÷ 0,90 = **101 033,33 kWh/an**.
VR : réf 750 000 × 0,85¹⁰ = 147 655,80 $ ; alt 1 720 000 × 0,82¹⁰ = 236 410,61 $ ; infra 250 000/3 = 83 333,33 $.

### Tableau année par année (dollars nominaux ; deux dernières colonnes actualisées)

Colonnes « alt » = scénario alternatif (composantes) ; le flux net de la référence est reconstitué dans le classeur Excel colonne par colonne.

| n | Acquisition alt | Subventions | Énergie alt | Entretien alt | Opex infra | Résiduels alt | Flux net alt | Flux net réf | Économie nominale | Flux act. alt | Flux act. réf |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 2 068 253,75 | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | 2 068 253,75 | 787 406,25 | -1 280 847,50 | 2 068 253,75 | 787 406,25 |
| 1 | 0,00 | 0,00 | 10 456,95 | 43 050,00 | 7 687,50 | 0,00 | 61 194,45 | 140 464,50 | 79 270,05 | 58 280,43 | 133 775,71 |
| 2 | 0,00 | 0,00 | 10 822,94 | 44 126,25 | 7 879,69 | 0,00 | 62 828,88 | 144 386,31 | 81 557,43 | 56 987,65 | 130 962,64 |
| 3 | 0,00 | 0,00 | 11 201,75 | 45 229,41 | 8 076,68 | 0,00 | 64 507,83 | 148 418,47 | 83 910,64 | 55 724,29 | 128 209,46 |
| 4 | 0,00 | 0,00 | 11 593,81 | 46 360,14 | 8 278,60 | 0,00 | 66 232,55 | 152 564,11 | 86 331,57 | 54 489,68 | 125 514,87 |
| 5 | 0,00 | 0,00 | 11 999,59 | 47 519,14 | 8 485,56 | 0,00 | 68 004,30 | 156 826,45 | 88 822,15 | 53 283,15 | 122 877,63 |
| 6 | 0,00 | 0,00 | 12 419,58 | 48 707,12 | 8 697,70 | 0,00 | 69 824,40 | 161 208,79 | 91 384,39 | 52 104,04 | 120 296,48 |
| 7 | 0,00 | 0,00 | 12 854,26 | 49 924,80 | 8 915,14 | 0,00 | 71 694,21 | 165 714,54 | 94 020,34 | 50 951,73 | 117 770,23 |
| 8 | 0,00 | 0,00 | 13 304,16 | 51 172,92 | 9 138,02 | 0,00 | 73 615,10 | 170 347,20 | 96 732,10 | 49 825,60 | 115 297,69 |
| 9 | 0,00 | 0,00 | 13 769,81 | 52 452,24 | 9 366,47 | 0,00 | 75 588,52 | 175 110,37 | 99 521,85 | 48 725,04 | 112 877,71 |
| 10 | 0,00 | 0,00 | 14 251,75 | 53 763,55 | 9 600,63 | 319 743,95 | -242 128,01 | 32 351,96 | 274 479,97 | -148 645,60 | 19 861,29 |
| **Σ** | 2 068 253,75 | 0,00 | 122 674,59 | 482 305,59 | 86 126,00 | 319 743,95 | **2 439 615,98** | **2 234 798,95** | **-204 817,02** | **2 399 979,76** | **1 914 849,96** |

### Résultats

| Indicateur | Valeur |
|---|---:|
| TCO actualisé — alternative | 2 399 979,76 $ |
| TCO actualisé — référence | 1 914 849,96 $ |
| VAN différentielle (réf − alt) | -485 129,80 $ |
| km actualisés (dénominateur commun) | 463 304,10 km |
| TCO/km actualisé — alternative | 5,1801 $/km |
| TCO/km actualisé — référence | 4,1330 $/km |
| Délai de récupération simple | null — le surcoût n'est pas résorbé à l'horizon H=10 |
| Délai de récupération actualisé | null — le surcoût n'est pas résorbé à l'horizon H=10 |
| CO₂e évité cumulé TTW | 735,480 t |
| CO₂e évité cumulé WTW | 918,138 t |
| Coût par tonne WTW évitée | 528,38 $/t |

**Lecture.** Sans subvention comptée, le surcoût d'acquisition (~1,28 M$ taxes incluses, infra comprise) n'est pas résorbé : les économies d'exploitation (~77 000 $/an la première année) et le différentiel de valeurs résiduelles ne suffisent pas sur 10 ans. Un montant FTCZE/PAGTCP réel saisi au projet renverserait vraisemblablement ce résultat.

---

## Cas 3 — Camion lourd BEV (classe 8)

### Entrées

| Entrée | Référence (diesel neuf) | Alternative (BEV) |
|---|---:|---:|
| Prix avant taxes | 200 000 $ | 460 000 $ |
| Consommation | 36 L/100 km | 115 kWh/100 km |
| Entretien | 0,35 $/km | 0,25 $/km |
| Kilométrage | 60 000 km/an | 60 000 km/an |
| Subvention | — | Écocamionnage classe 8 : 25 % × 460 000 = **115 000 $** (≤ plafond 150 000 $), année 1 |
| Infrastructure | aucune | 150 000 $ + raccordement 100 000 $ = 250 000 $ avant taxes |
| FE diesel TTW | 2,724 kg CO₂e/L | — |
| Horizon | 10 ans | 10 ans |

kWh compteur : 60 000 × 115/100 × 1,0825 ÷ 0,90 = **82 991,67 kWh/an**.
VR : réf 200 000 × 0,85¹⁰ = 39 374,85 $ ; alt 460 000 × 0,82¹⁰ = 63 226,09 $ ; infra 83 333,33 $.

### Tableau année par année (dollars nominaux ; deux dernières colonnes actualisées)

Colonnes « alt » = scénario alternatif (composantes) ; le flux net de la référence est reconstitué dans le classeur Excel colonne par colonne.

| n | Acquisition alt | Subventions | Énergie alt | Entretien alt | Opex infra | Résiduels alt | Flux net alt | Flux net réf | Économie nominale | Flux act. alt | Flux act. réf |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 745 411,25 | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | 745 411,25 | 209 975,00 | -535 436,25 | 745 411,25 | 209 975,00 |
| 1 | 0,00 | 115 000,00 | 8 589,64 | 15 375,00 | 7 687,50 | 0,00 | -83 347,86 | 87 156,60 | 170 504,46 | -79 378,92 | 83 006,29 |
| 2 | 0,00 | 0,00 | 8 890,27 | 15 759,37 | 7 879,69 | 0,00 | 32 529,34 | 89 663,67 | 57 134,34 | 29 505,07 | 81 327,59 |
| 3 | 0,00 | 0,00 | 9 201,43 | 16 153,36 | 8 076,68 | 0,00 | 33 431,47 | 92 243,27 | 58 811,79 | 28 879,36 | 79 683,20 |
| 4 | 0,00 | 0,00 | 9 523,48 | 16 557,19 | 8 278,60 | 0,00 | 34 359,27 | 94 897,49 | 60 538,22 | 28 267,46 | 78 072,40 |
| 5 | 0,00 | 0,00 | 9 856,81 | 16 971,12 | 8 485,56 | 0,00 | 35 313,49 | 97 628,52 | 62 315,03 | 27 669,04 | 76 494,50 |
| 6 | 0,00 | 0,00 | 10 201,79 | 17 395,40 | 8 697,70 | 0,00 | 36 294,90 | 100 438,57 | 64 143,68 | 27 083,81 | 74 948,81 |
| 7 | 0,00 | 0,00 | 10 558,86 | 17 830,29 | 8 915,14 | 0,00 | 37 304,29 | 103 329,96 | 66 025,68 | 26 511,46 | 73 434,68 |
| 8 | 0,00 | 0,00 | 10 928,42 | 18 276,04 | 9 138,02 | 0,00 | 38 342,48 | 106 305,05 | 67 962,57 | 25 951,70 | 71 951,44 |
| 9 | 0,00 | 0,00 | 11 310,91 | 18 732,94 | 9 366,47 | 0,00 | 39 410,33 | 109 366,27 | 69 955,94 | 25 404,25 | 70 498,47 |
| 10 | 0,00 | 0,00 | 11 706,79 | 19 201,27 | 9 600,63 | 146 559,43 | -106 050,73 | 73 141,25 | 179 191,98 | -65 105,95 | 44 902,38 |
| **Σ** | 745 411,25 | 115 000,00 | 100 768,41 | 172 251,99 | 86 126,00 | 146 559,43 | **842 998,23** | **1 164 145,65** | **321 147,42** | **820 198,54** | **944 294,76** |

### Résultats

| Indicateur | Valeur |
|---|---:|
| TCO actualisé — alternative | 820 198,54 $ |
| TCO actualisé — référence | 944 294,76 $ |
| VAN différentielle (réf − alt) | 124 096,22 $ |
| km actualisés (dénominateur commun) | 463 304,10 km |
| TCO/km actualisé — alternative | 1,7703 $/km |
| TCO/km actualisé — référence | 2,0382 $/km |
| Délai de récupération simple | 7 |
| Délai de récupération actualisé | 9 |
| CO₂e évité cumulé TTW | 588,384 t |
| CO₂e évité cumulé WTW | 734,484 t |
| Coût par tonne WTW évitée | **gain net de 168,96 $/t** (TCO alternatif inférieur à la référence) |

**Lecture.** Cas gagnant mais lent : la subvention de 115 000 $ à l'an 1 et ~54 000 $/an d'économies donnent un payback simple à 7 ans ; en flux actualisés, le cumul ne redevient positif qu'à l'année 9 (payback actualisé = 9), avant même le crédit des valeurs résiduelles de l'an 10.

---

## Cas 4 — Véhicule léger BEV

### Entrées

| Entrée | Référence (diesel neuf) | Alternative (BEV) |
|---|---:|---:|
| Prix avant taxes | 45 000 $ | 49 500 $ |
| Consommation | 9 L/100 km | 20 kWh/100 km |
| Entretien | 0,10 $/km | 0,07 $/km |
| Kilométrage | 25 000 km/an | 25 000 km/an |
| Subventions | — | PAVÉ 5 000 $ + Roulez vert 2 000 $ = **7 000 $ à l'année 0** (point de vente) |
| Infrastructure | aucune | 1 borne, 15 000 $ avant taxes |
| FE diesel TTW | 2,741 kg CO₂e/L | — |
| Horizon | 10 ans | 10 ans |

Admissibilité vérifiée : transaction 49 500 $ ≤ 50 000 $ (PAVÉ) ; PDSF < 65 000 $ (Roulez vert) ;
programmes cumulables (paliers différents). Les taxes sont calculées sur le prix **avant** rabais.
kWh compteur : 25 000 × 20/100 × 1,0825 ÷ 0,90 = **6 013,89 kWh/an**.
VR : réf 45 000 × 0,85¹⁰ = 8 859,35 $ ; alt 49 500 × 0,82¹⁰ = 6 803,68 $ ; infra 5 000 $.

### Tableau année par année (dollars nominaux ; deux dernières colonnes actualisées)

Colonnes « alt » = scénario alternatif (composantes) ; le flux net de la référence est reconstitué dans le classeur Excel colonne par colonne.

| n | Acquisition alt | Subventions | Énergie alt | Entretien alt | Opex infra | Résiduels alt | Flux net alt | Flux net réf | Économie nominale | Flux act. alt | Flux act. réf |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 67 716,94 | 7 000,00 | 0,00 | 0,00 | 0,00 | 0,00 | 60 716,94 | 47 244,38 | -13 472,56 | 60 716,94 | 47 244,38 |
| 1 | 0,00 | 0,00 | 622,44 | 1 793,75 | 461,25 | 0,00 | 2 877,44 | 9 399,12 | 6 521,69 | 2 740,42 | 8 951,55 |
| 2 | 0,00 | 0,00 | 644,22 | 1 838,59 | 472,78 | 0,00 | 2 955,60 | 9 668,29 | 6 712,69 | 2 680,81 | 8 769,42 |
| 3 | 0,00 | 0,00 | 666,77 | 1 884,56 | 484,60 | 0,00 | 3 035,93 | 9 945,20 | 6 909,27 | 2 622,55 | 8 591,04 |
| 4 | 0,00 | 0,00 | 690,11 | 1 931,67 | 496,72 | 0,00 | 3 118,50 | 10 230,10 | 7 111,60 | 2 565,59 | 8 416,33 |
| 5 | 0,00 | 0,00 | 714,26 | 1 979,96 | 509,13 | 0,00 | 3 203,36 | 10 523,20 | 7 319,84 | 2 509,92 | 8 245,20 |
| 6 | 0,00 | 0,00 | 739,26 | 2 029,46 | 521,86 | 0,00 | 3 290,59 | 10 824,76 | 7 534,17 | 2 455,49 | 8 077,60 |
| 7 | 0,00 | 0,00 | 765,13 | 2 080,20 | 534,91 | 0,00 | 3 380,24 | 11 135,00 | 7 754,76 | 2 402,28 | 7 913,44 |
| 8 | 0,00 | 0,00 | 791,91 | 2 132,21 | 548,28 | 0,00 | 3 472,40 | 11 454,19 | 7 981,79 | 2 350,26 | 7 752,65 |
| 9 | 0,00 | 0,00 | 819,63 | 2 185,51 | 561,99 | 0,00 | 3 567,13 | 11 782,59 | 8 215,46 | 2 299,40 | 7 595,16 |
| 10 | 0,00 | 0,00 | 848,32 | 2 240,15 | 576,04 | 11 803,68 | -8 139,17 | 3 261,11 | 11 400,28 | -4 996,75 | 2 002,04 |
| **Σ** | 67 716,94 | 7 000,00 | 7 302,06 | 20 096,07 | 5 167,56 | 11 803,68 | **81 478,94** | **145 467,94** | **63 988,99** | **78 346,91** | **123 558,80** |

### Résultats

| Indicateur | Valeur |
|---|---:|
| TCO actualisé — alternative | 78 346,91 $ |
| TCO actualisé — référence | 123 558,80 $ |
| VAN différentielle (réf − alt) | 45 211,89 $ |
| km actualisés (dénominateur commun) | 193 043,37 km |
| TCO/km actualisé — alternative | 0,4059 $/km |
| TCO/km actualisé — référence | 0,6401 $/km |
| Délai de récupération simple | 3 |
| Délai de récupération actualisé | 3 |
| CO₂e évité cumulé TTW | 61,673 t |
| CO₂e évité cumulé WTW | 77,018 t |
| Coût par tonne WTW évitée | **gain net de 587,03 $/t** (TCO alternatif inférieur à la référence) |

**Lecture.** Meilleur cas : surcoût net an 0 de seulement ~13 472 $ (subventions au point de vente), payback simple et actualisé à 3 ans, gain net de 587,03 $/t CO₂e WTW évitée.

---

## Cas 5 — Camion lourd FCEV (H₂ électrolyse)

### Entrées

| Entrée | Référence (diesel neuf) | Alternative (FCEV) |
|---|---:|---:|
| Prix avant taxes | 200 000 $ | 720 000 $ |
| Consommation | 36 L/100 km | 8 kg H₂/100 km |
| Entretien | 0,35 $/km | 0,32 $/km |
| Kilométrage | 60 000 km/an | 60 000 km/an |
| Subvention | — | Écocamionnage : 25 % × 720 000 = 180 000 → **plafonné à 150 000 $**, année 1 |
| Infrastructure | aucune | **0 $** : ravitaillement externe, le prix de 16,50 $/kg inclut la distribution |
| FE | diesel TTW 2,724 kg CO₂e/L | H₂ électrolyse QC : 1,0 kg CO₂e/kg (WTW) |
| Horizon | 10 ans | 10 ans |

kg H₂ facturés : 60 000 × 8/100 × 1,0825 = **5 196 kg/an** (majoration hivernale appliquée au FCEV ; inflation H₂ = 0 → coût annuel constant).
VR : réf 39 374,85 $ ; alt 720 000 × 0,80¹⁰ = 77 309,41 $ (0,8¹⁰ = 10,74 % > plancher 10 %).

### Tableau année par année (dollars nominaux ; deux dernières colonnes actualisées)

Colonnes « alt » = scénario alternatif (composantes) ; le flux net de la référence est reconstitué dans le classeur Excel colonne par colonne.

| n | Acquisition alt | Subventions | Énergie alt | Entretien alt | Opex infra | Résiduels alt | Flux net alt | Flux net réf | Économie nominale | Flux act. alt | Flux act. réf |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 755 910,00 | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | 755 910,00 | 209 975,00 | -545 935,00 | 755 910,00 | 209 975,00 |
| 1 | 0,00 | 150 000,00 | 85 734,00 | 19 680,00 | 0,00 | 0,00 | -44 586,00 | 87 156,60 | 131 742,60 | -42 462,86 | 83 006,29 |
| 2 | 0,00 | 0,00 | 85 734,00 | 20 172,00 | 0,00 | 0,00 | 105 906,00 | 89 663,67 | -16 242,33 | 96 059,86 | 81 327,59 |
| 3 | 0,00 | 0,00 | 85 734,00 | 20 676,30 | 0,00 | 0,00 | 106 410,30 | 92 243,27 | -14 167,03 | 91 921,22 | 79 683,20 |
| 4 | 0,00 | 0,00 | 85 734,00 | 21 193,21 | 0,00 | 0,00 | 106 927,21 | 94 897,49 | -12 029,72 | 87 969,28 | 78 072,40 |
| 5 | 0,00 | 0,00 | 85 734,00 | 21 723,04 | 0,00 | 0,00 | 107 457,04 | 97 628,52 | -9 828,52 | 84 195,40 | 76 494,50 |
| 6 | 0,00 | 0,00 | 85 734,00 | 22 266,11 | 0,00 | 0,00 | 108 000,11 | 100 438,57 | -7 561,54 | 80 591,35 | 74 948,81 |
| 7 | 0,00 | 0,00 | 85 734,00 | 22 822,77 | 0,00 | 0,00 | 108 556,77 | 103 329,96 | -5 226,80 | 77 149,27 | 73 434,68 |
| 8 | 0,00 | 0,00 | 85 734,00 | 23 393,34 | 0,00 | 0,00 | 109 127,34 | 106 305,05 | -2 822,29 | 73 861,68 | 71 951,44 |
| 9 | 0,00 | 0,00 | 85 734,00 | 23 978,17 | 0,00 | 0,00 | 109 712,17 | 109 366,27 | -345,90 | 70 721,44 | 70 498,47 |
| 10 | 0,00 | 0,00 | 85 734,00 | 24 577,62 | 0,00 | 77 309,41 | 33 002,21 | 73 141,25 | 40 139,03 | 20 260,50 | 44 902,38 |
| **Σ** | 755 910,00 | 150 000,00 | 857 340,00 | 220 482,55 | 0,00 | 77 309,41 | **1 606 423,14** | **1 164 145,65** | **-442 277,49** | **1 396 177,13** | **944 294,76** |

### Résultats

| Indicateur | Valeur |
|---|---:|
| TCO actualisé — alternative | 1 396 177,13 $ |
| TCO actualisé — référence | 944 294,76 $ |
| VAN différentielle (réf − alt) | -451 882,37 $ |
| km actualisés (dénominateur commun) | 463 304,10 km |
| TCO/km actualisé — alternative | 3,0135 $/km |
| TCO/km actualisé — référence | 2,0382 $/km |
| Délai de récupération simple | null — le surcoût n'est pas résorbé à l'horizon H=10 |
| Délai de récupération actualisé | null — le surcoût n'est pas résorbé à l'horizon H=10 |
| CO₂e évité cumulé TTW | 588,384 t |
| CO₂e évité cumulé WTW | 683,520 t |
| Coût par tonne WTW évitée | 661,11 $/t |

**Lecture.** Le FCEV reste nettement plus coûteux : l'énergie H₂ (85 734 $/an, constante à inflation nulle) dépasse à elle seule le coût diesel de référence (63 720 $ × 1,03ⁿ) jusqu'à l'année 10 ; le surcoût d'acquisition (~546 000 $ après subvention plafonnée) n'est jamais résorbé. Les économies annuelles d'exploitation sont négatives les premières années (l'écart énergie domine l'avantage d'entretien).

---

## Cas 6 — Mini-plan 5 véhicules (horizon 12 ans, infra partagée, re-remplacement)

### Entrées

**Composition (horizon 12 ans, année de référence 2026) :**

| Véhicule (nb) | Réf diesel | Alt BEV | km/an | Subventions | Particularités |
|---|---|---|---:|---|---|
| Véhicule léger (×2) | 45 000 $, 9 L/100, 0,10 $/km | 49 500 $, 20 kWh/100, 0,07 $/km | 25 000 | PAVÉ + RV = 7 000 $/véh, an 0 | Fin de vie 10 ans → **re-remplacement an 10** |
| Camionnette (×1) | 68 000 $, 15 L/100, 0,14 $/km | 95 000 $, 32 kWh/100, 0,10 $/km | 30 000 | Écocamionnage 2b : 2 500 $, an 1 | Durée de vie 12 ans ici, pas de re-remplacement |
| Camion moyen cl. 6 (×2) | 140 000 $, 26 L/100, 0,25 $/km | 300 000 $, 62 kWh/100, 0,18 $/km | 35 000 | Écocamionnage : 25 % × 300 000 = 75 000 $/véh (≤ plafond 100 000 $), an 1 | FE 2,724 |

FE diesel : 2,741 (légers, camionnette), 2,724 (camions moyens).

**Re-remplacement des 2 véhicules légers à l'année 10** (dans les deux scénarios) :
rachat au prix indexé à l'inflation générale (trajectoire batterie désactivée) :
BEV 49 500 × 1,021¹⁰ = 60 934,41 $ ; diesel 45 000 × 1,021¹⁰ = 55 394,92 $ (+ taxes non
récupérables, **sans subvention** — PAVÉ terminé le 2031-03-31 et Roulez vert le 2026-12-31).
VR de l'ancien = plancher 10 % du prix initial, créditée à l'an 10 (BEV 4 950 $ ; diesel 4 500 $).
VR du nouveau fin an 12 (2 ans de possession) : BEV 0,82² = 0,6724 × 60 934,41 = 40 972,30 $ ;
diesel 0,85² = 0,7225 × 55 394,92 = 40 022,83 $.

**Infrastructure partagée (an 0)** : 5 bornes × 15 000 + raccordement 60 000 = **135 000 $ avant taxes** ;
entretien 3 %/an indexé ; VR linéaire fin 12 : 135 000 × (15−12)/15 = 27 000 $.
Répartition au **prorata de l'énergie au compteur de l'année 1** :

| Véhicule | kWh compteur an 1 | Part du capex |
|---|---:|---:|
| Véhicule léger 1 | 6 013,89 | 10 714,29 $ |
| Véhicule léger 2 | 6 013,89 | 10 714,29 $ |
| Camionnette | 11 546,67 | 20 571,43 $ |
| Camion moyen 1 | 26 100,28 | 46 500,00 $ |
| Camion moyen 2 | 26 100,28 | 46 500,00 $ |
| **Total** | **75 775,00** | **135 000,00 $** ✓ (somme des parts = capex, vérifié) |

VR véhicules fin 12 : camionnette BEV max(0,82¹² ; 0,10) = plancher 10 % → 9 500 $ ;
camionnette diesel 0,85¹² × 68 000 = 9 672,44 $ ; camion moyen BEV plancher 10 % → 30 000 $/véh ;
camion moyen diesel 0,85¹² × 140 000 = 19 913,85 $/véh ; véhicule léger : voir re-remplacement.

### Tableau année par année (dollars nominaux ; deux dernières colonnes actualisées)

Colonnes « alt » = scénario alternatif (composantes) ; le flux net de la référence est reconstitué dans le classeur Excel colonne par colonne.

| n | Acquisition alt | Subventions | Énergie alt | Entretien alt | Opex infra | Résiduels alt | Flux net alt | Flux net réf | Économie nominale | Flux act. alt | Flux act. réf |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 975 333,88 | 14 000,00 | 0,00 | 0,00 | 0,00 | 0,00 | 961 333,88 | 459 845,25 | -501 488,63 | 961 333,88 | 459 845,25 |
| 1 | 0,00 | 152 500,00 | 7 842,71 | 19 577,50 | 4 151,25 | 0,00 | -120 928,54 | 110 014,70 | 230 943,24 | -115 170,04 | 104 775,90 |
| 2 | 0,00 | 0,00 | 8 117,21 | 20 066,94 | 4 255,03 | 0,00 | 32 439,18 | 113 178,30 | 80 739,13 | 29 423,29 | 102 656,06 |
| 3 | 0,00 | 0,00 | 8 401,31 | 20 568,61 | 4 361,41 | 0,00 | 33 331,33 | 116 433,39 | 83 102,07 | 28 792,85 | 100 579,54 |
| 4 | 0,00 | 0,00 | 8 695,36 | 21 082,83 | 4 470,44 | 0,00 | 34 248,62 | 119 782,63 | 85 534,01 | 28 176,43 | 98 545,47 |
| 5 | 0,00 | 0,00 | 8 999,69 | 21 609,90 | 4 582,20 | 0,00 | 35 191,79 | 123 228,75 | 88 036,96 | 27 573,69 | 96 552,95 |
| 6 | 0,00 | 0,00 | 9 314,68 | 22 150,14 | 4 696,76 | 0,00 | 36 161,58 | 126 774,57 | 90 612,99 | 26 984,33 | 94 601,14 |
| 7 | 0,00 | 0,00 | 9 640,70 | 22 703,90 | 4 814,18 | 0,00 | 37 158,77 | 130 422,99 | 93 264,22 | 26 408,05 | 92 689,18 |
| 8 | 0,00 | 0,00 | 9 978,12 | 23 271,50 | 4 934,53 | 0,00 | 38 184,15 | 134 176,99 | 95 992,84 | 25 844,53 | 90 816,27 |
| 9 | 0,00 | 0,00 | 10 327,35 | 23 853,28 | 5 057,90 | 0,00 | 39 238,53 | 138 039,64 | 98 801,11 | 25 293,51 | 88 981,58 |
| 10 | 127 947,03 | 0,00 | 10 688,81 | 24 449,61 | 5 184,34 | 9 900,00 | 158 369,80 | 249 329,59 | 90 959,79 | 97 225,32 | 153 066,74 |
| 11 | 0,00 | 0,00 | 11 062,92 | 25 060,86 | 5 313,95 | 0,00 | 41 437,73 | 146 103,64 | 104 665,91 | 24 227,78 | 85 423,77 |
| 12 | 0,00 | 0,00 | 11 450,12 | 25 687,38 | 5 446,80 | 178 444,60 | -135 860,30 | 20 765,80 | 156 626,09 | -75 652,10 | 11 563,17 |
| **Σ** | 1 103 280,91 | 166 500,00 | 114 518,99 | 270 082,44 | 57 268,79 | 188 344,60 | **1 190 306,52** | **1 988 096,24** | **797 789,72** | **1 110 461,52** | **1 580 097,03** |

### Résultats

| Indicateur | Valeur |
|---|---:|
| TCO actualisé — alternative | 1 110 461,52 $ |
| TCO actualisé — référence | 1 580 097,03 $ |
| VAN différentielle (réf − alt) | 469 635,51 $ |
| km actualisés (dénominateur commun) | 1 329 487,75 km |
| TCO/km actualisé — alternative | 0,8353 $/km |
| TCO/km actualisé — référence | 1,1885 $/km |
| Délai de récupération simple | 5 |
| Délai de récupération actualisé | 5 |
| CO₂e évité cumulé TTW | 890,950 t |
| CO₂e évité cumulé WTW | 1 112,596 t |
| Coût par tonne WTW évitée | **gain net de 422,11 $/t** (TCO alternatif inférieur à la référence) |

**Lecture.** Le plan est gagnant : VAN +469 635,51 $, payback (simple et actualisé) à l'année 5, gain net de 422,11 $/t WTW évitée. Les pointes des années 10 (re-remplacement des 2 véhicules légers, dans les deux scénarios) et 12 (valeurs résiduelles) sont visibles dans le tableau.

---


## Ambiguïtés rencontrées et interprétations retenues

Chaque point ci-dessous est un endroit où la méthodologie (ou le mandat) ne
tranchait pas explicitement ; l'interprétation la plus simple a été retenue et
documentée. Les mêmes choix sont appliqués dans les scripts Python, le JSON et
le classeur Excel.

1. **Valeur résiduelle sur le prix avant taxes, non indexée.** §3.7 écrit
   `VR = max(Prix × (1−d)^H ; Plancher × Prix)` sans préciser « avant ou
   après taxes » ni indexation. Retenu : VR calculée sur le **prix avant
   taxes** (les taxes non récupérables sont un coût, pas une valeur
   revendable) et **nominale non indexée** (la dépréciation géométrique est
   réputée s'appliquer au prix courant payé). Pour les véhicules rachetés à
   l'an 10 du cas 6, la VR se calcule sur le **prix effectivement payé à
   l'an 10** (49 500 × 1,021¹⁰), cohérent avec « prix » = prix d'acquisition.
2. **VR des véhicules en fin de vie au re-remplacement (cas 6) = plancher
   10 %**, conformément au mandat, alors que la formule géométrique donnerait
   0,82¹⁰ = 13,7 % (BEV) et 0,85¹⁰ = 19,7 % (diesel) à 10 ans. Interprétation :
   un véhicule retiré parce qu'il est **en fin de vie utile** vaut sa valeur
   de ferraille/pièces (plancher), pas sa valeur théorique de marché. Écart
   documenté : ceci réduit la recette de l'an 10 de ~1 850 $/VL (alt) et
   ~4 360 $/VL (réf) par rapport à la formule §3.7 appliquée aveuglément.
3. **Écocamionnage classes 5-8 : pourcentage à valider.** Le registre
   (`subsidy-programs.ts`) n'a pas pu extraire le % du coût d'achat des
   classes 5-8 (mise en page du PDF des modalités) ; seuls les plafonds sont
   vérifiés (100 000 $ classes 5-7 ; 150 000 $ classe 8). Borne basse
   **25 %** retenue (prudente, alignée sur la classe 3). Cas 3 :
   115 000 $ ; cas 5 : plafonné à 150 000 $ ; cas 6 : 75 000 $/camion moyen.
4. **Année de versement des subventions.** PAVÉ et Roulez vert : point de
   vente (année 0, `anneeVersementDefaut: 0`). Écocamionnage : versement
   unique après livraison et approbation → **année 1**
   (`anneeVersementDefaut: 1`), actualisé à 1/(1,05)¹. Le montant n'est pas
   indexé (montant du programme, pas un prix).
5. **FTCZE / PAGTCP jamais comptés automatiquement** (cas 2) : plafond par
   véhicule = 0 au registre (« montants par projet ») ; le cas 2 est donc
   calculé **sans aucune subvention**, ce qui explique sa VAN négative — un
   montant réel de projet renverserait le résultat.
6. **Majoration hivernale appliquée aussi au FCEV** (coût et émissions),
   comme l'indiquent le mandat et la note de `majoration_hivernale_bev`
   (« s'applique aussi aux FCEV »). Pour l'électricité, la majoration et les
   pertes de recharge s'appliquent **avant** le facteur d'émission (émissions
   comptées sur les kWh au compteur, §5).
7. **Entretien d'infrastructure indexé dès l'année 1** : opex(n) = 3 % ×
   capex avant taxes × (1,025)ⁿ — même convention « prix année 0 × (1+g)ⁿ »
   que tous les flux d'exploitation (le montant de l'année 1 porte donc déjà
   une année d'indexation). Les taxes non récupérables ne s'appliquent qu'au
   capex (an 0), pas à l'opex ni aux valeurs résiduelles.
8. **VR d'infrastructure sur le capex avant taxes**, linéaire :
   capex × (15−H)/15, nominale, fin d'horizon (§3.5 ne précise pas la base ;
   même logique que les véhicules).
9. **Payback : tous les flux comptent, à leur année.** La définition §6.1
   (« économies d'exploitation cumulées couvrent le surcoût net ») a été
   opérationnalisée comme au mandat : cumul de (flux_réf − flux_alt) depuis
   l'année 0 incluse, subventions et **valeurs résiduelles comprises** à leur
   année. Un payback ne peut donc être détecté qu'à l'intérieur de l'horizon ;
   s'il n'est atteint qu'à l'année H grâce à la VR, il est rapporté à H.
   Raisons de `null` : « économies annuelles négatives » si tous les deltas
   des années 1..H sont ≤ 0, sinon « surcoût non résorbé à l'horizon H »
   Cas 2 et 5 : « surcoût non résorbé à l'horizon H=10 » (au cas 5, seule
   l'année 1 — subvention — et l'année 10 — VR — ont un delta positif ; le
   cumul reste négatif).
10. **Cas 5 — pas d'infrastructure H₂** : ravitaillement externe ; le prix de
    16,50 $/kg **inclut déjà** production + transport + distribution
    (méthodologie §3.3, « prix livré »). Aucun capex ni opex d'infra, donc
    pas de VR d'infra.
11. **Rachat de l'an 10 (cas 6) sans subvention** : PAVÉ se termine le
    2031-03-31 et Roulez vert le 2026-12-31 (registre) — un achat en 2036 n'y
    est plus admissible. Prix indexé à l'**inflation générale** (2,1 %),
    trajectoire batterie désactivée par défaut (§7.5).
12. **Assurance et immatriculation = 0** (non fournies, §3.6 : jamais
    d'heuristique) ; aucun événement majeur (batterie, pile, réfection) daté
    dans ces cas.
13. **TCO/km : dénominateur commun** = km annuels × Σₙ₌₁..ᴴ 1/(1,05)ⁿ (les km
    de l'année 0 sont nuls). Même dénominateur pour l'alternative et la
    référence (kilométrages identiques par construction).
14. **Cas 2 : consommation 140 kWh/100 km imposée par le mandat** (le défaut
    de catégorie serait 150) ; la majoration hivernale standard est appliquée
    par-dessus la base été, bien que la source STM/Concordia mesure déjà des
    valeurs été/hiver distinctes — convention du moteur conservée.
15. **Arrondis** : calculs en double précision, arrondis **à la fin**
    seulement (cent pour les montants, 3 décimales pour les tonnes). Dans le
    JSON, le TCO/km est donné à 4 décimales (l'arrondi au cent détruirait
    l'information sur un $/km).
16. **Somme des subventions ≤ coût admissible** : vérifié trivialement dans
    tous les cas (aucun cumul n'approche le prix du véhicule).

## Cohérence des trois livrables

- `docs/tco-cas-de-reference.json` : mêmes calculs, précision complète,
  arrondis en sortie.
- `docs/tco-verification.xlsx` (généré par
  `scripts/tco-verification-xlsx.py`) : toutes les cellules de calcul sont
  des **formules Excel** référençant la feuille « Hypothèses » et les entrées
  du cas (aucun résultat collé en dur) ; le classeur recalculé
  indépendamment reproduit au cent près les 11 indicateurs de chaque cas,
  et la cellule de contrôle du cas 6 vérifie que la somme des parts
  d'infrastructure égale le capex (« OK »).
- Aucun écart constaté entre les scripts Python et les formules du classeur.

---

## Écart ancien moteur → contre-calcul de la nouvelle méthodologie

Les 6 mêmes cas ont été passés dans l'**ancien moteur**
(`src/lib/calculations/tco.ts`, `calculateTCO`) avec ses propres limites
d'entrée (prix des véhicules et des énergies surchargés via
`ReferenceData` ; le reste — consommations, subventions, taxes, infra —
n'est **pas paramétrable** par véhicule dans l'ancien modèle ; cas 6
approximé en 5 BEV identiques aux moyennes pondérées).

| Cas | Ancien : TCO alt | Ancien : « baseline » | Ancien : économies | Nouveau : TCO alt | Nouveau : TCO réf | Nouveau : VAN diff |
|---|---:|---:|---:|---:|---:|---:|
| 1 Camionnette BEV | 174 852 | 420 833 | +245 981 | 142 987 | 219 656 | +76 669 |
| 2 Autobus 12 m BEV | 1 661 382 | 1 277 016 | −384 366 | 2 399 980 | 1 914 850 | −485 130 |
| 3 Camion lourd BEV | 530 304 | 783 291 | +252 987 | 820 199 | 944 295 | +124 096 |
| 4 Véhicule léger BEV | 129 374 | 359 525 | +230 151 | 78 347 | 123 559 | +45 212 |
| 5 Camion lourd FCEV | 1 335 109 | 783 291 | −551 818 | 1 396 177 | 944 295 | −451 882 |
| 6 Mini-plan 5 véh. | 1 226 679 | 2 525 176 | +1 298 497 | 1 110 462 | 1 580 097 | +469 636 |

(Ancien moteur : payback 0,15 an au cas 4 et 0,77 an au cas 1 ;
infrastructure = 0 partout ; CO₂ total 6-45 t sur 10 ans.)

**Causes des écarts, par ordre d'impact :**

1. **Consommations figées à des valeurs de camion lourd** (35,7 L/100 km
   diesel, 120 kWh/100 km BEV) quelles que soient la catégorie et la
   saisie : la « référence diesel » d'une camionnette (15 L/100 réels)
   est facturée comme un classe 8 → économies gonflées de ~170 k$ au
   cas 1, ~235 k$ au cas 4, payback fantaisiste (0,15 an).
2. **Aucune subvention déduite** : l'ancien moteur ignore
   `subsidyPerVehicle` (cas 3 : 115 k$ ; cas 5 : 150 k$ ; cas 4 : 7 k$
   non déduits).
3. **Infrastructure absente** (0 $ partout) faute de bloc
   `fleetComposition.infrastructure` « appliqué » : 265 k$ manquants aux
   cas 2-3, 135 k$ au cas 6 — et aucune répartition par véhicule.
4. **Ni taxes non récupérables, ni rendement de recharge, ni majoration
   hivernale** : l'énergie électrique est facturée aux kWh « batterie »
   d'un profil été.
5. **CO₂ sous-estimé d'un ordre de grandeur** (6-45 t sur 10 ans au lieu
   de 62-919 t) : facteur réseau mal converti et périmètre TTW/WTW non
   défini ; le CO₂ « évité » (280-1 735 t) est calculé contre la
   référence 35,7 L/100 gonflée.
6. **Valeur résiduelle linéaire sur 12 ans plancher 10 %** vs dépréciation
   géométrique par technologie ; et **NPV = −(TCO)** sans signification
   différentielle.

Conclusion : l'ancien moteur surestime systématiquement le dossier
d'électrification des petits véhicules (économies 3 à 5 × trop élevées)
et sous-estime les coûts d'infrastructure et le CO₂ évité réel. Aucun de
ses chiffres n'est présentable à un conseil municipal.

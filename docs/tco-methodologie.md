# Méthodologie de calcul du coût total de possession (TCO)

**H2Fleet — spécification du moteur de calcul `src/lib/tco/`**
Version 2.0 (révision de la revue externe) — 2026-09-28 — statut : **en validation**

> Historique : v1.0 = spécification initiale (Phase 1A). v1.1 intègre les
> précisions issues du contre-calcul indépendant des 6 cas de référence
> (les « ambiguïtés » relevées, tranchées en §10). v1.2 (Phase 3) ajoute
> l'année d'acquisition par véhicule (§10.11). v2.0 (revue externe)
> révise : VR unifiée au re-remplacement (§10.2), infrastructure à
> l'année de mise en service avec ré-investissement (§3.5), assurance
> codée (§3.6), convention des consommations nominales tempérées (§3.3),
> convention du coût par tonne (§6.1). Le moteur (engineVersion 2.0.0)
> implémente cette version ; les 7 cas de référence sont régénérés par
> le contre-calculateur indépendant committé (scripts/reference-cases/).

Ce document est la référence unique de la méthode de calcul. Il est écrit
pour être lu par un directeur des finances municipal : chaque formule est
écrite en toutes lettres, chaque hypothèse est traçable. Il servira
d'annexe méthodologique aux rapports produits par H2Fleet et de base à la
page « Méthodologie » publique. Le moteur de calcul implémente ce
document ; tout écart entre le code et ce document est un bogue de l'un
ou de l'autre, jamais une « interprétation ».

---

## 1. Objet et portée

Le moteur répond à une question :

> Pour ma flotte réelle, combien coûte, année par année, le remplacement
> planifié de mes véhicules par des véhicules électriques à batterie
> (BEV) ou à hydrogène (FCEV), comparé au statu quo (remplacement par du
> diesel neuf équivalent), et quelles émissions de GES cela évite-t-il ?

Il calcule, **par véhicule et par année**, tous les coûts de possession
(acquisition, subventions, énergie, entretien, infrastructure, assurance,
valeur résiduelle), les agrège au niveau du plan, et produit deux vues :
une vue **économique** (valeurs actualisées, pour comparer des options)
et une vue **budgétaire** (flux nominaux par année, pour préparer un
budget et un PTI — plan triennal d'immobilisations).

Sont hors portée du moteur : la taxe carbone incluse dans les prix à la
pompe (elle est déjà dans le prix du diesel observé), la fiscalité des
amortissements (les organismes municipaux ne sont pas imposés), le
financement par emprunt (le coût du capital est représenté par le taux
d'actualisation ; le service de la dette peut être ajouté en Phase 3).

## 2. Conventions générales

### 2.1 Chronologie des flux

- **Année 0** = année d'acquisition du véhicule (ou année de référence du
  plan pour les dépenses communes). L'investissement initial
  (acquisition, part d'infrastructure) est compté **au point 0**, non
  actualisé.
- Les années d'exploitation sont numérotées **n = 1, 2, …, H** (H =
  horizon d'analyse). Tous les flux d'exploitation de l'année n sont
  comptés **en fin d'année n** et actualisés par le facteur
  `1 / (1 + r)^n`.
- **Choix justifié — fin d'année plutôt que milieu d'année** : les coûts
  d'exploitation s'étalent en réalité sur toute l'année (le milieu
  d'année serait plus « exact » d'environ un demi-facteur
  d'actualisation), mais la convention de fin d'année est (a) celle que
  reproduit naturellement un tableur ligne par ligne, donc vérifiable par
  n'importe quel analyste financier, (b) **prudente** : elle sous-estime
  légèrement la valeur actualisée des économies d'exploitation des
  véhicules zéro émission, donc ne gonfle jamais le dossier en leur
  faveur. Elle s'applique partout, sans exception.
- La **valeur résiduelle** est un flux négatif (une recette) compté en
  fin d'année H.
- Les **subventions** sont comptées l'année de leur versement (§ 3.2) :
  au point 0 si versées à l'achat, en fin d'année n sinon.

### 2.2 Dollars nominaux, inflation par poste, actualisation nominale

- Tous les flux sont exprimés en **dollars courants (« nominaux »)** :
  le coût de l'année n est le prix d'aujourd'hui multiplié par
  `(1 + g)^n`, où `g` est le taux d'inflation **propre au poste**
  (diesel, électricité, hydrogène, entretien, général). Les prix des
  énergies n'évoluent pas au même rythme que l'inflation générale — les
  confondre fausserait précisément ce que l'outil doit mesurer.
- L'actualisation utilise un **taux nominal** `r`, cohérent avec des flux
  nominaux (relation de Fisher : `1 + r_nominal =
  (1 + r_réel) × (1 + π)` où π est l'inflation générale). Mélanger un
  taux réel et des flux nominaux est une erreur classique que le moteur
  interdit par construction (le type d'entrée exige un taux nominal).
- Deux expressions monétaires coexistent et sont TOUJOURS étiquetées :
  la **vue budgétaire** est en dollars **courants de chaque année**
  (ce que le conseil votera cette année-là) ; les montants **actualisés**
  (TCO, VAN) sont exprimés en dollars **de l'année de référence** du
  projet (l'année 0, affichée sur chaque rapport). Les prix d'entrée du
  registre sont datés (champ `anneeDollars`).

### 2.3 Taux : stockage en décimal

Tous les taux (actualisation, inflations, dépréciation, rendement de
recharge…) sont stockés et manipulés **en décimal** (`0.05` = 5 %). La
conversion en pourcentage n'existe qu'à l'affichage. (Corrige le bogue
actuel du PDF qui affiche « 500 % » en multipliant par 100 une valeur
déjà en pourcentage.)

### 2.4 Unités explicites

Chaque grandeur porte son unité dans son nom et dans le code :

| Grandeur | Unité canonique |
|---|---|
| Consommation diesel | L/100 km |
| Consommation électrique | kWh/100 km |
| Consommation hydrogène | kg H₂/100 km |
| Prix diesel | $/L |
| Prix électricité | $/kWh |
| Prix hydrogène | $/kg (livré) |
| Facteur d'émission diesel | kg CO₂e/L |
| Facteur d'émission électricité | **g CO₂e/kWh** |
| Facteur d'émission hydrogène | kg CO₂e/kg H₂ |
| Distances | km/an |
| Puissance | kW |
| Émissions annuelles | t CO₂e |

Une **seule** fonction de conversion (`src/lib/tco/units.ts`, testée)
fait tous les passages (g↔kg↔t, /km↔/100 km, kWh↔MWh). Le facteur
d'émission du réseau est canoniquement en **g CO₂e/kWh** parce que c'est
l'unité des publications d'ECCC ; toute autre unité est convertie à
l'entrée. (Corrige l'erreur actuelle ×1000 entre kg/kWh et kg/MWh.)

### 2.5 Entrées par véhicule

Le calcul part de la flotte **réelle**, véhicule par véhicule (aligné sur
la table `vehicles` de la Phase 2b) :

- catégorie/classe (ex. camionnette, camion porteur classe 6, autobus
  urbain 12 m…), année de mise en service, âge ;
- kilométrage annuel ;
- consommation actuelle **avec sa source** : `mesurée` (télématique),
  `saisie` (registre carburant), ou `estimation` (défaut de la
  catégorie). Une consommation inconnue prend la valeur par défaut de la
  catégorie et le résultat est marqué « estimation » — jamais
  silencieusement ;
- technologie cible (BEV, FCEV, ou statu quo diesel), année de
  remplacement prévue ;
- prix d'achat (devis réel prioritaire, sinon défaut de catégorie),
  énergie, entretien, part d'infrastructure, subventions applicables,
  valeur résiduelle, dépôt d'attache.

Chaque résultat conserve la liste des hypothèses par défaut qu'il a
utilisées et leur statut (§ 8) : un chiffre présenté à un conseil doit
pouvoir dire « ce montant repose sur 3 valeurs estimées et 2 à valider ».

## 3. Postes de coûts

Pour un véhicule v et une année n, le coût total de l'année est :

```
Coût(v, n) = Énergie(v, n) + Entretien(v, n) + Assurance(v, n)
           + ÉvénementsMajeurs(v, n)                      [si l'année n en contient]
Coût(v, 0) = Acquisition(v) − Subventions(v, versées à l'achat) + PartInfra(v)
Coût(v, H) −= ValeurRésiduelle(v, H)                      [recette en fin d'horizon]
```

### 3.1 Acquisition et taxes

```
Acquisition = PrixAvantTaxes × (1 + TauxTaxesNonRécupérables)
```

Seule la portion **non récupérable** des taxes de vente est un coût. Le
taux dépend du type d'organisation (paramètre du projet) :

- **Municipalité (Québec)** : les municipalités récupèrent 100 % de la
  TPS et une partie de la TVQ ; le taux non récupérable par défaut est
  fourni dans `assumptions.ts` avec le statut `à_valider` (source : ARC —
  remboursement aux organismes de services publics ; Revenu Québec).
- **Société de transport** : traitement analogue, `à_valider`.
- **Entreprise** : TPS et TVQ intégralement récupérées (CTI/RTI) → taux
  non récupérable 0 %.

Le prix d'achat d'un véhicule à acquérir dans le futur peut suivre une
**trajectoire** (ex. baisse du coût des batteries, § 7.5) ; par défaut la
trajectoire est désactivée (prix constant en dollars réels, donc indexé à
l'inflation générale en nominal).

### 3.2 Subventions

```
CoûtNetAcquisition = Acquisition − Σ Subventions admissibles
```

Règles, dans l'ordre :

1. **Admissibilité** : un programme ne s'applique que si la catégorie du
   véhicule, le type d'organisme et la période le permettent
   (`subsidy-programs.ts`). Un programme `fermé`, `suspendu` ou dont les
   fonds sont épuisés **n'est pas compté par défaut** — il peut être
   inclus manuellement avec un marquage explicite « hypothèse : programme
   renouvelé ».
2. **Montant** : fixe ($) ou pourcentage d'un coût admissible, selon la
   définition du programme.
3. **Plafonds** : par véhicule, par demande et par organisme quand le
   programme en fixe.
4. **Cumul** : les règles de cumul du programme sont appliquées (certains
   programmes fédéraux et provinciaux sont cumulables, d'autres
   plafonnent le total d'aide publique). Le total des subventions ne peut
   **jamais dépasser le coût admissible** :
   `Σ Subventions ≤ min(coût admissible, Σ plafonds applicables)`.
5. **Année de versement** : chaque subvention est comptée l'année où elle
   est encaissée (point de vente = année 0 ; remboursement sur demande =
   généralement année 1), paramétrable par programme. La vue budgétaire
   la montre à son année réelle.

Les subventions d'**infrastructure** suivent les mêmes règles et se
déduisent du coût d'infrastructure du site (§ 3.5), jamais du véhicule.

### 3.3 Énergie

Toutes les consommations sont d'abord ajustées des conditions
d'utilisation, puis converties en dollars de l'année n par l'inflation du
poste.

**Diesel**

```
Énergie_diesel(v, n) = km/an × (L/100 km ÷ 100) × Prix_diesel_0 × (1 + g_diesel)^n
```

Le prix du diesel est le prix à la pompe observé (Régie de l'énergie du
Québec), qui inclut déjà les taxes sur les carburants et le coût du
système de plafonnement (SPEDE). On n'ajoute **aucune** taxe carbone
par-dessus.

**Électricité**

L'énergie facturée est l'énergie **au compteur**, pas celle dans la
batterie :

```
kWh_réseau = km/an × (kWh/100 km ÷ 100) × (1 + MajorationHivernale) ÷ RendementRecharge
Énergie_élec(v, n) = kWh_réseau × CoûtEffectif_$/kWh × (1 + g_élec)^n
```

- `RendementRecharge` (défaut ≈ 0,90, § 8) couvre les pertes de recharge
  (chargeur, batterie, conditionnement thermique).
- `MajorationHivernale` : la consommation des véhicules électriques
  augmente par temps froid (chauffage de cabine et de batterie). Elle
  s'applique en moyenne annualisée :
  `MajorationAnnualisée = part_km_hiver × majoration_hiver`
  (défaut : 4 mois d'hiver ≈ 33 % des km, majoration paramétrable, § 8).
- `CoûtEffectif_$/kWh` se raisonne **au niveau du site de recharge**
  (dépôt), pas du véhicule, parce que la facture d'Hydro-Québec se
  compose de deux parties (tarif M ou G). En v2, c'est une **hypothèse
  d'entrée** ($/kWh au compteur du dépôt, registre ou donnée client) —
  le calcul automatique par site à partir de la puissance appelée n'est
  PAS implémenté ; la formule ci-dessous documente comment la dériver
  d'une facture :

```
CoûtEffectif = [ Σ kWh_site × Prix_énergie + PuissanceFacturée_kW × Prime_$/kW × 12 mois ] ÷ Σ kWh_site
```

  La puissance facturée dépend de la stratégie de recharge (recharge
  nocturne étalée vs recharge rapide simultanée). **Un devis ou une
  facture d'Hydro-Québec saisi dans le projet remplace l'estimation**
  (§ 7.6).

**Convention des consommations (toutes technologies)** : les
consommations d'entrée (saisies, télématiques ou défauts de catégorie)
sont des valeurs **NOMINALES en conditions tempérées**. Le moteur
applique la majoration hivernale annualisée PAR-DESSUS (BEV et FCEV).
Une moyenne annuelle réelle qui inclut déjà l'hiver ne doit pas être
saisie telle quelle (double comptage) — la retraiter en valeur tempérée
ou ajuster la majoration du projet.

**Hydrogène**

```
Énergie_H2(v, n) = km/an × (kg/100 km ÷ 100) × (1 + MajorationHivernale_H2) × Prix_$/kg_livré × (1 + g_H2)^n
```

Le prix est le prix **livré au dépôt** (production + transport +
compression/distribution), pas le coût de production théorique.

### 3.4 Entretien

```
Entretien(v, n) = km/an × Coût_$/km(techno, catégorie) × (1 + g_entretien)^n
```

- Coûts en $/km par technologie et par catégorie (défauts sourcés, § 8).
- **Événements majeurs optionnels et datés**, ajoutés à l'année où ils se
  produisent : remplacement de batterie (BEV), remplacement de la pile à
  combustible (FCEV), réfection majeure moteur/transmission (diesel).
  Chacun est défini par (année, coût, probabilité optionnelle) et
  apparaît comme une ligne distincte dans la ventilation — jamais fondu
  dans le $/km.

**Remplacement de batterie ou de pile à combustible** : sur les longues
durées (vie complète d'un autobus, horizon 15-16 ans), un remplacement
de batterie/pile se modélise comme un **événement majeur daté** au
montant du devis — optionnel, jamais ajouté d'office (aucun coût de
remplacement générique sourcé au registre en v2).

### 3.5 Infrastructure

L'infrastructure (bornes, installation, raccordement et mise à niveau
électrique, station H₂ le cas échéant) est calculée **une seule fois, au
niveau du site** (dépôt) ou du plan :

```
CoûtInfra_site = Équipements + Installation + Raccordement + MiseÀNiveauRéseau
               − SubventionsInfra
OpexInfra_site(n) = Entretien annuel + Frais fixes réseau
```

puis **répartie** entre les véhicules qui l'utilisent :

```
PartInfra(v) = CoûtInfra_site × Poids(v) / Σ Poids(véhicules du site)
```

Le poids par défaut est l'**énergie annuelle soutirée au site** par le
véhicule (principe de causalité des coûts) ; à défaut de données, parts
égales. Propriété garantie par construction et testée :
`Σ PartInfra(v) = CoûtInfra_site` — le coût d'infrastructure n'est
compté **ni deux fois, ni à moitié**.

**Chronologie (v2.0)** : chaque site porte une **année de mise en
service** (par défaut, l'année d'arrivée des premiers véhicules qui
l'utilisent). Le capex est payé cette année-là (indexé à l'inflation
générale, §3.8) ; l'opex court ensuite ; si la durée de vie de
l'infrastructure échoit avant l'horizon, l'équipement est **ré-investi**
(même capex, indexé) — l'équipement remplacé atteint exactement sa fin
de vie (valeur résiduelle linéaire nulle). En fin d'horizon, le dernier
équipement est crédité de sa valeur résiduelle **linéaire** au prorata
de sa durée de vie restante.

### 3.6 Assurance et immatriculation

Comptées seulement si fournies par l'organisme (beaucoup de municipalités
s'auto-assurent) : champ `assuranceParAn` ($/an) sur chaque
spécification de véhicule, indexé à l'inflation générale, poste
« assurance » distinct dans les flux. Aucune heuristique du type « 1 %
du prix du véhicule » : si la donnée n'est pas fournie, le poste vaut 0.

### 3.7 Valeur résiduelle

Dépréciation géométrique avec plancher, à l'âge `a` du véhicule :

```
VR(v, a) = max( Prix × (1 − d)^a , Plancher × Prix )   avec VR ≤ Prix
```

- `d` = taux de dépréciation annuel par technologie et catégorie (§ 8) ;
- `Plancher` (défaut 10 %) représente la valeur de ferraille/pièces ;
- **la MÊME formule s'applique partout** (v2.0) : en fin d'horizon
  (a = H − année d'achat) comme à la reprise d'un véhicule remplacé en
  fin de vie utile (a = durée de vie) ;
- la valeur résiduelle est actualisée comme tout flux de son année.

### 3.8 Horizon vs durée de vie

L'horizon d'analyse H (choisi par projet, typiquement 10-15 ans) est
distinct de la durée de vie utile du véhicule :

- si un véhicule atteint sa fin de vie à l'année k < H, le moteur compte
  son **re-remplacement** par la même technologie (au prix de l'année k,
  trajectoire incluse le cas échéant) et poursuit jusqu'à H ;
- tout véhicule encore en service à l'année H est crédité de sa valeur
  résiduelle au prorata de son âge.

Les deux scénarios comparés (§ 4) utilisent le **même** horizon et les
mêmes règles — jamais un horizon favorable à l'un des deux.

## 4. Scénario de référence (statu quo)

Les économies n'existent que **par rapport à quelque chose**. La
référence est définie ainsi :

> La même flotte réelle, avec le même calendrier de fin de vie ; chaque
> véhicule arrivant en fin de vie est remplacé par un **diesel neuf
> équivalent** de la même catégorie ; mêmes kilométrages, mêmes
> hypothèses économiques, même horizon.

Le moteur calcule les deux scénarios avec **le même code** — la référence
est un plan dont la technologie cible de chaque véhicule est « diesel » —
puis fait la différence **poste par poste** :

```
Économies(n) = Coût_référence(n) − Coût_alternative(n)     [par poste et au total]
CO2_évité(n) = Émissions_référence(n) − Émissions_alternative(n)
```

(Ceci corrige le défaut du moteur actuel, dont la référence « diesel
seul » conservait la configuration cible du scénario et produisait des
économies nulles et un délai de récupération vide.)

## 5. Émissions de GES

Deux périmètres, toujours affichés côte à côte :

- **Réservoir-à-roue (TTW)** : combustion seulement. Diesel : facteur
  kg CO₂e/L incluant CO₂, CH₄ et N₂O (source : ECCC, Rapport
  d'inventaire national, annexe des facteurs d'émission ; le CH₄ et le
  N₂O ajoutent ~1-2 % au CO₂ seul). Électricité et H₂ : 0 en TTW.
- **Puits-à-roue (WTW)** : cycle de vie du carburant. Diesel : TTW +
  amont (extraction, raffinage, transport). Électricité : intensité du
  réseau **par province** (Québec par défaut : ~1,2 g CO₂e/kWh, parmi
  les plus bas au monde). Hydrogène : **par filière** — électrolyse au
  Québec, reformage du méthane (SMR) avec ou sans captage — jamais un
  « H₂ moyen » qui n'existe pas.

```
Émissions_diesel(v, n) = L consommés × FE_diesel [kg CO₂e/L] ÷ 1000   [t CO₂e]
Émissions_élec(v, n)  = kWh_réseau × FE_réseau [g CO₂e/kWh] ÷ 1 000 000
Émissions_H2(v, n)    = kg H₂ × FE_filière [kg CO₂e/kg] ÷ 1000
```

Sorties : t CO₂e par an, cumulées sur l'horizon, t CO₂e **évitées** vs la
référence, et **coût par tonne évitée** :

```
Coût/tonne = (TCO_alternative − TCO_référence) ÷ t CO₂e évitées cumulées
```

(affiché « gain net par tonne évitée » quand le TCO alternatif est
inférieur à la référence).

**Convention du coût par tonne évitée** : numérateur = surcoût
ACTUALISÉ (TCO_alternative − TCO_référence, dollars de l'année de
référence) ; dénominateur = tonnes de CO₂e évitées **physiques, non
actualisées** (somme simple sur l'horizon). Cette convention — la plus
répandue dans les analyses publiques — est affichée avec le chiffre ;
actualiser aussi les tonnes serait défendable mais donnerait des
valeurs non comparables aux barèmes usuels ($/t).

**Valorisation carbone** : optionnellement, les tonnes évitées peuvent
être valorisées au **coût social du carbone** d'ECCC (mise à jour 2023).
Cette valorisation est affichée **séparément, hors TCO** — un conseil
municipal doit voir le coût budgétaire réel et l'argument climatique
comme deux lignes distinctes, pas un chiffre fusionné.

## 6. Sorties

### 6.1 Vue économique (comparer des options)

- **TCO actualisé** du plan et par véhicule :
  `TCO = Σ_{n=0..H} Coût(n) ÷ (1 + r)^n`
- **TCO par km** : TCO ÷ km actualisés au même taux (cohérence
  numérateur/dénominateur) ;
- **VAN différentielle** : `VAN = TCO_référence − TCO_alternative`
  (positive = l'alternative coûte moins cher au total) ;
- **Délai de récupération simple** : plus petite année n telle que les
  économies d'exploitation nominales cumulées couvrent le surcoût
  d'investissement net (subventions déduites). **Actualisé** : même
  définition sur flux actualisés. Si jamais atteint sur l'horizon, le
  résultat est `null` **avec la raison** (« les économies annuelles sont
  négatives » / « le surcoût n'est pas résorbé à l'horizon H ») — jamais
  un zéro ou un plafond silencieux ;
- **Coût par tonne de CO₂e évitée** (§ 5).

### 6.2 Vue budgétaire (préparer un budget)

Tableau **année par année, en dollars nominaux non actualisés** :

- dépenses d'**investissement** (acquisitions, infrastructure) — la
  matière du PTI ;
- dépenses de **fonctionnement** (énergie, entretien, assurance) ;
- **subventions**, chacune à son année de versement ;
- valeur résiduelle à l'année H ;
- **reste à financer** = investissement − subventions de l'année ;
- la même chose pour la référence, et l'écart.

C'est la vue qu'on présente à un conseil : « voici ce que ça change au
budget de 2027, 2028, 2029… », sans actualisation à expliquer.

### 6.3 Ventilation et traçabilité

Chaque résultat comporte :

- la **ventilation ligne par ligne** (par véhicule, par année, par
  poste) qui reconstitue exactement les totaux ;
- `engineVersion` (version sémantique du moteur) ;
- l'**empreinte des hypothèses** (hachage stable de toutes les valeurs
  utilisées) : deux résultats avec la même empreinte et la même version
  sont identiques au cent près ;
- la **liste des hypothèses par défaut utilisées** avec leur statut
  (`vérifié` / `estimation` / `à_valider`) — le rapport final affiche
  « ce calcul repose sur N hypothèses à valider » avec la liste.

## 7. Incertitude et stress test

Un chiffre unique sur 10 ans est une fiction. Le moteur produit toujours
une **fourchette**.

### 7.1 Plages par hypothèse

Chaque hypothèse externe (prix des énergies, subventions, prix d'achat
futurs, valeur résiduelle, entretien, coût de raccordement, taux
d'actualisation, inflations, taux de change, droits de douane) porte une
valeur **basse / centrale / haute**, sourcée ou marquée `à_valider`
(§ 8). Les curseurs du stress test parcourent **ces plages** — pas un
±20 % arbitraire.

### 7.2 Trois scénarios cohérents

- **Prudent** : toutes les hypothèses prennent la borne défavorable à
  l'électrification (diesel bas, électricité/H₂ hauts, subventions
  minimales, résiduel ZE bas, raccordement haut…) ;
- **Central** : valeurs centrales ;
- **Favorable** : bornes favorables.

Les rapports affichent systématiquement les trois (fourchette), jamais le
seul central.

### 7.3 Sensibilité : le vrai moteur, pas des coefficients

Chaque variation d'un paramètre **relance le moteur complet** sur la
flotte et le plan réels (`src/lib/tco/sensitivity.ts`). Aucune
« part de coût » précalculée, aucun coefficient d'impact inventé.
(Remplace intégralement la logique actuelle de `useRiskAnalysis` : parts
30/25/20/15/10/20 %, coefficients ×0,6/×0,8/×1,2 et flotte fictive de
10 véhicules disparaissent.)

Sens des effets — vérifié par un test unitaire chacun :

| Paramètre qui augmente | Effet sur le dossier d'électrification |
|---|---|
| Prix du diesel | **Favorable** (la référence coûte plus cher) |
| Prix de l'électricité | Défavorable |
| Prix de l'hydrogène | Défavorable |
| Subventions | Favorable (et TCO jamais réduit sous le coût net) |
| Prix d'achat des ZE | Défavorable |
| Coût de raccordement | Défavorable |
| Taux d'actualisation | Défavorable (les économies futures pèsent moins) |

### 7.4 Résultats du stress test

- **Diagramme tornade** : les paramètres classés par influence sur la
  VAN différentielle (recalculée réellement à chaque borne) ;
- **Niveau de risque calculé**, pas déclaré : l'alternative reste-t-elle
  gagnante dans le scénario Prudent ? (oui → risque faible ; gagnante au
  Central seulement → moyen ; perdante au Central → élevé) ;
- les **3 paramètres les plus influents** sont nommés dans le rapport.

### 7.5 Trajectoire des prix d'achat, change et douanes

- Le prix d'un véhicule acheté l'année k peut suivre une trajectoire
  (baisse attendue du coût des batteries), **sourcée** et
  **désactivable** ; par défaut : désactivée (prudence).
- Pour un véhicule importé, le prix se décompose en
  `Prix_origine × TauxChange × (1 + Douanes)` ; les taux (USD/CAD,
  CNY/CAD) et le régime de droits selon l'origine sont des hypothèses
  datées et sourcées (le régime canadien sur les VE chinois a changé en
  février 2026 — quota à 6,1 % — et peut rechanger : statut `à_valider`
  daté).

### 7.6 Devis prioritaires

Toute donnée réelle saisie dans le projet **remplace** l'estimation
correspondante et son statut devient `mesuré/devis` : devis
d'Hydro-Québec pour le raccordement, soumission d'un constructeur pour un
véhicule, lettre d'octroi d'une subvention. L'estimation ne sert que
d'ordre de grandeur en amont.

## 8. Hypothèses par défaut : source unique et honnêteté

Toutes les valeurs par défaut vivent dans **`src/lib/tco/assumptions.ts`**
(et les programmes de subventions dans
**`src/lib/tco/subsidy-programs.ts`**). Chaque valeur porte :

```
valeur, unité, plage {basse, haute}, région, année des dollars,
source {organisme, document, année, tableau/page, URL},
dateVérification, statut : "vérifié" | "estimation" | "à_valider"
```

- **vérifié** : la source a été réellement ouverte et la valeur lue, à la
  date indiquée ;
- **estimation** : ordre de grandeur professionnel, plage large, à
  affiner (ex. consommation par catégorie en attendant la télématique) ;
- **à_valider** : la valeur probable est indiquée mais la source n'a pas
  pu être consultée — l'URL exacte à consulter est fournie. Un rapport
  qui repose sur des hypothèses `à_valider` l'affiche.

`docs/tco-hypotheses.md` est **généré** depuis `assumptions.ts` (un test
de CI échoue s'il n'est pas à jour) : le document que lit un vérificateur
est toujours celui que le code utilise.

Les valeurs par défaut sont **versionnées dans le code**, pas en base de
données. La base ne contient que les **surcharges par projet**
(hypothèses modifiées par l'utilisateur), réellement lues par le moteur.
La table `reference_data_ranges` et les « surcharges d'experts » de
l'ancien système (jamais lues par les calculs, catégories incohérentes)
sont retirées avec lui.

## 9. Limites connues de la version 1

- Le service de la dette (financement par emprunt et règlement
  d'emprunt) n'est pas modélisé ; le taux d'actualisation en tient lieu.
- Les coûts indirects de transition (formation des mécaniciens,
  adaptation des ateliers, gestion du changement) ne sont pas inclus par
  défaut ; ils peuvent être saisis comme coûts ponctuels datés.
- La dégradation de la batterie (perte d'autonomie, pas de coût direct)
  n'affecte pas la consommation modélisée ; l'événement « remplacement de
  batterie » (§ 3.4) est le mécanisme prévu.
- La modélisation fine des tarifs d'Hydro-Québec (appels de puissance
  15 min, tarification dynamique, crédits de puissance hivernale) est
  approchée par le coût effectif au site (§ 3.3) tant qu'un devis ou une
  facture réelle n'est pas saisi.
- Les émissions de la fabrication des véhicules (analyse de cycle de vie
  complète) sont hors périmètre : les périmètres affichés sont TTW et
  WTW carburant.

## 10. Précisions normatives (v1.1-v1.2) — points tranchés après contre-calcul

Chaque point ci-dessous était une zone muette de la v1.0, relevée par le
contre-calcul indépendant des cas de référence ; la règle retenue est
désormais NORMATIVE et testée dans le moteur.

1. **Assiette de la valeur résiduelle** : le prix AVANT taxes payé pour
   ce véhicule (pour un rachat futur : le prix indexé effectivement
   payé), en dollars nominaux, NON indexée entre l'achat et la revente.
2. **Re-remplacement (§3.8) — RÉVISÉ v2.0 (revue externe)** : le
   véhicule remplacé en fin de vie utile est repris à sa **VR
   géométrique planchée à l'âge = durée de vie** — la MÊME méthode
   qu'en fin d'horizon (l'ancienne règle « plancher forfaitaire »
   créait deux méthodes pour le même concept). Le rachat se fait au
   prix avant taxes indexé à l'inflation générale (trajectoire
   technologique désactivée par défaut), taxes non récupérables
   ajoutées, **sans subvention** (aucun programme actuel ne garantit un
   barème à cet horizon).
3. **Subventions** : montants nominaux NON indexés ; comptées à leur
   année de versement, y compris dans le calcul du délai de
   récupération. Versement par défaut : an 0 (point de vente — PAVÉ,
   Roulez vert), an 1 (après livraison et approbation — Écocamionnage).
4. **Majoration hivernale** : s'applique aux BEV **et aux FCEV**
   (chauffage de cabine), sur les coûts ET les quantités d'énergie qui
   servent aux émissions.
5. **Émissions de l'électricité** : calculées sur les kWh **au
   compteur** (pertes de recharge incluses).
6. **Infrastructure — RÉVISÉ v2.0** : entretien = % du capex AVANT
   taxes, indexé à l'inflation entretien après la mise en service ;
   taxes non récupérables sur le capex seulement ; capex payé à
   l'**année de mise en service** (défaut : arrivée des premiers
   véhicules du site), indexé à l'inflation générale ;
   **ré-investissement** en fin de durée de vie tant que l'horizon la
   dépasse ; valeur résiduelle linéaire du dernier équipement en fin
   d'horizon.
7. **Délai de récupération (§6.1)** : cumul des écarts nominaux
   (référence − alternative) **depuis l'année 0 incluse**, subventions
   et valeurs résiduelles comptées à leur année ; le résultat est la
   première année entière où le cumul devient ≥ 0. Version actualisée :
   mêmes flux actualisés. Raisons de `null` : « les économies annuelles
   sont nulles ou négatives » ou « le surcoût n'est pas résorbé à
   l'horizon H=… ».
8. **TCO par km** : TCO actualisé ÷ kilomètres des années 1..H
   actualisés au même taux (cohérence numérateur/dénominateur).
9. **Événements majeurs (§3.4)** : montants saisis en dollars courants
   de leur année (devis) — ni taxes ajoutées, ni indexation.
10. **Coût par tonne évitée** : signé — négatif = gain net par tonne ;
    `null` si aucune tonne n'est évitée.
11. **Année d'acquisition par véhicule (v1.2, engineVersion 1.1.0)** :
    chaque véhicule du plan porte une `anneeAcquisition` (défaut 0 =
    année de référence). Les DEUX scénarios achètent la même année
    (« même calendrier de fin de vie », §4) : avant l'acquisition, le
    véhicule actuel est identique des deux côtés et le différentiel est
    nul — ses coûts réels d'avant remplacement n'apparaissent dans aucun
    des deux scénarios. Le prix de l'achat en année k est indexé à
    l'inflation générale (§3.8) ; l'exploitation court des années k+1 à
    H ; les émissions comptent H−k années ; les kilomètres actualisés du
    TCO/km ne comptent que les années k+1..H de chaque véhicule ; les
    re-remplacements partent de k (k, k+durée, …). Les années de
    versement des subventions restent ABSOLUES dans le plan (point de
    vente = k). Une acquisition à k ≥ H est signalée et sans effet.

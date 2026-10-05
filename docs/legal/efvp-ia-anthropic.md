> **BROUILLON À FAIRE VALIDER PAR UN JURISTE** — modèle préparé à partir du
> fonctionnement réel du logiciel H2Fleet (octobre 2026). Il ne constitue pas
> un avis juridique. Les références légales, les conditions du fournisseur et
> les éléments entre crochets `[…]` sont à vérifier ou à compléter.

# Évaluation des facteurs relatifs à la vie privée (EFVP)
## Communication de renseignements à l'extérieur du Québec — fonctions d'intelligence artificielle de H2Fleet (fournisseur : Anthropic, PBC, États-Unis)

| | |
|---|---|
| Exploitant (entreprise) | [Nom légal de l'exploitant — à confirmer] |
| Personne responsable de la protection des renseignements personnels | [Nom, titre — à confirmer] |
| Organisation cliente concernée | [Nom de l'organisation cliente] |
| Version / date | Brouillon 0.1 — [date] |
| Rédaction | [Nom] · Révision juridique : [Nom du juriste, date] |

### 0. Pourquoi cette évaluation

- **Entreprise (exploitant de H2Fleet)** : avant de communiquer un
  renseignement personnel à l'extérieur du Québec, une EFVP est exigée par la
  *Loi sur la protection des renseignements personnels dans le secteur privé*
  (RLRQ, c. P-39.1), notamment son art. 17 ; une EFVP est aussi exigée pour un
  projet de système d'information traitant des renseignements personnels
  (art. 3.3). *[Références à vérifier.]*
- **Client municipal (organisme public)** : la municipalité reste assujettie
  à la *Loi sur l'accès aux documents des organismes publics et sur la
  protection des renseignements personnels* (RLRQ, c. A-2.1). La
  communication hors Québec (notamment art. 70.1) et le recours à un
  mandataire (notamment art. 67.2) relèvent de **sa propre** évaluation, que ce
  document vise à alimenter. *[Références à vérifier.]*
- Guide de référence : guide d'accompagnement de la Commission d'accès à
  l'information sur l'EFVP (site cai.gouv.qc.ca). *[Version à consulter.]*

### 1. Description du projet

H2Fleet aide une organisation (municipalité, société de transport,
transporteur) à planifier le remplacement de sa flotte de véhicules. Quatre
fonctions **facultatives** font appel à un modèle d'IA (Claude, d'Anthropic)
par l'API, depuis les serveurs de H2Fleet (fonctions Edge Supabase) :

| Fonction | Ce que fait l'IA | Ce qui est transmis à Anthropic |
|---|---|---|
| Copilote de projet | Répond aux questions sur le plan ; tous les chiffres viennent du moteur de calcul de H2Fleet, l'IA ne fait que rédiger | La question, l'historique de la conversation du projet et les données du projet nécessaires au calcul : numéros d'unité, catégories, kilométrages, années, garages, montants calculés |
| Import intelligent de flotte | Propose une correspondance entre les colonnes d'un fichier et les champs de H2Fleet | Les **entêtes** du fichier et **au plus 3 valeurs d'exemple** par colonne ; les colonnes de données personnelles (nom, courriel, téléphone, adresse…) sont **filtrées dans le navigateur** et ne sont jamais transmises |
| Lecture de factures et devis | Extrait des valeurs (prix, quantités) d'un document téléversé | Le **texte** du document quand il en a un, sinon le fichier ; une facture peut contenir des renseignements de facturation (adresse de service, numéro de compte) |
| Note au conseil | Rédige un brouillon de note à partir de faits calculés | Uniquement des **faits agrégés** du plan (totaux, nombre de véhicules, années) — aucun nom de personne ni donnée de véhicule individuelle |

**Désactivées par défaut.** Chaque fonction est activée séparément par un
administrateur de l'organisation cliente (Organisation › Intelligence
artificielle). Sans activation, rien n'est transmis.

### 2. Renseignements personnels en cause

| Catégorie | Présence | Commentaire |
|---|---|---|
| Identité d'employés (nom, courriel) | **Non transmise** en principe | Filtrée à l'import ; absente des faits de la note au conseil. Un utilisateur peut toutefois en saisir dans une **question libre** au copilote ou dans un document téléversé. |
| Données de véhicules (unité, NIV, kilométrage) | Oui (copilote) | Données d'organisation. Un véhicule attribué à une personne identifiable peut, indirectement, constituer un renseignement personnel. *[À apprécier par le client.]* |
| Renseignements de facturation | Possible (factures) | Adresse de service, numéro de compte du client ; non conservés dans les valeurs extraites, la pièce reste dans le stockage privé de l'organisation |
| Renseignements sensibles (santé, finances personnelles, etc.) | Non prévus | Aucun champ prévu ; avertissement à l'utilisateur recommandé |

**Sensibilité globale estimée** : faible à modérée. *[À confirmer.]*

### 3. Finalités et nécessité

- Finalité : fournir à l'organisation cliente une aide à la rédaction et à la
  saisie, sur sa demande. Aucune décision automatisée concernant une
  personne.
- Nécessité et minimisation déjà en place :
  - transmission limitée au strict nécessaire (entêtes plus 3 exemples ;
    faits agrégés) ;
  - l'IA ne produit **aucun chiffre** : chaque nombre d'une réponse est
    vérifié contre les résultats du moteur, sinon la réponse est rejetée ;
  - les fonctions peuvent être utilisées sans IA (import strict, modèle de
    note sans IA).

### 4. Destinataire et cadre juridique de l'État de destination

- Destinataire : Anthropic, PBC (États-Unis), par l'API commerciale.
  - Conditions applicables : Commercial Terms of Service et Data Processing
    Addendum d'Anthropic. *[Versions en vigueur à lire et à joindre :
    anthropic.com/legal.]*
  - Points à vérifier dans ces conditions :
    - utilisation ou non des données de l'API pour entraîner les modèles ;
    - durée de conservation des entrées et sorties, et possibilité de
      conservation nulle ;
    - lieu de traitement ;
    - sous-traitants ultérieurs ;
    - avis en cas d'incident ;
    - mécanisme de suppression.
- Cadre juridique des États-Unis à apprécier par le juriste :
  - absence de loi fédérale générale équivalente à la Loi 25 ;
  - possibilités d'accès gouvernemental (par exemple CLOUD Act, FISA
    section 702) ;
  - recours disponibles pour les personnes concernées.

  *[Analyse à compléter.]*
- Principes généralement reconnus : la loi québécoise exige que les
  renseignements bénéficient d'une **protection adéquate**, notamment au
  regard de ces principes. *[Formulation exacte à vérifier.]*

### 5. Mesures de protection

**En place dans le logiciel** (vérifiables dans le code, `SECURITY.md`) :

1. Fonctions désactivées par défaut ; activation par organisation, par un
   administrateur.
2. Clé d'API conservée côté serveur seulement (secret de la fonction), jamais
   dans le navigateur.
3. Minimisation : filtrage des colonnes personnelles à l'import, faits
   agrégés pour la note au conseil.
4. Quotas par organisation (jour et mois) et limite de débit par utilisateur.
5. Journal d'usage limité au **nombre de jetons**. Le contenu des requêtes
   n'est pas journalisé par H2Fleet.
6. Historique du copilote conservé dans le projet du client ; effaçable par
   son auteur ou un administrateur.
7. Transport chiffré (HTTPS) ; accès cloisonné par organisation (sécurité par
   ligne dans la base).
8. Interrupteur général de l'IA, côté serveur, pour couper tout envoi
   immédiatement.

**Contractuelles, à obtenir ou à vérifier** :

- engagement du fournisseur sur la non-utilisation pour l'entraînement ;
- durée de conservation et suppression ;
- confidentialité et sécurité ;
- avis d'incident ;
- sous-traitance ultérieure.

*[Joindre le DPA signé ou accepté.]*

**Organisationnelles, à mettre en place** :

- informer les utilisateurs avant la première utilisation : bandeau
  « ne saisissez pas de renseignements personnels dans vos questions » ;
- tenir un registre des activations ;
- réviser cette EFVP lors de tout changement de fournisseur, de fonction ou de
  conditions.

### 6. Risques résiduels et appréciation

| Risque | Probabilité | Gravité | Mesure | Risque résiduel |
|---|---|---|---|---|
| Un utilisateur saisit un renseignement personnel dans une question | [moyenne] | [faible] | Avertissement, quotas, conservation limitée chez le fournisseur | [faible] |
| Facture contenant des renseignements de facturation | [moyenne] | [faible] | Pièce dans le stockage privé ; valeurs extraites sans ces champs | [faible] |
| Accès par une autorité étrangère | [faible] | [modérée] | Minimisation, conditions contractuelles | [à apprécier] |
| Incident chez le fournisseur | [faible] | [modérée] | Avis contractuel, registre des incidents | [à apprécier] |

### 7. Conclusion et décision

- La protection est-elle **adéquate** au sens de la loi ? ☐ Oui ☐ Oui, sous
  conditions : […] ☐ Non
- Décision : ☐ Activation autorisée pour [fonctions] ☐ Refusée
- Conditions d'activation : [p. ex. DPA accepté, bandeau d'avertissement
  affiché, révision annuelle]
- Prochaine révision : [date]

| Signature — Personne responsable | Date |
|---|---|
| | |

---
*BROUILLON À FAIRE VALIDER PAR UN JURISTE.*

# Phase 6 — Orientation vers les bailleurs et espace bailleur (livrée le 2026-10-26, en attente du feu vert)

## Livré

- **Orientation calculée à la qualification** (`packages/domain/src/routing`) :
  chaque bailleur actif est comparé au dossier (montant, durée, secteur,
  équipement, indice minimum) ; les exclus gardent leurs motifs, les
  éligibles sont présentés dans un **ordre neutre** (rotation propre à
  chaque dossier, jamais un classement). Décision immuable : profil et
  critères figés au moment du calcul. Visible par l'équipe dans la revue
  (carte « Orientation vers les bailleurs », motifs d'exclusion).
- **Choix par l'entreprise, bailleur par bailleur** : 3 à 5 bailleurs au plus
  (4 par défaut), tous décochables ; **consentement de transmission
  versionné** (fr/en/ar) qui **nomme les bailleurs choisis**
  (`kyc.consent_recipients`) ; donné par le gérant seulement. Rien n'est
  visible d'un bailleur avant ce consentement.
- **Espace bailleur** :
  - boîte de réception triée par délai restant (72 h), vues « à traiter /
    répondus / tous », indicateurs ;
  - fiche dossier : synthèse validée, indice et facteurs, contrôles, pièces
    du coffre-fort et devis de la demande — **chaque téléchargement est un
    PDF filigrané** au nom du bailleur, avec date et heure (images converties ;
    un document non filigranable n'est pas servi) ;
  - **offre** : montant, taux, durée, périodicité, terme à échoir ou échu,
    premier loyer, valeur résiduelle, frais, assurance, validité et
    conditions ; loyer, coût du financement et TEG **calculés en direct et
    recalculés par le serveur** avec le moteur de la phase 2 ; retrait
    possible ;
  - **refus motivé** (7 motifs, précision obligatoire pour « autre ») ;
  - critères d'appétit (administrateur bailleur seulement, versionnés et
    audités) ; tableau de bord (reçus, taux de réponse, délai moyen, en
    retard).
- **Notifications** (boîte de démonstration) : nouveau dossier aux membres
  du bailleur, offre reçue au gérant ; aucun contenu du dossier dans le
  courriel.
- Démonstration : 5 bailleurs fictifs avec des appétits différents (Cèdre,
  Argane, Oasis, Médina, Sahel).
- Tests : domaine 172 (100 %), base 68 (transitions SQL ≡ machine d'états,
  consentement nominatif, isolation entre bailleurs, une seule offre vivante
  par cible, immuabilité), web 52 (dont filigrane vérifié dans le PDF),
  **48 e2e** (orientation et motifs d'exclusion, choix et consentement,
  boîte de réception et délai, pièce filigranée, offre invalide puis valide,
  refus motivé, retrait, bailleur non choisi qui ne voit rien, critères en
  lecture seule pour un analyste, accessibilité).

## Tables (à valider — aucune base hébergée : réécriture possible)

| Table                       | Contenu                                                                                                                        | Règles                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `credit.lessor_appetites`   | une ligne par bailleur : actif, montants min/max, durées min/max, secteurs, équipements (vide = tous), indice minimum, version | lecture par le bailleur et la plateforme ; écriture par l'administrateur du bailleur ; audité                                          |
| `credit.routing_decisions`  | indice, nombre maximal de bailleurs, profil et critères figés, auteur, date                                                    | plateforme ; immuable                                                                                                                  |
| `credit.routing_targets`    | un bailleur par décision : statut (éligible, exclu, envoyé, consulté, offre, décliné), motifs, rang, proposé, échéance 72 h    | transitions ≡ machine d'états ; l'envoi exige le gérant et un consentement qui nomme le bailleur ; l'entreprise ne voit pas les exclus |
| `credit.target_declines`    | motif structuré, précision, auteur, date                                                                                       | bailleur destinataire ; immuable                                                                                                       |
| `kyc.consent_recipients`    | consentement de transmission → bailleurs nommés                                                                                | entreprise ; immuable                                                                                                                  |
| `market.offers`             | conditions saisies + résultats du moteur (loyer, premier loyer, coût, TTC payé, TEG, TVA), validité, conditions, retrait       | bailleur destinataire, cible reçue ou consultée ; une seule offre vivante par cible ; seul le retrait est permis ensuite               |
| `credit.financing_requests` | statut `routed` (transmise)                                                                                                    | exige au moins une cible envoyée                                                                                                       |
| `legal.legal_texts`         | type `consent_routing` (fr/en/ar, version 2026-10-26)                                                                          | texte à faire valider par l'avocat                                                                                                     |

Visibilité côté bailleur (RLS) : une demande, l'entreprise, ses pièces,
l'indice, la note **validée** et les contrôles ne sont lisibles que si le
bailleur est une cible **envoyée** et nommée dans un consentement actif.

## À tester manuellement

1. `/demo` → compte opérations → Revue des dossiers → dossier Atlas →
   analyser, rédiger et valider la note, qualifier → carte « Orientation ».
2. Compte entreprise → la demande → choisir les bailleurs, lire le texte,
   consentir, transmettre.
3. Compte bailleur (Cèdre) → Boîte de réception → ouvrir → télécharger une
   pièce (filigrane) → saisir une offre (essayer un taux de 45 %) → envoyer.
4. Compte bailleur (Argane) → décliner avec « Autre motif ».
5. Retour au compte entreprise : statuts et offre reçue ; `/demo/boite-mail`
   pour les courriels.
6. Critères d'appétit : modifier avec Cèdre (administrateur), constater la
   lecture seule avec Argane (analyste).

## Dette technique

- Pas de critère **régional** (villes ou régions couvertes) : à ajouter si
  les bailleurs le demandent.
- Pas d'écran pour **retirer le consentement** (le modèle le permet :
  `revoked_at` coupe l'accès) ; pas de nouvelle orientation après refus de
  tous les bailleurs.
- **Relances et échéances** non automatisées : rappel avant 72 h, offre
  expirée — à brancher avec la file de tâches (phase 9).
- Comparateur, acceptation, messagerie : phase 7. Commissions et
  facturation : phase 8 (indicateurs « — » au tableau de bord).
- Courriels : boîte de démonstration seulement (pas de fournisseur réel).
- Filigrane : polices standard (latin) — un nom en arabe est translittéré
  ou remplacé par « ? » ; police arabe à intégrer si besoin.
- Le nombre maximal de bailleurs (4) n'est pas encore réglable dans le
  back-office.

## Questions ouvertes

1. Texte du consentement de transmission : à faire valider par l'avocat
   (portée, retrait, durée de conservation chez le bailleur).
2. Délai de réponse : 72 h calendaires ou ouvrées ? Que se passe-t-il en
   cas de retard répété (alerte, déclassement) ?
3. Faut-il montrer à l'entreprise **le motif** d'un refus ? (aujourd'hui :
   non, seulement « ne donne pas suite » ; la précision reste interne).
4. Une offre peut-elle financer plus que le montant demandé ? (aujourd'hui :
   jusqu'à 120 %).
5. Critère régional et critère d'ancienneté minimale de l'entreprise :
   utiles pour les bailleurs ?

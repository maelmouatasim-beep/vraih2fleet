# Phase 7 — Comparateur, acceptation, opérations, messagerie, notifications (livrée le 2026-10-26, en attente du feu vert)

## Livré

- **Comparateur** `/entreprise/demandes/[id]/offres` :
  - cartes ou tableau ;
  - classement **neutre** par coût total (tri possible par TEG, loyer ou premier loyer), jamais de position sponsorisée ;
  - badge « meilleur coût total » ;
  - détail dépliable (montant financé, valeur résiduelle, frais, assurance, terme, taux nominal, total TTC, TVA, conditions, rappel de déductibilité) ;
  - offres expirées ou non retenues signalées ;
  - **simulation** d'un autre apport ou d'une autre durée, au taux et aux frais de chaque offre, présentée comme une estimation.
- **Acceptation** par le dirigeant, avec une confirmation explicite : accord de principe, la décision de crédit reste au bailleur. Les autres offres passent en « non retenue » ; la demande passe en « offre acceptée ».
- **Opération** (`market.deals`) :
  - le bailleur constate la signature, la livraison et la mise en loyer, chacune à sa date (jamais dans le futur, jamais avant l'étape précédente) ;
  - le montant financé définitif est saisi à la mise en loyer ; la demande devient « financée ».
- **Annulation motivée** :
  - par l'entreprise avant la signature, par le bailleur jusqu'à la livraison ;
  - la demande revient aux offres restantes, qui redeviennent disponibles.
- **Suivi « type colis »** de la demande : déposée → vérifiée → transmise → offres → acceptée → signée → livrée → mise en loyer.
- **Pipeline bailleur** `/bailleur/pipeline` : opérations en cours, mises en loyer, annulées, avec les montants. Le tableau de bord affiche le **taux de gain** (offres acceptées / offres tranchées).
- **Messagerie** :
  - un fil par demande et par bailleur destinataire, ouvert à la transmission ;
  - messages immuables, non-lus par fil, badge dans la boîte de réception du bailleur ;
  - page `/entreprise/messages`, questions-réponses sur la fiche du bailleur ;
  - **coordonnées signalées** (téléphone, e-mail, lien) tant qu'aucune offre de ce bailleur n'est acceptée : avertissement à la saisie, signalement enregistré, jamais de blocage ;
  - pas de rafale de notifications (une seule si le même auteur écrit plusieurs fois en 30 minutes).
- **Notifications** :
  - cloche avec le nombre de non-lues, page « Notifications » ;
  - clic → écran concerné, marquée lue ;
  - préférences par utilisateur : e-mail (par défaut), **SMS et WhatsApp** pour les étapes importantes, sur un mobile marocain validé (06 / 07) ;
  - 13 types (compléments demandés, dossier vérifié, nouvelle offre, message, étapes de l'opération, annulations, nouveau dossier, offre acceptée ou non retenue) ;
  - courriels et SMS sans aucun chiffre du dossier.
- **Intégrations** : abstraction `TextSender` (SMS / WhatsApp) avec suite de contrat, à côté de `EmailSender`. La boîte de démonstration affiche les trois canaux.
- **Démonstration** : Atlas a trois offres à comparer (Oasis, Cèdre, Sahel) avec un échange de questions-réponses, et une opération signée chez Cèdre (pipeline).
- **Corrigé au passage (phase 5)** : la file de revue affichait toujours « — » à la place de l'indice. Une colonne interpolée dans une sous-requête SQL désignait la mauvaise table. La file affiche désormais l'indice retenu, correction humaine comprise ; un e2e le vérifie.
- **Tests** :

  | Suite        | Nombre      | Contenu                                                                                                                                                                                 |
  | ------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Domaine      | 191 (100 %) |                                                                                                                                                                                         |
  | Base         | 84          | listes et transitions SQL ≡ domaine, acceptation par le seul dirigeant, effets croisés, dates, annulations, cloisonnement des opérations et des fils, notifications et préférences      |
  | Intégrations | 60          |                                                                                                                                                                                         |
  | Web          | 63          |                                                                                                                                                                                         |
  | E2E          | 54          | comparer, accepter et suivre jusqu'à la mise en loyer ; annulation puis nouvelle acceptation ; questions-réponses et non-lus ; SMS ; pipeline cloisonné ; démonstration ; accessibilité |

## Tables (à valider — aucune base hébergée : réécriture possible)

| Table                                 | Contenu                                                                                                                                                                                                                       | Règles                                                                                                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `market.deals`                        | demande, offre (unique), entreprise, bailleur, statut, produit (`lease`, extension `ijara`), devise (`MAD`), montant financé, dates d'acceptation, signature, livraison, mise en loyer, annulation (partie, motif, précision) | création = acceptation par le dirigeant (offre active et valable, demande transmise) ; une seule opération en cours par demande ; étapes par le bailleur (admin, analyste) ; l'entreprise annule avant signature ; jamais supprimée |
| `market.deal_events`                  | historique : de, vers, date de l'étape, acteur, motif                                                                                                                                                                         | écrit par la base ; immuable                                                                                                                                                                                                        |
| `market.threads`                      | un fil par demande et par bailleur, dernier message                                                                                                                                                                           | lisible par l'entreprise, ce bailleur (consentement actif) et la plateforme ; ouvert seulement pour un bailleur destinataire                                                                                                        |
| `market.messages`                     | auteur, organisation, texte (1 à 4 000 caractères), coordonnées signalées                                                                                                                                                     | rôle vérifié selon la partie (lecteur bailleur : lecture seule) ; immuable                                                                                                                                                          |
| `market.thread_reads`                 | dernière lecture par utilisateur et par fil                                                                                                                                                                                   | chacun les siennes                                                                                                                                                                                                                  |
| `identity.notifications`              | destinataire, type, paramètres (référence, nom du bailleur), écran, lue le                                                                                                                                                    | écrites par le serveur (rôle d'authentification) ; lues et marquées lues par le destinataire seul ; supprimées avec lui                                                                                                             |
| `identity.notification_preferences`   | e-mail, SMS, WhatsApp, mobile (E.164)                                                                                                                                                                                         | chacun les siennes ; SMS ou WhatsApp exigent un mobile marocain                                                                                                                                                                     |
| `market.offers` (statuts)             | `accepted`, `not_retained` en plus de `submitted`, `withdrawn`                                                                                                                                                                | transitions déduites de l'état de l'opération, jamais de l'appelant                                                                                                                                                                 |
| `credit.financing_requests` (statuts) | `accepted`, `financed`                                                                                                                                                                                                        | idem                                                                                                                                                                                                                                |
| `dev.outbox`                          | colonne `channel` (email, sms, whatsapp)                                                                                                                                                                                      | démonstration seulement                                                                                                                                                                                                             |

## À tester manuellement

1. `/demo` → compte entreprise (Atlas) → Demandes → « Deux semi-remorques… » →
   « Comparer les offres » : tri, tableau, détail, simulation (durée 72 mois,
   apport 200 000).
2. Accepter l'offre d'Oasis (case de confirmation) → la demande affiche
   l'opération et le suivi ; renoncer (« Financé autrement ») → les offres
   reviennent.
3. Messages → fil avec Cèdre : écrire un numéro de téléphone (avertissement),
   envoyer une question.
4. Compte bailleur (Cèdre) → cloche, boîte de réception (badge « message »),
   Pipeline → opération signée → enregistrer la livraison puis la mise en
   loyer ; côté entreprise, la demande passe « Financée ».
5. Notifications → préférences : SMS avec un mobile 06 / 07, puis
   `/demo/boite-mail` (canal SMS).

## Dette technique

- **Fournisseurs réels** de courriel, SMS et WhatsApp non branchés (boîte de
  démonstration) ; WhatsApp Business exige des modèles de messages validés.
- **Signature électronique** (loi 43-20) non intégrée : le bailleur constate
  la signature à sa date ; l'abstraction attend le choix du prestataire.
- Pas de **temps réel** (messages et cloche rafraîchis à la navigation) ; pas
  de pièce jointe dans la messagerie.
- **Relances** (offre qui expire, délai de 72 h, opération sans nouvelle) :
  file de tâches de la phase 9.
- Signalements de coordonnées enregistrés mais pas encore présentés à
  l'équipe (back-office de la phase 8).
- Une offre non retenue redevenue disponible après annulation n'entraîne pas
  de notification au bailleur concerné.
- Données de démonstration écrites triggers désactivés (seed) ; les offres
  d'Oasis et de Sahel sont attribuées au compte de démonstration de Cèdre
  (ces bailleurs n'ont pas de compte).
- Commissions dues à la mise en loyer : phase 8 (le montant définitif est
  déjà enregistré).
- PostHog (entonnoir jusqu'à « financée ») : phase 9.

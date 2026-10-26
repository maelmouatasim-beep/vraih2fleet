# ADR 0014 — Acceptation, opérations, messagerie et notifications

Statut : accepté (2026-10-26)

## Contexte

Une offre acceptée lance une opération chez un bailleur : la plateforme ne
décide de rien, mais elle doit refléter fidèlement l'état (offres, demande,
historique) pour les deux parties et pour la facturation à la mise en loyer
(phase 8). Entreprise et bailleur doivent pouvoir échanger sans contourner la
plateforme avant l'accord, et être prévenus des étapes sur le canal de leur
choix.

## Décisions

- **Une opération par offre acceptée** (`market.deals`), une seule en cours
  par demande (index unique partiel). Créée par le dirigeant ; la base copie
  bailleur, entreprise et montant depuis l'offre et la demande, jamais depuis
  l'appelant.
- **Effets croisés par trigger, autorisés par l'état** : l'acceptation met les
  autres offres de côté et fait passer la demande en « offre acceptée » ; la
  mise en loyer la fait passer en « financée » ; l'annulation la rouvre et
  rend les offres disponibles. Les gardes des offres et des demandes
  acceptent ces transitions seulement si l'état de l'opération les justifie
  (opération acceptée, active, ou plus aucune en cours). Un utilisateur ne
  peut pas les provoquer directement : il n'a pas de droit d'écriture sur la
  table concernée.
- **Étapes datées** (signature, livraison, mise en loyer) : constatées par le
  bailleur à une date passée, ordonnée ; chaque date ne se pose qu'à son
  étape ; montant définitif à la mise en loyer. Historique immuable
  (`deal_events`).
- **Messagerie** : un fil par demande et par bailleur destinataire, visible
  des deux parties et de la plateforme ; messages immuables ; coordonnées
  **signalées, jamais bloquées** avant l'acceptation (le mandat porte la
  clause anti-contournement ; un blocage automatique produirait des faux
  positifs).
- **Notifications** : toujours dans l'application ; e-mail par défaut ; SMS
  et WhatsApp pour les étapes importantes, sur opt-in et mobile marocain
  validé. Écrites après la transaction métier par le rôle d'authentification
  (seul à lire les adresses), lues sous RLS par leur destinataire. Textes sans
  aucun chiffre du dossier ; référence et nom du bailleur seulement.
- **Canaux derrière des interfaces** (`EmailSender`, `TextSender`) avec suite
  de contrat ; boîte de démonstration tant qu'aucun fournisseur n'est choisi.
- **Simulation** du comparateur : même moteur que les offres, au taux et aux
  frais de chaque bailleur ; présentée comme une estimation, jamais comme une
  offre.

## Conséquences

- La facturation (phase 8) pourra s'appuyer sur `activated_on` et le montant
  définitif.
- Les extensions `product = 'ijara'` et `currency` existent déjà sur
  l'opération.
- Changer de fournisseur de messages ne touche que `packages/integrations`.

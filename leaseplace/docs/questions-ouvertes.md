# Questions ouvertes — à trancher à la fin du premier jet

Registre unique : chaque phase y ajoute ses questions au lieu d'attendre une
réponse. Pour chaque point, le choix provisoire retenu dans le code est
indiqué ; rien n'est irréversible tant qu'aucune base n'est hébergée.

## Phase 1 — Fondations

1. Hébergement de prévisualisation (Vercel ?) et projet Postgres UE : à créer
   par vous ; seuls les noms de variables passent par le chat.
2. Comptes Sentry et PostHog (régions UE) : maintenant ou en phase 9 ?
3. Fournisseur d'envoi de courriels (Resend ?) : domaine d'envoi à choisir
   avec le nom de marque définitif.

## Phase 2 — Moteur financier

1. Convention de taux des bailleurs marocains : proportionnelle (retenue) ou
   actuarielle ?
2. Le premier loyer majoré est-il payé à la signature même en terme échu ?
   (retenu : il suit le terme choisi)
3. Définition légale du TEG à afficher pour le crédit-bail.
4. Taux par défaut du simulateur (8 %, hypothèse) et taux d'IS (20 %) : à
   remplacer par des valeurs validées.

## Phase 3 — Site public

1. Pages secteurs et FAQ : relecture par l'associé (vocabulaire bancaire) et
   l'avocat (mentions loi 103-12 / 09-08).
2. Publier la grille de commission sur la page bailleurs ? (retenu : non,
   « selon la grille de votre mandat »).

## Phase 4 — Espace entreprise

1. Liste des pièces exigées et durées de validité : conformes aux exigences
   des bailleurs partenaires ?
2. Seul le dirigeant consent et soumet : faut-il permettre à un collaborateur
   mandaté de le faire ?
3. Texte du consentement de traitement (version 2026-10-22) : relecture par
   l'avocat (loi 09-08, déclaration CNDP).
4. L'équipe plateforme lit les pièces pour la vérification : à mentionner dans
   la politique de confidentialité.

## Phase 5 — Revue assistée par l'IA

1. Grille de l'indice : seuils, poids, tables sectorielles et de revente — à
   revoir avec l'associé et un bailleur.
2. Montrer l'indice à l'entreprise ? (retenu : non).
3. Fournisseur d'IA : API Claude directe (États-Unis) ou région UE d'un
   hébergeur cloud ? Dépend de l'avocat et de la CNDP.
4. Note de synthèse en français seulement, ou aussi en arabe selon le
   bailleur ?

## Phase 6 — Orientation et espace bailleur

1. Texte du consentement de transmission : validation par l'avocat (portée,
   retrait, durée de conservation chez le bailleur).
2. Délai de réponse : 72 h calendaires (retenu) ou ouvrées ? Conséquence d'un
   retard répété (alerte, déclassement) ?
3. Montrer à l'entreprise le motif d'un refus ? (retenu : non, seulement
   « ne donne pas suite »).
4. Une offre peut-elle financer plus que le montant demandé ? (retenu :
   jusqu'à 120 %).
5. Critère régional et ancienneté minimale de l'entreprise dans les critères
   d'appétit ?

## Phase 7 — Comparateur, opérations, messagerie, notifications

1. Fournisseurs : courriels (Resend ?), SMS (agrégateur marocain ?), WhatsApp
   Business (modèles à faire valider par Meta) — et coût par message.
2. Prestataire de signature électronique agréé (loi 43-20) : la signature est
   aujourd'hui constatée par le bailleur à sa date.
3. Acceptation par l'entreprise = « accord de principe » (retenu) : le
   bailleur peut encore annuler (refus de crédit définitif). Formulation à
   valider avec l'avocat et les bailleurs.
4. Coordonnées dans les messages avant acceptation : signalées sans blocage
   (retenu). Faut-il masquer automatiquement, ou laisser l'équipe arbitrer ?
5. Annulation par l'entreprise : possible jusqu'à la signature seulement
   (retenu) ; un délai de rétractation ou des frais sont-ils prévus par les
   bailleurs ?
6. Taux de gain du bailleur : offres acceptées / offres tranchées (retenu) ;
   faut-il compter les offres expirées comme perdues ?
7. Le classement par défaut sur le coût total HT (retenu, cf. prompt) ne
   compare pas des durées différentes : afficher aussi un coût mensualisé ?

## Phase 8 — Mandats, commissions, facturation

1. Grille de commission : tranches marginales (retenu) ou taux unique selon
   le palier atteint ? Seuils et taux par défaut (1,5 % jusqu'à 500 k DH,
   1,2 %, 0,9 %, 0,6 %, 0,4 % au-delà de 5 M DH) à valider avec l'associé.
2. Durée de la clause anti-contournement (retenu : 24 mois par défaut,
   6 à 36) et point de départ.
3. Facturation : une facture par mise en loyer (retenu) ou un relevé
   mensuel ? Délai de paiement (retenu : 30 jours) ; pénalités de retard ?
4. Identité juridique, ICE, RC, IF et adresse de l'entité qui facture ;
   mentions obligatoires d'une facture au Maroc (expert-comptable).
5. TVA sur la commission : 20 % (retenu) — confirmer le régime.
6. Commission due si l'opération est dénouée après la mise en loyer
   (avoir aujourd'hui manuel) ?
7. Accès « en tant que » pour le support : à ouvrir (tracé) ou non ?
   → ouvert en phase 9, en lecture seule (voir phase 9, question 4).

## Phase 9 — Durcissement

1. Délai de réponse à une demande d'effacement : 30 jours (retenu) ;
   périmètre effacé ou conservé (ADR 0016) à valider par l'avocat,
   notamment la conservation des messages et des consentements.
2. Durées de conservation par défaut (brouillons 180 j, demandes de contact
   1 an, notifications lues 180 j, pièces supprimées 30 j) : à valider ; et
   combien de temps garder les pièces KYC d'une entreprise inactive ?
3. Rectification : l'entreprise modifie elle-même son profil et ses pièces ;
   faut-il un formulaire de demande de rectification pour le reste ?
4. Accès support : informer le client à chaque ouverture (notification,
   courriel) ? Exiger son accord préalable ? (retenu : ni l'un ni l'autre,
   bandeau et journal seulement).
5. PostHog : compte UE à créer (`POSTHOG_KEY`) ; transfert hors du Maroc
   soumis à autorisation CNDP ; bandeau de consentement aux mesures
   d'audience nécessaire ou non (retenu : aucun cookie, Do Not Track et
   GPC respectés) ?
6. Sauvegardes : fréquence (quotidienne retenue), rétention (35 j),
   objectifs RPO 24 h et RTO 4 h, région de stockage ; service géré de
   l'hébergeur ou scripts fournis ?
7. Test d'intrusion externe avant l'ouverture : prestataire et budget.
8. Antivirus réel, coffre de clés, supervision (Sentry) : à choisir avec
   l'hébergeur.
9. Modèle d'IA : identifiant à fixer en exploitation (`LP_AI_MODEL`), plus
   aucune valeur par défaut dans le code.
10. Bailleurs fictifs de démonstration ajoutés (Zellige Leasing,
    Tafilalet Crédit-Bail) : noms à garder ou changer pour les
    présentations ?

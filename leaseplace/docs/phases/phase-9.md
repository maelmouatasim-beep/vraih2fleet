# Phase 9 — Durcissement (livrée le 2026-10-26)

## Livré

- **Audit de sécurité ASVS niveau 2** (`docs/securite/audit-asvs-l2.md`) :
  état de chaque chapitre, preuves, risques résiduels.
- **Tests de pénétration de base** (`e2e/security.spec.ts`, 11 essais) :
  - en-têtes de sécurité, routes protégées sans session, paramètres hostiles ;
  - IDOR entre entreprises, entre bailleurs (dossier, facture), lien de pièce forgé ;
  - cookie de session, connexion et action serveur rejouées depuis une autre origine (CSRF) ;
  - XSS stockée dans la messagerie, redirection ouverte après connexion ;
  - garde-fous de la route d'analyse.
- **Garde-fous de base transverses** : RLS sur toutes les tables, aucun
  privilège `PUBLIC`, `search_path` figé sur les 30 fonctions
  `SECURITY DEFINER`, rôles applicatifs sans contournement de la RLS.
- **Droits des personnes (loi 09-08)** — ADR 0016 :
  - export JSON immédiat par le dirigeant (profil, demandes, consentements, offres, opérations, messages, journal de ses actions) ;
  - demande d'effacement, exécutée par un administrateur (`/admin/confidentialite`), bloquée tant qu'un dossier ou une opération est en cours ;
  - effacement : comptes anonymisés et fermés, pièces, extractions, notes et appels IA supprimés ; consentements, opérations, factures et journal conservés (pseudonymes).
- **Conservation réglable** (6 règles, bornes du domaine ≡ base) et purge
  quotidienne `pnpm retention:run` (aussi lancée en CI) ; fichiers des
  pièces supprimées effacés du stockage.
- **Accès support tracé** — ADR 0017 :
  - lecture seule garantie par Postgres (`SET TRANSACTION READ ONLY`) ;
  - motif obligatoire, 30 minutes, bandeau permanent ;
  - aucune pièce, facture ni export téléchargeable ;
  - début et fin au journal d'audit.
- **Analytics PostHog** — ADR 0018 :
  - catalogue `objet_action` fermé (11 événements, propriétés sans donnée personnelle) ;
  - adaptateur PostHog (UE, sans profil ni IP) ou mémoire ;
  - entonnoir émis côté serveur sous pseudonyme (HMAC) ;
  - visites et simulateur via une route même origine (Do Not Track et GPC respectés, débit limité).
- **Mode démo en volume** : 7 bailleurs (2 nouveaux, fictifs), 30 PME,
  80 demandes sur tout le parcours (brouillons, revue, compléments,
  qualifiées, transmises avec 0 à 4 offres, refus motivés, acceptées,
  signées, livrées, mises en loyer avec commission due, facturée ou payée,
  abandons) ; tirages déterministes.
- **Accessibilité** (`e2e/a11y.spec.ts`) : toutes les pages des quatre
  espaces, en français et en arabe (RTL), sans violation grave (axe, WCAG
  2.2 AA) ; aucune page ne défile horizontalement sur mobile.
- **Performance** :
  - pages connectées en 150 à 320 ms avec le volume de démonstration ;
  - Lighthouse mobile des pages publiques : performance 91 à 98, accessibilité, bonnes pratiques et SEO à 100 (LCP simulé 2,3 à 3,2 s, limite connue, ADR 0010).
- **Sauvegardes** — ADR 0019 : scripts chiffrés de sauvegarde, restauration
  et vérification ; cycle complet exécuté à chaque CI.
- **Tests** :
  - domaine 222 (100 %) : droits 09-08, conservation, accès support, catalogue d'événements ;
  - base 114 : domaine ≡ SQL (statuts, transitions, règles de conservation), effacement, purge, mode effacement inaccessible, accès support, lecture seule, garde-fous transverses ;
  - intégrations 72 (contrat de l'adaptateur d'analyse), IA 33, web 66 ;
  - **e2e 75** : droits 09-08, conservation, accès support, 11 essais de pénétration, balayage d'accessibilité de toutes les pages en fr et ar.
- **Corrections trouvées par le durcissement** :
  - pages secteur en arabe et en anglais en erreur 500 (génération statique incompatible avec le nonce CSP) ;
  - texte réservé aux lecteurs d'écran débordant des tableaux sur mobile ;
  - liste sémantiquement invalide ;
  - retards affichés en heures au-delà de 48 h (désormais en jours) ;
  - vue d'ensemble limitée aux 12 dernières organisations ;
  - identifiant du modèle d'IA codé en dur, devenu un réglage obligatoire (`LP_AI_MODEL`).

## Tables (à valider — aucune base hébergée)

| Table                        | Contenu                                                               | Règles                                                                                           |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `privacy.requests`           | entreprise, statut, note, demandeur, échéance (30 j), décision, bilan | déposée par le titulaire ; transitions ≡ domaine ; « effacée » par la fonction seule ; conservée |
| `privacy.retention_settings` | règle, durée en jours, auteur                                         | administrateurs ; bornes par CHECK ≡ domaine                                                     |
| `privacy.impersonations`     | agent, session, compte et organisation cibles, motif, début, fin      | support et administrateurs ; durée posée par la base ; seule la fin s'enregistre ; conservée     |
| `kyc.documents.purged_at`    | date d'effacement du fichier chiffré                                  | posée par la purge ou l'effacement seulement                                                     |

## À tester manuellement

1. Compte entreprise (Salma) → Profil → « Télécharger mes données » ;
   demander l'effacement (message d'obstacle : dossiers en cours).
2. Compte administration → Confidentialité : la demande, bloquée ;
   modifier une durée (essayer hors bornes), lancer la purge.
3. Administration → Utilisateurs → « Accès support » sur Salma (motif
   court refusé), parcourir son espace, essayer d'ouvrir une pièce,
   terminer l'accès, voir le journal.
4. Vue d'ensemble, boîte de réception de Cèdre, pipeline : le volume de
   démonstration.
5. Site public en arabe : pages secteur.

## Dette technique

- Antivirus réel, coffre de clés et rotation, Sentry, TLS vers Postgres :
  à l'hébergement.
- Chiffrement des sauvegardes non authentifié (empreinte à côté) : passer
  à `age` ou au service de l'hébergeur.
- Pas de limitation de débit propre aux actions authentifiées ni de
  verrouillage progressif des comptes.
- L'entonnoir analytique est relevé par organisation après connexion et
  par onglet avant : pas de raccord visite → compte.
- Événements analytiques émis avant la validation de la transaction dans
  quelques actions (rare écart possible en cas d'échec tardif).
- Accès support : pas de notification au client.
- Lighthouse : LCP simulé au-dessus de 2 s sur les pages publiques (poids
  du flux RSC et de la CSS intégrée).

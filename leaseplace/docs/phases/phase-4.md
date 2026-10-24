# Phase 4 — Espace entreprise (livrée le 2026-10-24, en attente du feu vert)

## Livré

- **Inscription PME par code e-mail** : le code à 6 chiffres crée le compte
  à la première vérification (le lien magique reste réservé aux comptes
  existants ; bailleurs et équipe : mot de passe + 2FA, inchangé), puis
  **onboarding** `/bienvenue` : raison sociale, ICE (15 chiffres, unique),
  forme juridique, secteur, ville, date de création, tranches de CA et
  d'effectif. `kyc.create_company` crée en une transaction l'organisation,
  l'adhésion « dirigeant » et le profil.
- **Coffre-fort** `/entreprise/coffre-fort` : pièces exigées calculées par le
  domaine selon la forme juridique et l'ancienneté (bilans après 12 mois,
  prévisionnel avant ; carte pour l'auto-entrepreneur), fraîcheur
  (« à renouveler »), complétude en %, dépôt par pièce, tableau des
  documents, téléchargement par lien signé. Stockage chiffré, analyse
  antivirus, type vérifié par signature binaire : ADR 0011.
- **Assistant de demande** `/entreprise/demandes/{id}` en 5 étapes
  (équipement, financement, documents, consentement, vérification) :
  sauvegarde automatique (700 ms, verrou optimiste : modification depuis un
  autre appareil détectée, jamais écrasée), reprise à la première étape
  incomplète, loyer indicatif calculé par le moteur financier, devis joint,
  navigation collée en bas d'écran sur mobile.
- **Consentement 09-08 versionné et horodaté** : texte légal en base
  (fr/ar/en, empreinte SHA-256 vérifiée), accord lié à la demande, à la
  version du texte, à l'IP et au navigateur ; donné par le dirigeant seul.
- **Soumission** : la base refuse toute soumission sans consentement actif ;
  contenu figé après soumission ; historique visible par le client ;
  annulation possible tant que la demande est soumise.
- Pages `/entreprise` (complétude du dossier, demandes récentes),
  `/entreprise/demandes`, `/entreprise/profil` (dirigeant : modification ;
  collaborateur : lecture). Menu : Accueil, Demandes, Coffre-fort, Profil.
- Zones de tableau défilantes atteignables au clavier (`TableScroll`,
  corrige aussi le journal d'audit).
- Tests : 89 domaine (100 %), 41 base (dont RLS et transitions SQL ≡
  machine à états du domaine), 45 intégrations (contrat de stockage,
  chiffrement, scanner), 48 web, **40 e2e** dont le parcours complet
  inscription → onboarding → coffre-fort → fichier EICAR bloqué → demande →
  soumission → historique, le cloisonnement des téléchargements entre
  entreprises (403 signature, 404 RLS, 401 sans session) et l'accessibilité
  (axe, WCAG 2.2 AA) des nouvelles pages, mobile compris.

## Tables (à valider — aucune base hébergée : réécriture possible avant tout déploiement)

Schéma `kyc`

| Table         | Colonnes clés                                                                                                                                                                                                    | Règles                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `companies`   | `organization_id` (PK), raison sociale, nom commercial, `ice` (unique, 15 chiffres), RC + tribunal, IF, CNSS, forme, date de création, secteur, ville, adresse, tranches CA et effectif, `kyc_status`, `version` | lecture : membres + plateforme ; modification : dirigeant ; création par `kyc.create_company` seulement                      |
| `documents`   | type, statut (`clean` / `quarantined` / `rejected`), nom d'origine, MIME, taille, SHA-256, clé de stockage, date de délivrance, résultat d'analyse, déposant, `deleted_at`                                       | lecture : membres + plateforme ; dépôt : membres de l'entreprise (déposant = soi) ; seule modification : suppression logique |
| `legal_texts` | type, version, langue, texte, SHA-256, date de publication                                                                                                                                                       | lecture : tous ; écriture : migrations seulement                                                                             |
| `consents`    | entreprise, demande, finalité (`processing` / `routing` / `marketing`), texte légal, auteur, date, IP, navigateur, retrait (date, auteur)                                                                        | création : dirigeant ; immuable ; un seul retrait ; aucune suppression                                                       |

Schéma `credit`

| Table                | Colonnes clés                                                                                                                                                                                                                                        | Règles                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `financing_requests` | référence `LP-AAAA-NNNNNN` (séquence), statut (`draft` / `submitted` / `cancelled`), produit, équipement (catégorie, description, état, année, fournisseur), montant HT, TVA, premier loyer, durée, valeur résiduelle, périodicité, dates, `version` | transitions imposées par trigger (≡ `requestMachine`), soumission exige un consentement actif, contenu figé hors brouillon |
| `request_documents`  | demande, document, date                                                                                                                                                                                                                              | même entreprise, brouillon seulement                                                                                       |
| `request_events`     | de → vers, acteur, visible du client, métadonnées, date                                                                                                                                                                                              | écrit par trigger à chaque changement de statut ; lecture seule                                                            |

Montants en `numeric(18,2)` ; aucun accès bailleur à ces tables à ce
stade (phase 6 : consentement nominatif bailleur par bailleur).

## À tester manuellement

1. `/connexion` avec une adresse jamais utilisée → code reçu
   (`/demo/boite-mail`) → `/bienvenue` → espace créé.
2. Coffre-fort : déposer les pièces ; un fichier renommé en `.pdf` mais qui
   n'en est pas un est refusé ; le fichier de test EICAR (dans un PDF) est
   bloqué.
3. Ouvrir la même demande dans deux onglets, modifier dans l'un puis dans
   l'autre : bandeau « modifiée ailleurs ».
4. Compte démo Atlas (`/demo`) : demande complète, soumission, historique,
   annulation.
5. Arabe (`/ar/entreprise/...`) et téléphone.

## Dette technique

- **Antivirus de test seulement** (EICAR) : vrai moteur avant toute donnée
  réelle.
- Adaptateur S3/Supabase Storage à écrire au choix de l'hébergeur ;
  sauvegarde des fichiers et rotation de la clé à organiser.
- Liens de téléchargement : 5 min, une page restée ouverte plus longtemps
  doit être rechargée.
- Durées de validité des pièces (RC, attestations fiscale/CNSS 3 mois,
  relevés 2 mois) : **hypothèses** à confirmer avec les bailleurs.
- Retrait du consentement : prévu en base, pas encore d'écran.
- Invitation de collaborateurs et changement de dirigeant : non livrés.
- Champ de fichier natif (« Choose File ») dans la langue du navigateur.

## Questions ouvertes

1. Liste des pièces exigées et durées de validité : correspondent-elles aux
   exigences des bailleurs partenaires ?
2. Seul le dirigeant peut consentir et soumettre : faut-il permettre à un
   collaborateur mandaté de le faire ?
3. Texte du consentement de traitement (version 2026-10-22) : à relire par
   l'avocat (loi 09-08, déclaration CNDP).
4. L'équipe plateforme lit les pièces pour la vérification KYC (phase 5) :
   à mentionner dans la politique de confidentialité.

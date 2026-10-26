# Audit de sécurité — OWASP ASVS 4.0.3, niveau 2 (premier jet, 2026-10-26)

Auto-évaluation de l'équipe de développement, **pas un audit indépendant**.
Elle relève, chapitre par chapitre, ce que le code fait et où le vérifier.
Avant toute donnée réelle : test d'intrusion par un prestataire externe et
revue par l'avocat (CNDP, loi 09-08).

Légende : ✅ conforme et testé · 🟡 partiel ou à confirmer à l'hébergement ·
❌ à faire.

## Synthèse

| Chapitre                     | État | Points clés                                                                                                                                |
| ---------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| V1 Architecture              | ✅   | monolithe modulaire, domaine pur testé à 100 %, règles doublées en base (RLS, triggers), ADR par décision                                  |
| V2 Authentification          | ✅   | 2FA TOTP imposée aux bailleurs et à la plateforme ; PME sans mot de passe (code ou lien, 10 min) ; mots de passe de 12 caractères au moins |
| V3 Sessions                  | ✅   | cookie HttpOnly, SameSite=Lax, Secure en HTTPS ; 7 jours glissants ; révocation à l'effacement                                             |
| V4 Contrôle d'accès          | ✅   | permissions par rôle + RLS sur toutes les tables + tests d'IDOR en e2e                                                                     |
| V5 Validation des entrées    | ✅   | Zod sur chaque action serveur et route ; contraintes CHECK en base ≡ listes du domaine                                                     |
| V6 Cryptographie             | 🟡   | AES-256-GCM des pièces, liens signés HMAC 5 min ; gestion des clés (KMS) à définir avec l'hébergeur                                        |
| V7 Erreurs et journalisation | ✅   | journal d'audit chaîné SHA-256, immuable ; logs structurés sans données personnelles ; erreurs génériques en production                    |
| V8 Protection des données    | ✅   | export, effacement, conservation réglable, accès support en lecture seule ; minimisation vers l'IA                                         |
| V9 Communications            | 🟡   | HSTS préchargeable ; TLS à configurer chez l'hébergeur ; connexion à Postgres en TLS à imposer en production                               |
| V10 Code malveillant         | ✅   | dépendances figées (lockfile, publication de plus de 14 jours), audit `pnpm audit` en CI, aucun script tiers dans le navigateur            |
| V11 Logique métier           | ✅   | machines d'états identiques domaine ≡ SQL, limitation de débit sur l'authentification, les contacts et l'analyse                           |
| V12 Fichiers                 | ✅   | type et taille contrôlés, antivirus (adaptateur), chiffrement au repos, filigrane par bailleur, jamais servis depuis un chemin public      |
| V13 API                      | ✅   | aucune API publique ; routes internes authentifiées, même origine, réponses `no-store`                                                     |
| V14 Configuration            | ✅   | secrets en variables d'environnement validées au démarrage, en-têtes de sécurité, aucun `X-Powered-By`, CSP à nonce                        |

## Détail par chapitre

### V1 — Architecture, conception, modèle de menace

- Domaine pur (`packages/domain`) : finance, scoring, transitions, droits,
  conservation, accès support ; **100 % de couverture** imposée en CI.
- Défense en profondeur : chaque règle d'accès existe deux fois, en
  TypeScript (permissions) et en base (RLS, triggers). Les listes de
  valeurs et les transitions sont vérifiées identiques par des tests
  (`packages/db/src/__tests__`).
- Trois rôles Postgres : propriétaire (migrations), `lp_auth`
  (authentification), `lp_app` (**sans BYPASSRLS**, ne possède aucune
  table — vérifié par test).
- Menaces principales retenues : fuite inter-bailleurs (concurrence), fuite
  vers un bailleur non choisi par l'entreprise, usurpation d'un compte
  bailleur, fraude documentaire, injection de consignes dans les pièces
  envoyées à l'IA, contournement de la commission.

### V2 — Authentification

- Bailleurs et plateforme : mot de passe (12 caractères min.) **+ TOTP
  obligatoire**, enrôlement imposé avant tout accès, désactivation refusée,
  lien magique et code e-mail refusés pour ces comptes
  (`src/lib/auth-policy.ts`, e2e `roles.spec.ts`).
- PME : code à 6 chiffres ou lien magique valables 10 minutes ; aucune
  différence de réponse pour une adresse inconnue (pas d'énumération).
- Limitation de débit persistée en base (`identity.rate_limits`) :
  5 tentatives par minute sur la connexion et la vérification TOTP, 3 envois
  de code ou de lien par minute (e2e « la 6e tentative est refusée »).
- 🟡 Pas de verrouillage progressif au-delà de la limitation par minute ;
  pas de détection d'identifiants compromis (liste HIBP) — à décider.

### V3 — Sessions

- Cookie de session Better-Auth : `HttpOnly`, `SameSite=Lax`, `Secure` en
  HTTPS (e2e `security.spec.ts`) ; durée 7 jours, renouvelée chaque jour.
- Sessions supprimées par l'effacement 09-08 et par la purge des sessions
  expirées (`privacy.apply_retention`).
- 🟡 Pas de liste des sessions actives ni de déconnexion à distance pour
  l'utilisateur.

### V4 — Contrôle d'accès

- RLS activée sur **toutes** les tables applicatives (test transverse) ;
  aucun privilège accordé à `PUBLIC` (test) ; sans contexte, rien n'est
  lisible.
- Cloisonnement prouvé par les tests de base (bailleur A ≠ bailleur B,
  entreprise ≠ entreprise, bailleur non destinataire) et en e2e (IDOR sur
  les demandes, fils, offres, dossiers bailleur, factures, pièces).
- Fonctions `SECURITY DEFINER` : `search_path` figé sur les **30**
  fonctions (test) ; autorisation par l'état de l'entité, jamais par un
  paramètre de l'appelant.
- Accès support : lecture seule garantie par Postgres
  (`SET TRANSACTION READ ONLY`), motif obligatoire, 30 minutes, journalisé
  (ADR 0017).

### V5 — Validation, encodage, injection

- Zod sur chaque action serveur et route (`src/lib/**/actions.ts`,
  `src/app/api/**`) ; identifiants contrôlés (UUID) avant toute requête.
- Requêtes paramétrées uniquement (Drizzle, `sql` étiqueté) ; aucun SQL
  concaténé.
- React échappe tout le texte ; aucun `dangerouslySetInnerHTML` hors JSON-LD
  sérialisé (données statiques). XSS stockée testée sur la messagerie.
- Paramètres hostiles (injection SQL, traversée de chemin, script) : aucune
  erreur 500, aucun reflet (e2e).
- IA : le contenu des pièces est une **donnée**, jamais une consigne ;
  sortie validée par schéma, chaque nombre de la note vérifié contre les
  données sources (ADR 0012).

### V6 — Cryptographie

- Pièces chiffrées au repos en AES-256-GCM (clé `LP_STORAGE_KEY`), liens de
  téléchargement signés HMAC-SHA256 valables 5 minutes et liés à
  l'utilisateur ; filigrane au nom du bailleur à chaque consultation.
- Secrets TOTP chiffrés par Better-Auth ; mots de passe hachés (scrypt).
- Sauvegardes chiffrées (AES-256, PBKDF2 200 000 itérations) avec empreinte
  SHA-256 vérifiée avant restauration.
- 🟡 Rotation des clés (stockage, sauvegardes, `BETTER_AUTH_SECRET`) et
  coffre de clés (KMS) à mettre en place avec l'hébergeur.
- 🟡 Le chiffrement des sauvegardes (`openssl enc`, CBC) n'est pas
  authentifié : l'intégrité repose sur l'empreinte SHA-256 stockée à côté.
  Préférer `age` ou le chiffrement natif de l'hébergeur en production.

### V7 — Erreurs et journalisation

- `audit.events` : écriture par `audit.record()` seule, acteur lu dans le
  contexte de transaction, UPDATE/DELETE/TRUNCATE refusés même au
  propriétaire, chaîne SHA-256 vérifiée (`audit.verify_chain()`, aussi
  après chaque restauration de sauvegarde).
- Événements tracés : connexions, refus d'accès, consentements, documents
  consultés, décisions de revue, offres, opérations, factures, exports,
  effacements, purges, accès support (début, fin).
- Logs applicatifs (pino) structurés ; jamais de corps de requête, de
  pièce, de courriel ni de jeton.
- 🟡 Centralisation et alertes (Sentry, SIEM) : à brancher à
  l'hébergement.

### V8 — Protection des données

- Consentement granulaire, nominatif et horodaté avant tout envoi à un
  bailleur ; preuve conservée (version du texte affiché).
- Droits 09-08 : export JSON immédiat ; effacement par demande, exécuté par
  la plateforme ; conservation réglable et purge quotidienne (ADR 0016).
- Minimisation : analytics pseudonymisées (HMAC), sans IP, sans profil,
  propriétés en liste fermée (test : aucune donnée personnelle) ; IA
  désactivée par défaut, données pseudonymisées.
- Pages et réponses authentifiées : `Cache-Control: private, no-store`
  pour les fichiers et exports.
- 🟡 Région d'hébergement et autorisation de transfert CNDP : en attente
  de l'avocat (questions ouvertes).

### V9 — Communications

- HSTS 2 ans, `includeSubDomains`, `preload`.
- 🟡 TLS 1.2+ et certificats : à l'hébergeur ; imposer `sslmode=verify-full`
  pour Postgres en production ; PostHog et Anthropic en HTTPS seulement
  (adaptateur PostHog : refus d'un hôte non chiffré, testé).

### V10 — Code malveillant et chaîne d'approvisionnement

- Lockfile figé en CI, versions publiées depuis plus de 14 jours
  (`minimumReleaseAge`), exceptions documentées pour les correctifs de
  sécurité ; `pnpm audit --audit-level high --prod` bloquant en CI.
- Aucune ressource tierce chargée par le navigateur (polices locales,
  analyse relayée par le serveur) ; CSP `script-src` à nonce sans
  `unsafe-inline`.

### V11 — Logique métier

- Transitions de demande, d'offre, d'opération, de mandat, de commission
  et de demande d'effacement : refusées par la base hors du graphe du
  domaine.
- Commission calculée par la base, identique au domaine (200 montants
  aléatoires) ; facture numérotée par séquence, immuable.
- Limitation de débit : authentification, formulaire de contact (en base),
  route d'analyse (120 événements par minute et par adresse).
- 🟡 Pas de limitation de débit propre aux actions métier authentifiées
  (messages, dépôts de pièces) : acceptable derrière la 2FA, à surveiller.

### V12 — Fichiers et ressources

- PDF, JPEG, PNG seulement ; 10 Mo maximum ; empreinte SHA-256 ; antivirus
  par adaptateur (scanner de test EICAR en démo : **service réel à
  brancher**) ; quarantaine en cas de détection.
- Stockage hors du dossier public, clés d'objet opaques, téléchargement par
  lien signé seulement ; aucun téléchargement pendant un accès support.

### V13 — API et services web

- Aucune API publique en V1. Routes internes : `/api/auth/*` (contrôle
  d'origine de Better-Auth, testé), `/api/documents/[id]`,
  `/api/factures/[id]`, `/api/export` (authentifiées, RLS),
  `/api/evenements` (même origine, liste fermée, 1 Ko, débit limité).
- Actions serveur Next.js : origine contrôlée par le framework (rejeu
  depuis une autre origine refusé, testé).

### V14 — Configuration

- Variables d'environnement validées au premier accès (`src/lib/env.ts`) ;
  aucune valeur secrète dans le dépôt ; `.env.example` sans valeur.
- En-têtes : CSP à nonce (`frame-ancestors 'none'`, `object-src 'none'`),
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` ; `poweredByHeader`
  désactivé (test).
- Mode démo : bandeau permanent, seed refusé en production hors mode démo.

## Tests de pénétration de base (`apps/web/e2e/security.spec.ts`)

| Essai                                                                | Résultat                              |
| -------------------------------------------------------------------- | ------------------------------------- |
| En-têtes sur les pages publiques et de connexion                     | conformes                             |
| Routes protégées sans session (pages, export, pièces, factures)      | 401, 404 ou redirection               |
| Paramètres hostiles (injection SQL, traversée, script)               | < 500, aucun reflet                   |
| Entreprise A → demande, offres, fil de l'entreprise B                | 404                                   |
| Bailleur B → dossier du bailleur A ; bailleur A → facture d'un autre | 404                                   |
| Lien de pièce à signature forgée                                     | 403                                   |
| Connexion depuis une autre origine                                   | 403                                   |
| Action serveur rejouée depuis une autre origine                      | refusée (≥ 400) ; même origine 200    |
| Message piégé (`<img onerror>`, `<script>`)                          | affiché comme texte, aucune exécution |
| Redirection après connexion vers un site externe                     | ramenée dans l'espace                 |
| Route d'analyse : autre origine, événement inconnu, courriel, 2 Ko   | 403, 400, 400, 413                    |
| Accès support : pièce, export, écriture                              | 403, 403, refus de la base            |

Garde-fous de base (`packages/db/src/__tests__/rls.test.ts`) : RLS sur
toutes les tables, aucun privilège PUBLIC, `search_path` figé sur chaque
fonction `SECURITY DEFINER`, rôles applicatifs sans BYPASSRLS et
propriétaires de rien ; mode effacement inaccessible depuis l'application.

## Risques résiduels et recommandations

1. **Test d'intrusion externe** et revue de code par un tiers avant mise
   en production.
2. Antivirus réel (ClamAV ou service de l'hébergeur) à brancher sur
   l'adaptateur.
3. Coffre de clés, rotation des clés, `sslmode=verify-full` vers Postgres.
4. Supervision : Sentry (erreurs), alertes sur refus d'accès répétés,
   connexions anormales, échecs de vérification de la chaîne d'audit.
5. Limitation de débit des actions authentifiées et verrouillage
   progressif des comptes.
6. Gestion des sessions par l'utilisateur (liste, déconnexion à distance).

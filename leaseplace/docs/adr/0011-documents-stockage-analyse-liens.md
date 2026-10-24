# ADR 0011 — Documents : stockage chiffré, analyse antivirus, liens signés

Statut : accepté (2026-10-24), à réviser avant toute donnée client réelle

## Contexte

Le coffre-fort KYC reçoit des pièces sensibles (CIN, bilans, relevés
bancaires). Aucun hébergement n'est encore choisi (ADR 0006, région UE en
attente de l'avis de l'avocat) : le code ne doit dépendre d'aucun
fournisseur.

## Décisions

- **Interface `ObjectStorage`** (`packages/integrations/src/storage`) :
  `put / get / delete` sur une clé `organisation/document`. Adaptateurs :
  mémoire (tests), fichiers locaux (`LP_STORAGE_DIR`, dev et CI). Un
  adaptateur S3 compatible (Supabase Storage, Scaleway, OVH…) implémentera
  la même interface et passera les mêmes tests de contrat.
- **Chiffrement applicatif AES-256-GCM** (`encryptedStorage`), quel que soit
  l'adaptateur : format `version | IV 12 o | tag 16 o | chiffré`, la clé de
  l'objet sert de donnée authentifiée (un fichier déplacé sous une autre clé
  ne se déchiffre pas). Clé `LP_STORAGE_KEY` (32 octets, base64) en
  variable d'environnement seulement ; rotation : champ `version` réservé.
- **Type déterminé par la signature binaire** (`sniffMimeType` : PDF, JPEG,
  PNG), jamais par l'extension ni le navigateur ; 10 Mo au plus ; doublons
  refusés par empreinte SHA-256 (index unique partiel par organisation).
- **Analyse antivirus avant stockage** (interface `MalwareScanner`). Un
  fichier infecté n'est jamais écrit : seule sa trace (`quarantined`,
  signature) est gardée et auditée. L'adaptateur actuel ne reconnaît que la
  signature de test EICAR (`real: false`) : **un vrai moteur (ClamAV ou
  service managé) est un prérequis de mise en production.**
- **Téléchargement** par `/api/documents/{id}` : lien signé HMAC (clé
  dérivée de `BETTER_AUTH_SECRET` par HKDF, contexte `document-url-v1`),
  valable 5 minutes et lié à l'utilisateur ; la session et la RLS sont
  vérifiées en plus de la signature. Réponse en pièce jointe,
  `no-store`, `nosniff`, `CSP default-src 'none'; sandbox`. Chaque
  téléchargement est audité (`document.downloaded`).
- **Suppression logique** (`deleted_at`, une seule fois, trigger) ; une pièce
  jointe à une demande soumise ne peut plus être supprimée.

## Conséquences

- Les fichiers ne quittent jamais le serveur en clair hors du flux de
  téléchargement ; une fuite du stockage seul ne révèle rien sans la clé.
- Les liens d'une page ouverte plus de 5 minutes expirent (403) : il faut
  recharger la page. Acceptable pour un usage ponctuel.
- La lecture des documents est ouverte à l'équipe plateforme (vérification
  KYC, phase 5) ; les bailleurs n'y ont aucun accès tant que l'entreprise
  n'a pas consenti nommément (phase 6).

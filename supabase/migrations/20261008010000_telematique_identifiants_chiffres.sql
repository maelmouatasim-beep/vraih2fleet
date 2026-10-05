-- Identifiants télématiques : chiffrement RÉEL (AES-256-GCM côté serveur,
-- supabase/functions/_shared/telematicsCrypto.ts) au lieu d'un simple
-- base64. Toute NOUVELLE écriture doit être un chiffré « v1.<kid>.<iv>.<ct> »
-- ou le marqueur « revoque » (déconnexion par l'utilisateur).
--
-- NOT VALID : les lignes existantes (ancien format) restent lisibles et
-- sont re-chiffrées par les fonctions à leur prochaine utilisation et par
-- la synchro planifiée ; aucune donnée supprimée par cette migration.
alter table public.telematics_connections
  add constraint telematics_credentials_chiffrees
  check (
    encrypted_credentials = 'revoque'
    or encrypted_credentials ~ '^v1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
  ) not valid;

comment on column public.telematics_connections.encrypted_credentials is
  'Identifiants du fournisseur chiffrés AES-256-GCM (clé serveur TELEMATICS_ENCRYPTION_KEY, AAD user_id:provider) ; « revoque » après déconnexion. Jamais lus par le navigateur.';

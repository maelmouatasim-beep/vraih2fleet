# ADR 0016 — Droits des personnes (loi 09-08) et conservation

Statut : accepté (2026-10-26)

## Contexte

La loi 09-08 donne aux personnes un droit d'accès, de rectification,
d'opposition et de suppression ; la plateforme doit aussi limiter la durée
de conservation. Mais une partie des données doit être gardée : preuves de
consentement (transmission licite aux bailleurs), pièces comptables
(10 ans), journal d'audit (immuable par conception).

## Décisions

- **Accès et portabilité en libre-service** : le dirigeant télécharge un
  JSON (`/api/export`, format `leaseplace-export/1`) lu sous RLS — il ne
  contient que ce qu'il voit déjà ; pièces listées (métadonnées), contenu
  au coffre-fort. Chaque export est audité.
- **Effacement sur demande**, exécuté par un administrateur sous 30 jours
  (`privacy.requests`) ; refusé tant qu'un dossier est en cours chez la
  plateforme ou un bailleur, ou qu'une opération est en cours de signature
  ou de livraison.
- **Ce que l'effacement supprime** (`privacy.erase_organization`, une
  transaction) : comptes exclusifs à l'entreprise anonymisés (nom
  « Compte effacé », adresse `efface-<id>@leaseplace.invalid`), accès
  supprimés (sessions, identifiants, 2FA, adhésions, invitations),
  notifications et préférences, demandes de contact et courriels de démo
  liés, pièces (nom remplacé, fichier chiffré supprimé du stockage),
  extractions, contrôles, notes de synthèse et appels IA.
- **Ce qu'il conserve** : profil de la personne morale, demandes,
  consentements, offres, opérations, commissions, factures, messages et
  journal — rendus pseudonymes par l'anonymisation des comptes.
- **« Mode effacement »** : seules les fonctions `SECURITY DEFINER` du
  propriétaire l'ouvrent (`app.erasure_mode()` exige un rôle autre que
  `lp_app`/`lp_auth`) ; il autorise la suppression d'enregistrements
  autrement immuables. Un rôle applicatif qui pose le paramètre n'obtient
  rien (testé).
- **Conservation réglable** dans des bornes (`RETENTION_RULES` ≡ CHECK SQL),
  appliquée par `privacy.apply_retention()` : tâche quotidienne
  (`pnpm retention:run`) ou bouton administrateur ; les fichiers échus sont
  supprimés par l'application puis marqués (`kyc.documents.purged_at`).

## Conséquences

- Les comptes d'un dirigeant effacé ne peuvent plus se connecter ; un
  retour sur la plateforme crée un nouveau compte.
- Les bailleurs gardent leurs propres copies (responsables de traitement
  distincts) : à rappeler dans la politique de confidentialité.
- Délais, périmètre et durées à valider par l'avocat (questions ouvertes).

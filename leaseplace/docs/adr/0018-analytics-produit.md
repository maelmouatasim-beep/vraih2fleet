# ADR 0018 — Analyse produit (PostHog) sous pseudonyme

Statut : accepté (2026-10-26)

## Contexte

Le produit doit mesurer l'entonnoir (visite → simulateur → demande →
soumise → KYC → transmise → première offre → acceptée → financée) sans
transférer de données personnelles, sans script tiers ni cookie, et en
restant compatible avec la CSP stricte.

## Décisions

- **Catalogue fermé** dans le domaine (`ANALYTICS_EVENTS`) : noms
  `objet_action`, propriétés en liste blanche, montants en tranches ; un
  test refuse toute propriété ressemblant à une donnée personnelle.
- **Adaptateur** (`@leaseplace/integrations/analytics`) : PostHog par l'API
  de capture HTTP (région UE, `$process_person_profile: false`, `$ip:
null`), ou mémoire (tests, démo, absence de clé) ; suite de contrat
  commune.
- **Côté serveur** pour l'entonnoir : identifiant = HMAC de l'organisation
  (clé dérivée du secret de l'application) ; événement émis après la
  transaction métier, sans jamais la faire échouer.
- **Côté navigateur** (visites et simulateur seulement) : envoi à
  `/api/evenements` sur la même origine (CSP `connect-src 'self'`),
  identifiant aléatoire limité à l'onglet (`sessionStorage`), rien si
  Do Not Track ou Global Privacy Control ; la route contrôle l'origine, la
  taille, la liste des événements et le débit.

## Conséquences

- Pas de suivi d'une même personne d'une visite à l'autre ni entre la
  visite anonyme et le compte : l'entonnoir public et l'entonnoir connecté
  se lisent séparément.
- Mettre en production : `POSTHOG_KEY` (+ `POSTHOG_HOST`), hors mode démo ;
  transfert hors du Maroc soumis à l'autorisation CNDP.

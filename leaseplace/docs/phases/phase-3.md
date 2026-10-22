# Phase 3 — Landing, SEO, secteurs, bailleurs (livrée le 2026-10-22, en attente du feu vert)

## Livré

- Landing refaite : promesse, simulateur rapide au-dessus de la ligne de
  flottaison (mobile compris), parcours en 4 étapes, aperçu du comparateur
  (offres fictives calculées et classées par le vrai moteur, signalées
  comme telles), secteurs, confiance et conformité (loi 103-12, 09-08,
  aucune décision de crédit), section bailleurs, FAQ juridique (8
  questions), appel final.
- Pages secteurs `/secteurs/{transport,btp,medical}` : équipements types,
  points d'attention, simulateur prérempli (exemple illustratif), FAQ.
- Page `/bailleurs` : bénéfices, fonctionnement, neutralité du classement,
  formulaire de contact (Zod, champ piège, consentement 09-08 versionné).
  Stockage `marketing.leads` : écriture par `marketing.submit_lead`
  seulement (validation, 5/h par IP, 3/jour par adresse), lecture réservée
  admin + opérations ; page back-office `/admin/contacts`.
- `/mentions-legales` : brouillon avec champs « [à confirmer] ».
- SEO : métadonnées par page, canonique, `hreflang` + `x-default`, Open
  Graph, JSON-LD (Organization, WebSite, FAQPage), `sitemap.xml` (21 URL),
  `robots.txt` (espaces privés exclus, tout exclu en mode démo), favicon.
- Performance (ADR 0010) et corrections : redirection de langue supprimée
  (ADR 0005), Zod sans `eval` (ADR 0007), cibles tactiles ≥ 24 px.
- Tests : 5 tests base (contacts), 9 unitaires web, 12 e2e publics dont un
  garde-fou contre toute variable de traduction non remplacée.

## À tester manuellement

1. `/` sur téléphone : le simulateur rapide est visible sans défiler.
2. `/bailleurs` : envoyer une demande, puis la voir dans `/admin/contacts`
   (compte opérations ou administrateur).
3. `/sitemap.xml`, `/robots.txt` (mode démo : `Disallow: /`).

## Dette technique

- LCP simulé 2,4–3,2 s (objectif 2 s) : à mesurer sur l'hébergement réel.
- Image Open Graph dédiée : à créer avec la marque définitive.
- Contacts : pas encore de suivi de statut (nouveau / contacté / clos) à
  l'écran ; la colonne existe.
- Aucun envoi de notification à l'équipe à la réception d'une demande
  (fournisseur de courriels : phase 7).

## Questions ouvertes

1. Contenu des pages secteurs et FAQ : à relire par l'associé (vocabulaire
   bancaire marocain) et l'avocat (mentions loi 103-12 / 09-08).
2. Faut-il publier la grille de commission sur la page bailleurs ? (non
   publiée : « selon la grille de votre mandat »).

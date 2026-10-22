# ADR 0010 — Performance des pages publiques

Statut : accepté (2026-10-22)

Mesures Lighthouse 13 (mobile, 4G simulée, mode démo désactivé), avant →
après : accueil 84 → 96, simulateur 87 → 98, secteur 98, bailleurs 92 → 95,
arabe 75 → 92 ; SEO, accessibilité et bonnes pratiques à 100.

Décisions :

- **Aucune bibliothèque de composants sur les pages publiques** : curseur
  natif (`input type="range"`), choix exclusifs en boutons radio natifs,
  menu mobile en `<details>`, langues en liens directs. Radix seulement dans
  les espaces connectés, par paquets individuels (jamais le paquet global
  `radix-ui`, qui embarquait toute la bibliothèque via `Slot`).
- **Traductions côté navigateur limitées** aux espaces des composants
  clients (`src/i18n/client-messages.ts`, couverture vérifiée par test).
- **Zod hors du navigateur** : lecture de l'URL du simulateur côté serveur
  (`simulator-params.ts`), calcul pur côté client (`simulator.ts`).
- **Polices** : Geist réduite aux caractères latins (68 → 33 Ko,
  `scripts/subset-fonts.sh`), Fraunces préchargée via `next/font`, arabe
  limité au sous-ensemble arabe en deux graisses, latin servi par Geist ;
  pas de police à chasse fixe.
- **CSS intégrée au HTML** (`experimental.inlineCss`) et métadonnées
  toujours dans `<head>` (`htmlLimitedBots`).

Limite connue : le LCP **simulé** reste à 2,4–2,8 s (3,2 s en arabe) pour un
objectif de 2 s ; le LCP observé en local est de 0,2 s. Restent à mesurer
sur l'hébergement réel (CDN, compression Brotli) ; leviers suivants : poids
du flux RSC (~45 % du HTML), CSS intégrée non mise en cache.

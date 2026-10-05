# Prêt pour un premier client — liste à cocher

État au 2026-10-05.

- « Qui » : **Claude** (code, workflows, documents) ou **toi** (décision,
  compte, paiement, signature, saisie d'un secret).
- Une case cochée = fait et vérifié (tests, CI ou site de test).
- « prêt » = tout est en place dans le dépôt ; il ne reste que ton geste,
  avec la procédure indiquée.

## Technique

- [x] Moteur TCO unique, testé (cas de référence à ±0,01 $, couverture ≥ 95 %) — fait — Claude
- [x] CI verte à chaque push : tests, e2e terrain (18 étapes) et régression visuelle (156 captures), désormais sur le **bundle de production** (CSP stricte active) — fait — Claude
- [x] Site de test déployé automatiquement (GitHub Pages + Supabase `rjyvcogtvcgzwxeprgsm`) — fait — Claude
- [x] Démo « Ville de Rivière-Claire » réaliste (PNBV, garages renseignés, PAGTCP fictive, plan nuancé) — fait — Claude
- [x] Production h2fleet.ca préparée :
  - URL propres ;
  - redirections 301 ;
  - en-têtes de sécurité ;
  - build refusé si la configuration est incomplète ;
  - garde-fous pour le dépôt privé.

  Fait — Claude.
- [ ] **Bascule de production** (`docs/production.md`, phases A à C) — prêt — toi :
  - compte Cloudflare ;
  - DNS ;
  - projet Pages ;
  - branche `production` ;
  - Site URL Supabase.
- [ ] **Sauvegardes de la base** : plan Supabase avec sauvegardes quotidiennes (ou dump chiffré planifié) — à faire — toi (choisir/payer le plan) ; Claude (workflow de dump si option gratuite)
- [x] Recalcul planifié des alertes du plan côté serveur (chaque nuit, même code que l'écran, vérifié en CI) — fait — Claude
- [x] Favicon dans le dépôt ; /dashboard/roadmap redirigé vers Suivi — fait — Claude
- [x] Tâches pg_cron planifiées automatiquement par le déploiement dès que les deux secrets du Vault existent — fait — Claude
- [ ] Secrets du Vault `h2fleet_project_url` et `h2fleet_cron_secret` (`docs/securite-secrets.md`) — prêt — toi
- [x] Courriels d'authentification par le SMTP IONOS (`noreply@h2fleet.ca`, port 465), « Confirm email » activé, modèles bilingues — fait — toi
- [x] Confirmation du courriel : page d'arrivée, attente multi-appareils (code à 6 chiffres), erreurs claires, aucune énumération ; 4 scénarios en CI (URL propres + hash) — fait — Claude
- [ ] Modèle « Confirm signup » avec le code `{{ .Token }}` (`docs/courriels-auth/confirm-signup.html`) — prêt — toi
- [ ] Courriels applicatifs : secrets SMTP des fonctions, `SMTP_PASSWORD` = **seul interrupteur** (`docs/courriels.md`), puis Paramètres → *Courriel de test* — prêt — toi
- [ ] DNS du domaine (`docs/production.md`, phase D) : vérifier l'activation DKIM chez IONOS, ajouter une adresse de rapports au DMARC — à faire — toi
- [x] Invitations d'équipe, résumé des alertes et courriel de test par SMTP (port 465), testés en CI contre un faux serveur — fait — Claude
- [ ] Montées de version Vite 8 / react-router 7 (avis npm audit) — à faire — Claude
- [ ] Carte Mapbox (optionnelle) : jeton public `pk.` — à faire — toi
- [ ] Second projet Supabase pour séparer test et production (recommandé avant des données réelles) — à décider — toi

## Sécurité

- [x] Chaque fonction Edge vérifie son appelant ; RLS sur toutes les tables + tests d'audit RLS en CI — fait — Claude
- [x] Aucun secret dans le dépôt ; secrets saisis par toi dans GitHub/Supabase — fait — toi
- [x] Identifiants télématiques **chiffrés** (AES-256-GCM côté serveur, jamais renvoyés au navigateur, écriture en clair refusée par la base) — fait — Claude
- [ ] Clé `TELEMATICS_ENCRYPTION_KEY` (`docs/securite-secrets.md` §4) — prêt — toi
- [ ] Régénérer `CRON_SECRET`, `INTERNAL_FUNCTION_SECRET`, `ALLOWED_ORIGINS` (avec h2fleet.ca) — prêt (`docs/securite-secrets.md`) — toi
- [x] `get-mapbox-token` aligné sur `_shared/` (utilisateur vérifié, CORS limité, jeton public seulement) — fait — Claude
- [x] Fonctions retirées (`assistant-chat`, `calculate-tco`) supprimées automatiquement par le workflow de déploiement — fait — Claude
- [ ] Réécrire l'historique git pour retirer ton adresse (procédure testée, `docs/historique-git.md`) — à décider — toi ; exécution par Claude avec ton accord
- [ ] Passer le dépôt en privé (`docs/production.md`, phase F) — à décider — toi, après la bascule et l'historique

## Légal

- [ ] Entreprise créée ; remplacer les placeholders des pages légales et des brouillons (nom légal, adresse, responsable Loi 25, région d'hébergement) — à faire — toi
- [ ] Revue par un juriste — à faire — toi :
  - conditions ;
  - confidentialité (mise à jour : Cloudflare, GitHub, chiffrement) ;
  - Loi 25 ;
  - brouillons de `docs/legal/`.
- [x] Brouillon d'EFVP pour l'IA (communication hors Québec vers Anthropic) — fait — Claude (`docs/legal/efvp-ia-anthropic.md`)
- [ ] EFVP complétée et signée avant d'activer une fonction IA pour un client — à faire — toi
- [x] Brouillon d'entente de pilote avec une municipalité — fait — Claude (`docs/legal/entente-pilote-municipalite.md`)
- [x] Brouillon d'entente de traitement des données — fait — Claude (`docs/legal/entente-traitement-donnees.md`)
- [ ] Assurance responsabilité professionnelle et cyber — à faire — toi

## Commercial

- [x] Rapports « conseil » PDF et Excel, note au conseil, exigences du Fonds municipal vert (équité, scénario de réduction) — fait — Claude
- [x] « Économies d'abord » et optimiseur : meilleur sous-ensemble par garage, expliqué — fait — Claude
- [x] Traçabilité pour le trésorier (point 12 de l'audit) : chaque poste de la VAN, chaque montant d'infrastructure (bornes, raccordement, station H2) et la catégorie de chaque véhicule ouvrent la Bibliothèque sur les hypothèses qui les alimentent (lien profond, surlignage) ; nouvel onglet « Catégories de véhicules » (prix d'achat, consommation, entretien, plages, sources cliquables) ; annexe PDF E (prix par catégorie) et F (sources numérotées avec adresse) ; Excel avec vraies formules (reste à financer, net, écart, totaux, TCO = VAN Excel au taux du projet, économie, VAN par poste, infrastructure) et adresses des sources en liens — fait — Claude
- [x] Tornade du stress test lisible (point 13) : toutes les hypothèses, libellés complets, valeur basse et haute dans leur unité, économie à chaque borne, écart, lien vers la Bibliothèque ; statu quo expliqué par scénario (prix et hausse du diesel testés) ; même tableau dans le PDF ; jamais d'« économie » négative — fait — Claude
- [ ] Sources « H2Fleet » (16 hypothèses renvoient au dépôt : estimations internes documentées) : à remplacer par des sources externes lues au fil des vérifications — à faire — toi + Claude
- [ ] Tarifs : grille, page Tarifs, badges d'abonnement, fin de `DEMO_MODE` — à faire — toi (décision) ; Claude (implémentation)
- [ ] Facturation réelle (prestataire de paiement) — à faire — toi (compte) ; Claude (intégration)
- [ ] Hypothèses et programmes « à valider » vérifiés à la source (dont `seuil_sous_utilisation_flotte`, PAGTCP) — à faire — toi (lecture des sources listées dans la Bibliothèque) ; Claude (workflow de vérification)
- [ ] Clé Anthropic en production et coût réel confirmé sur la première facture — à faire — toi
- [ ] Relecture du modèle de note au conseil par un responsable municipal — à faire — toi
- [ ] Adresse et processus de support pour le client pilote (`contact@h2fleet.ca` via Email Routing, `docs/production.md` phase D) — prêt — toi

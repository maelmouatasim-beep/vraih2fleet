# Prêt pour un premier client — liste à cocher

État au 2026-10-04. « Qui » : **Claude** (code, workflows, documents)
ou **toi** (décision, compte, paiement, signature, saisie d'un secret).
Une case cochée = fait et vérifié (tests, CI ou site de test).

## Technique

- [x] Moteur TCO unique, testé (cas de référence à ±0,01 $, couverture ≥ 95 %) — fait — Claude
- [x] CI verte à chaque push : tests, e2e terrain (18 étapes), régression visuelle (156 captures) — fait — Claude
- [x] Site de test déployé automatiquement (GitHub Pages + Supabase `rjyvcogtvcgzwxeprgsm`) — fait — Claude
- [x] Démo « Ville de Rivière-Claire » réaliste (PNBV, garages renseignés, PAGTCP fictive, plan nuancé) — fait — Claude
- [ ] **Sauvegardes de la base** : plan Supabase avec sauvegardes quotidiennes (ou dump chiffré planifié) — à faire — toi (choisir/payer le plan) ; Claude (workflow de dump si option gratuite)
- [ ] Domaine propre et hébergement de production (au lieu de GitHub Pages) — à faire — toi (acheter le domaine) ; Claude (configuration)
- [ ] Courriels : compte SendGrid + clé, puis réactiver « Confirm email » et le résumé des alertes — à faire — toi (compte, clé) ; Claude (branchement)
- [ ] Tâches planifiées pg_cron (4 tâches, `supabase/snippets/taches-planifiees.sql`) — à faire — toi (exécuter une fois dans l'éditeur SQL)
- [ ] Recalcul planifié des alertes du plan côté serveur — à faire — Claude
- [ ] Invitations d'équipe envoyées par courriel (après SendGrid) — à faire — Claude
- [ ] Favicon hébergé chez Lovable → fichier du dépôt ; retirer /dashboard/roadmap — à faire — Claude
- [ ] Montées de version Vite 8 / react-router 7 (avis npm audit) — à faire — Claude
- [ ] Carte Mapbox (optionnelle) : jeton — à faire — toi

## Sécurité

- [x] Chaque fonction Edge vérifie son appelant ; RLS sur toutes les tables + tests d'audit RLS en CI — fait — Claude
- [x] Aucun secret dans le dépôt ; secrets saisis par toi dans GitHub/Supabase — fait — toi
- [ ] Chiffrement des identifiants télématiques (simple base64 aujourd'hui) — à faire — Claude
- [ ] Régénérer / créer `CRON_SECRET`, `INTERNAL_FUNCTION_SECRET`, `ALLOWED_ORIGINS` — à faire — toi (saisie) ; Claude (procédure dans `docs/deploiement.md`)
- [ ] `get-mapbox-token` : CORS et vérification de l'appelant alignés sur `_shared/` — à faire — Claude
- [ ] Supprimer la fonction `assistant-chat` encore déployée — à faire — Claude (étape du workflow de déploiement) ou toi (une commande)
- [ ] Décider : réécrire l'historique git pour retirer ton adresse ; passer le dépôt en privé — à faire — toi (décision)

## Légal

- [ ] Entreprise créée ; remplacer les placeholders des pages légales (nom légal, adresse, responsable Loi 25) — à faire — toi
- [ ] Revue par un juriste : conditions, confidentialité, Loi 25 — à faire — toi
- [ ] EFVP (communication hors Québec vers Anthropic) avant d'activer une fonction IA pour un client — à faire — toi (validation) ; Claude (brouillon)
- [ ] Entente de pilote avec le client (périmètre, données, confidentialité, responsabilité) — à faire — toi
- [ ] Assurance responsabilité professionnelle — à faire — toi

## Commercial

- [x] Rapports « conseil » PDF et Excel, note au conseil, exigences du Fonds municipal vert (équité, scénario de réduction) — fait — Claude
- [x] « Économies d'abord » et optimiseur : meilleur sous-ensemble par garage, expliqué — fait — Claude
- [ ] Tarifs : grille, page Tarifs, badges d'abonnement, fin de `DEMO_MODE` — à faire — toi (décision) ; Claude (implémentation)
- [ ] Facturation réelle (prestataire de paiement) — à faire — toi (compte) ; Claude (intégration)
- [ ] Hypothèses et programmes « à valider » vérifiés à la source (dont `seuil_sous_utilisation_flotte`, PAGTCP) — à faire — toi (lecture des sources listées dans la Bibliothèque) ; Claude (workflow de vérification)
- [ ] Clé Anthropic en production et coût réel confirmé sur la première facture — à faire — toi
- [ ] Relecture du modèle de note au conseil par un responsable municipal — à faire — toi
- [ ] Adresse et processus de support pour le client pilote — à faire — toi

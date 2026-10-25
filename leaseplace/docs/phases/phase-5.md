# Phase 5 — Revue des dossiers assistée par l'IA (livrée le 2026-10-26, en attente du feu vert)

## Livré

- **File de revue** `/admin/dossiers` (opérations et administration ; le
  support n'y a pas accès) : demandes soumises, en revue, en attente de
  compléments, qualifiées, avec l'indice.
- **Prise en charge et analyse** : extraction de chaque pièce (champs,
  sources par page, avertissements), **10 contrôles de cohérence** croisés
  (même ICE, même RC, raison sociale, dirigeant, validité de la CIN,
  fraîcheur, CA dans la tranche, exercices récents, devis = montant demandé,
  pièces lisibles), **indice d'orientation v1** explicable (8 facteurs,
  note A–E, plafonds, drapeaux ; `docs/scoring.md`).
- **Correction motivée** de l'indice (20 caractères minimum, immuable,
  auditée) ; vérification ou rejet motivé de chaque pièce.
- **Note de synthèse** : rédigée à partir des seuls faits du moteur, chaque
  paragraphe sourcé, chaque nombre vérifié (sinon rejetée), validée par un
  humain ; une nouvelle analyse écarte le brouillon.
- **Décision** : qualifier (indice + note validée + anomalies commentées)
  ou demander des compléments. L'entreprise voit le motif, corrige sa
  demande (redevenue modifiable), consent et resoumet. Statuts visibles par
  le client : en revue, compléments demandés, dossier vérifié.
- `packages/ai` (ADR 0012) : client Claude, simulateur de démonstration,
  vérificateur, évaluation manuelle.
- Traductions par espace : le site public ne charge plus les textes de
  l'espace entreprise ni du back-office.
- Seed : un dossier Atlas soumis avec ses pièces (PDF fictifs chiffrés).
- Tests : domaine 157 (100 %), base 56 (transitions SQL ≡ machine d'états,
  revue réservée à la plateforme, immuabilité, isolation), IA 33, web 48,
  **44 e2e** (revue complète, compléments vus par l'entreprise, anomalie à
  commenter, accès refusé à une entreprise, accessibilité).

## Tables (à valider — aucune base hébergée : réécriture possible)

| Table                       | Contenu                                                                                       | Règles                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `kyc.documents` (+2 col.)   | `review_status` (non analysée / extraite / vérifiée / rejetée), `review_note`                 | modifiables par la plateforme seulement                                 |
| `kyc.document_extractions`  | champs extraits, sources (page, extrait), avertissements, lisible, version du prompt          | plateforme ; immuable                                                   |
| `kyc.kyc_checks`            | un passage = `run_id` ; code, statut, attendu, trouvé, documents                              | plateforme ; immuable                                                   |
| `credit.risk_assessments`   | version de la grille, entrées, ratios, facteurs, drapeaux, score, note, note avant plafond    | plateforme ; immuable                                                   |
| `credit.risk_overrides`     | note corrigée, motif (≥ 20 caractères), auteur, date                                          | plateforme ; immuable                                                   |
| `credit.credit_memos`       | contenu (sections, paragraphes, sources), table des sources, statut brouillon/validée/écartée | plateforme ; contenu figé ; une décision, par son auteur ; un brouillon |
| `credit.ai_runs`            | fournisseur, modèle, prompt, empreinte de l'entrée, statut, jetons, durée, sortie, écarts     | plateforme ; immuable ; jamais le document                              |
| `credit.financing_requests` | statuts `in_review`, `needs_info`, `qualified` ; motif dans l'historique                      | revue par la plateforme, soumission et annulation par l'entreprise      |

## À tester manuellement

1. `/demo` → compte opérations → Revue des dossiers → dossier Atlas →
   « Prendre en charge et analyser » → contrôles, indice, pièces extraites.
2. Corriger l'indice, rédiger la note, la valider, qualifier.
3. Sur un autre dossier : demander des compléments, puis se connecter avec
   le compte entreprise, lire le motif, resoumettre.
4. Anomalie : déposer dans un coffre-fort un extrait RC nommé
   `rc-autre-ice.pdf` (le simulateur y place un autre ICE).

## Dette technique

- **Simulateur seulement** : aucune extraction réelle tant que la clé et
  l'autorisation CNDP manquent ; prompts à éprouver sur de vrais documents.
- Pas de file de tâches (Inngest / Trigger.dev) : l'analyse tourne pendant
  la requête du relecteur (quelques secondes avec le simulateur, une à deux
  minutes attendues avec l'API).
- Statut KYC de l'entreprise (`companies.kyc_status`) pas encore mis à jour
  à la qualification ; tables `directors` et `beneficial_owners` à venir.
- Les tables immuables empêchent la suppression d'une entreprise : à
  articuler avec la politique de conservation et les demandes de suppression
  (phase 9).
- Seuils et poids de l'indice : hypothèses (`docs/scoring.md`).
- Avis modérés de `pnpm audit` (aucun haut ni critique).

## Questions ouvertes

1. Grille de l'indice : seuils, poids, tables sectorielles et de revente —
   à revoir avec l'associé et un bailleur.
2. Faut-il montrer l'indice à l'entreprise ? (aujourd'hui : non, il sert
   l'orientation et la note aux bailleurs).
3. Fournisseur d'IA : API Claude directe (États-Unis) ou via une région UE
   d'un hébergeur cloud ? Dépend de l'avis de l'avocat et de la CNDP.
4. La note de synthèse doit-elle être en français seulement, ou aussi en
   arabe selon le bailleur ?

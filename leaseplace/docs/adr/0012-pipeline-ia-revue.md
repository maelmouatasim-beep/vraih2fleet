# ADR 0012 — Pipeline IA de revue : extraction, contrôles, indice, note

Statut : accepté (2026-10-26), à revoir avant tout appel réel à l'API

## Contexte

La plateforme vérifie le dossier avant de l'orienter vers les bailleurs. Le
prompt impose l'API Claude pour l'extraction et la note de synthèse, avec
sorties structurées validées, trace complète et humain dans la boucle ; la
loi 09-08 impose de limiter les données transmises.

## Décisions

- **`packages/ai`** : interface `AiProvider` (`extract`, `writeMemo`),
  prompts versionnés (`extraction-v1`, `memo-v1`), schémas Zod. Deux
  implémentations : `anthropic` (SDK officiel, modèle `claude-opus-5-5`,
  sorties structurées, effort moyen, repli serveur `fallbacks: "default"`
  en cas de refus) et `mock`, simulateur déterministe de démonstration qui
  **ne lit pas le document** (valeurs tirées du profil déclaré, signalé à
  l'écran). Choix par `LP_AI_PROVIDER` ; `mock` par défaut, aucune clé en CI.
- **Le document est une donnée, jamais une consigne** : prompt système
  explicite, texte suspect signalé en avertissement, sortie validée par Zod
  puis normalisée (valeur mal formée → `null` signalé, jamais corrigée).
- **Note de synthèse** : le modèle reçoit uniquement des faits produits par
  le moteur (profil, demande, indice, contrôles, exercices extraits), **sans
  aucun nom de personne**. Chaque paragraphe cite ses sources (`PROFILE`,
  `D3`…) ; un vérificateur rejette toute source inconnue et **tout nombre
  absent des faits** (avec leurs écritures usuelles : %, millions). Une note
  rejetée n'est jamais enregistrée comme brouillon ; la trace l'est.
- **Humain dans la boucle** : la note est un brouillon jusqu'à validation
  par un relecteur ; la qualification exige un indice, une note validée sur
  l'analyse en cours, et un commentaire si un contrôle est en échec. La base
  applique les mêmes règles (triggers) et réserve la revue à la plateforme.
- **Traçabilité** : `credit.ai_runs` (fournisseur, modèle, version du prompt,
  empreinte de l'entrée — jamais le document —, jetons, durée, sortie,
  écarts), extractions, contrôles, indices et corrections immuables.
- **Exécution** : déclenchée par le relecteur (« Prendre en charge et
  analyser »), appels IA hors transaction, trois documents en parallèle. Pas
  encore de file de tâches (Inngest / Trigger.dev) : à brancher avec
  l'hébergement, avec une identité de service dédiée.

## Conséquences

- Aucun appel externe tant que `LP_AI_PROVIDER=mock`. Passer à `anthropic`
  exige l'autorisation de la CNDP pour le transfert hors du Maroc, une
  mention dans la politique de confidentialité et un essai sur de vrais
  documents (`pnpm --filter @leaseplace/ai eval`, appels facturés).
- Le vérificateur de nombres peut rejeter une note correcte (formulation
  inattendue) : le relecteur relance la rédaction ; aucune note non vérifiée
  ne passe.

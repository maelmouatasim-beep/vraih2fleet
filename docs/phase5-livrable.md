# Phase 5 — H2Fleet intelligent : livrable final

Démonstration sur la démo « Ville de Rivière-Claire » (municipalité
FICTIVE, 40 véhicules), limites connues, coût estimé de l'IA. Les captures
sont produites par `scripts/` (démo) et par le parcours permanent
`npm run e2e:terrain` (17 étapes, faux serveur Claude, aucune vraie clé).

Règles tenues partout : l'IA n'écrit jamais un chiffre (moteur via outils
ou faits à jetons, nombres vérifiés, sinon rejet) ; toute action passe par
un aperçu avant → après, une confirmation et le journal ; clé
`ANTHROPIC_API_KEY` côté serveur seulement (sans clé : message propre,
503 `service_non_configure`) ; chaque fonction IA est désactivée par
défaut et activable par organisation, avec quotas jour/mois et débit par
utilisateur ; usage journalisé en jetons seulement (Loi 25 :
minimisation).

## Démonstration pas à pas

| # | Fonction | Où | Ce que montre la démo |
|---|---|---|---|
| 0 | Réglages IA | Organisation › Intelligence artificielle | Chaque fonction activée explicitement ; quotas ; coût estimé du mois |
| 1 | Optimiseur de calendrier | Projet › Stratégies › « Optimisée » | Contraintes (budget, cibles, garages) → 4e stratégie, chaque décision expliquée ; aucune IA |
| 2 | Copilote | Panneau « Copilote » du parcours | « Et si le diesel baisse de 20 % ? » : simulation par le moteur, stress test, nombres vérifiés |
| 3 | Import intelligent | Ma flotte › Import intelligent | Export fictif « GestFlotte » : correspondance proposée sur les entêtes seulement, validation ligne par ligne |
| 4 | Factures et devis | Financement › Factures et devis | Facture de diesel fictive : chaque nombre retrouvé dans le texte, prix au litre DÉRIVÉ par le code, confirmation → donnée client ; pièce citée aux rapports (SHA-256) |
| 5 | Veille des subventions | Bibliothèque › Veille des subventions | Deux lectures hebdomadaires de pages fictives : 4 changements (montant, date, statut) en file ; 3 validés, 1 rejeté ; rien d'appliqué au registre ; alerte au Financement |
| 6 | Surveillance du plan | Suivi › Surveillance du plan ; Accueil › Santé du plan | Prix de l'énergie modifié depuis le rapport (stress test relancé, effet du prix isolé), échéance, retard, programme modifié, capacité de garage ; « vue » tracée |
| 7 | Note au conseil | Rapports › Note au conseil | Faits du moteur → rédaction IA à jetons (un brouillon avec un chiffre en clair est rejeté) ou modèle sans IA ; nombre inventé = export bloqué ; PDF et Word liés à un snapshot |
| — | Rapport détaillé | Rapports › PDF | Même gabarit « cabinet » : titre d'action chiffré, pièces numérotées et sourcées, annexes |

## Limites connues

- **IA non branchée sur le site de test** : sans `ANTHROPIC_API_KEY`, les
  fonctions 2, 3, 4 (lecture) et 7 (rédaction IA) affichent un message
  propre ; la note au conseil reste disponible par le modèle sans IA, les
  factures se saisissent à la main. Les démonstrations utilisent un faux
  serveur Claude scripté : la QUALITÉ de rédaction du vrai modèle reste à
  apprécier sur de vraies données après activation.
- **Veille** : la détection repère des montants, des dates et des mots de
  statut dans le texte ; une page restructurée peut produire un faux
  changement (d'où la validation humaine obligatoire) ou en manquer un
  formulé autrement. Une page inaccessible est signalée « échec » dans le
  journal du workflow. Un changement validé informe les projets mais ne
  modifie PAS le registre (`subsidy-programs.ts` à mettre à jour après
  lecture de la source).
- **Surveillance** : les alertes sont recalculées quand un membre ouvre
  l'Accueil ou le projet (le moteur tourne dans le navigateur) ; une
  donnée officielle arrivée un lundi est donc signalée à la visite
  suivante. Le résumé par courriel (`plan-alerts-digest`) part dès que
  l'envoi SMTP est branché (`SMTP_PASSWORD`), pour les alertes déjà relevées.
- **Note au conseil** : la vérification garantit que chaque NOMBRE vient
  du moteur ; elle ne juge pas le raisonnement. Une relecture humaine
  reste nécessaire avant dépôt (formulations, contexte local). Les
  hypothèses « à valider » sont listées en annexe, pas résolues.
- **Rapports** : polices standard PDF (Times, Helvetica) pour éviter tout
  téléchargement de police ; pas encore de logo de l'organisation.
- **Loi 25** : l'EFVP (communication hors Québec vers Anthropic, É.-U.)
  doit être complétée avant d'activer une fonction IA pour un client ;
  seules des données agrégées ou des entêtes partent vers l'API (aucune
  colonne personnelle, aucun nom de conducteur).

## Coût estimé de l'IA par organisation et par mois

Tarif de l'API (claude-opus-5-5, grille officielle consultée le
2026-10-03, `src/lib/ai/tarifs.ts`) : 4 $ US par million de jetons en
entrée, 20 $ US en sortie. ESTIMATIONS de volume par usage (à confirmer
sur la facture réelle — la carte « Consommation » de l'organisation
affiche le coût calculé sur l'usage journalisé) :

| Usage | Jetons par usage (entrée / sortie, raisonnement compris) | Coût unitaire estimé |
|---|---|---|
| Question au copilote (≈ 3 appels outils) | ≈ 18 000 / 1 800 | ≈ 0,11 $ US |
| Import intelligent (entêtes + 3 exemples) | ≈ 3 000 / 1 500 | ≈ 0,04 $ US |
| Lecture d'une facture avec couche texte | ≈ 4 000 / 2 000 | ≈ 0,06 $ US |
| Lecture d'une facture numérisée (fichier) | ≈ 12 000 / 2 000 | ≈ 0,09 $ US |
| Note au conseil (une ou deux rédactions) | ≈ 5 000–10 000 / 3 000–6 000 | ≈ 0,08–0,16 $ US |

| Profil mensuel | Hypothèse d'usage | Coût estimé |
|---|---|---|
| Petite municipalité | 40 questions, 2 imports, 10 factures, 2 notes | ≈ 5 $ US / mois |
| Usage soutenu | 150 questions, 5 imports, 40 factures, 6 notes | ≈ 20 $ US / mois |
| Plafond par défaut | 3 000 000 jetons / mois (réglable par l'administrateur) | ≤ ≈ 17 $ US pour un usage typique (90 % entrée), 60 $ US au pire (tout en sortie) |

Montants en dollars américains (devise de facturation d'Anthropic), non
convertis en CAD faute de taux sourcé. Le quota mensuel par organisation
borne le coût : une fois atteint, les fonctions IA répondent « limite
mensuelle atteinte » jusqu'au mois suivant.

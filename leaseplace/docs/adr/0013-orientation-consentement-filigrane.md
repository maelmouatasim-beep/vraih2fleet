# ADR 0013 — Orientation vers les bailleurs, consentement nominatif, filigrane

Statut : accepté (2026-10-26)

## Contexte

Le dossier vérifié doit atteindre les bailleurs adaptés sans que la
plateforme ne favorise l'un d'eux (intermédiaire sous mandat, loi 103-12),
et uniquement avec l'accord explicite de l'entreprise, bailleur par
bailleur (loi 09-08). Les bailleurs consultent des pièces sensibles : toute
fuite doit pouvoir être attribuée.

## Décisions

- **Calcul pur, décision figée** : `routeRequest` (domaine) compare le
  profil du dossier aux critères d'appétit et renvoie les éligibles et les
  exclus avec leurs motifs. La décision (`routing_decisions`) fige le profil
  et les critères utilisés ; elle est immuable et calculée à la
  qualification.
- **Ordre neutre** : les éligibles sont ordonnés par une rotation
  déterministe (FNV-1a sur l'identifiant du dossier et du bailleur), stable
  pour un dossier, différente d'un dossier à l'autre. Aucun score de
  préférence, aucune mise en avant payante.
- **L'entreprise choisit** : 3 à 5 bailleurs au plus (4 par défaut), tous
  facultatifs. Le consentement `consent_routing` est un texte versionné et
  ses destinataires sont **nommés** (`consent_recipients`). L'envoi d'une
  cible est refusé en base sans gérant ni consentement nommant le bailleur.
- **Visibilité par la RLS** : `app.lessor_sees_request` exige une cible
  envoyée et un consentement actif nommant le bailleur ; les autres données
  (entreprise, pièces, indice, note validée, contrôles) en découlent. Le
  retrait du consentement coupe l'accès sans autre action.
- **Offre recalculée par le serveur** : le bailleur saisit des conditions ;
  le loyer, le coût et le TEG sont recalculés par le moteur financier de la
  phase 2 et stockés avec l'offre. Une seule offre vivante par cible ; seul
  le retrait est possible ensuite (pas de modification silencieuse).
- **Délai de réponse** : 72 h depuis l'envoi (`sla_due_at`), posé par la
  base.
- **Filigrane à la volée** (pdf-lib) : chaque pièce servie à un bailleur est
  un PDF portant son nom en diagonale et une ligne « consulté par … le … » ;
  une image est convertie en PDF ; un fichier non filigranable n'est pas
  servi (422). L'original chiffré n'est jamais modifié.

## Conséquences

- La neutralité est vérifiable : la décision, l'ordre et les motifs sont
  conservés et audités.
- Le filigrane coûte un traitement à chaque téléchargement (acceptable pour
  des PDF de quelques pages ; à surveiller sur de gros scans).
- Police standard : les noms non latins sont translittérés ; une police
  arabe devra être intégrée si un bailleur porte un nom arabe.

> **BROUILLON À FAIRE VALIDER PAR UN JURISTE** — modèle d'entente de
> traitement des données (mandat de traitement de renseignements personnels)
> entre l'exploitant de H2Fleet et une organisation cliente. Il ne constitue
> pas un avis juridique. Les éléments entre crochets `[…]` sont à compléter ;
> les mesures décrites correspondent au logiciel tel qu'il est en octobre 2026.

# Entente de traitement des données — H2Fleet

**Responsable des renseignements** : [Nom de l'organisation cliente] (le
« **Client** »).
**Mandataire** : [Nom légal de l'exploitant — à confirmer] (l'« **Exploitant** »).

Cette entente complète le contrat principal (entente de pilote ou contrat
d'abonnement) et prévaut sur lui pour tout ce qui touche aux renseignements
personnels.

*Cadre légal à confirmer par le juriste* :
- pour un organisme public : *Loi sur l'accès aux documents des organismes
  publics et sur la protection des renseignements personnels* (RLRQ,
  c. A-2.1), notamment son art. 67.2 (communication à un mandataire, contrat
  écrit) ;
- pour une entreprise : *Loi sur la protection des renseignements personnels
  dans le secteur privé* (RLRQ, c. P-39.1), notamment son art. 18.3.

## 1. Objet et rôles

1.1 Le Client confie à l'Exploitant le traitement des renseignements décrits
à l'annexe A, **uniquement** pour fournir le Service H2Fleet (planification
du remplacement de la flotte, rapports, suivi) et selon les instructions
documentées du Client.

1.2 Le Client demeure responsable des renseignements. Il décide notamment :
- quelles données sont importées ;
- qui y accède ;
- si les fonctions facultatives sont activées (intelligence artificielle,
  télématique, courriels).

## 2. Obligations de l'Exploitant

L'Exploitant s'engage à :

1. ne traiter les renseignements qu'aux fins prévues, jamais à ses propres
   fins. Ni vente, ni profilage, ni entraînement d'un modèle d'IA ;
2. limiter l'accès aux seules personnes qui en ont besoin, liées par une
   obligation de confidentialité ;
3. maintenir les mesures de sécurité de l'annexe B, ou des mesures
   équivalentes ou supérieures ;
4. n'avoir recours qu'aux sous-traitants ultérieurs de l'annexe C ;
   - il avise le Client au moins [30] jours avant tout ajout ou
     remplacement ;
   - le Client peut s'y opposer pour un motif raisonnable et, à défaut
     d'entente, résilier sans pénalité ;
5. ne communiquer aucun renseignement à l'extérieur du Québec sans que
   l'évaluation des facteurs relatifs à la vie privée requise ait été faite.
   Voir l'annexe C et le modèle `efvp-ia-anthropic.md` ;
6. aider le Client à répondre aux demandes des personnes concernées : accès,
   rectification, suppression, portabilité dans un format structuré ;
7. aviser le Client **sans délai**, et au plus tard dans les [24] heures
   après en avoir pris connaissance, de tout incident de confidentialité. Il
   lui transmet les renseignements utiles pour sa propre évaluation du
   préjudice, ses avis à la Commission d'accès à l'information et aux
   personnes concernées, et son registre des incidents ;
8. permettre au Client de vérifier le respect de l'entente, sur préavis
   raisonnable, par questionnaire ou par rapport d'un tiers, au plus
   [une fois par année] sauf incident ;
9. à la fin du contrat :
   - remettre les données au Client dans un format structuré ;
   - les détruire dans un délai de [30] jours ;
   - en fournir une attestation écrite ;
   - les copies de sauvegarde sont effacées selon leur cycle normal de
     [n] jours.

## 3. Obligations du Client

Le Client :
- fournit des données licites et nécessaires ;
- informe les personnes concernées lorsque la loi l'exige ;
- active les fonctions facultatives en connaissance de cause, en
  particulier les fonctions d'IA, après son EFVP ;
- gère les droits d'accès de ses utilisateurs (rôles administrateur, membre,
  lecteur).

## 4. Durée

L'entente dure tant que l'Exploitant détient des renseignements du Client. Les
sections 2 (7 et 9) et 5 survivent à sa fin.

## 5. Responsabilité

Selon le contrat principal. *[Le juriste vérifiera que la limite de
responsabilité du contrat principal ne s'applique pas, ou s'applique selon un
plafond distinct, aux manquements à la présente entente.]*

## Signatures

| Pour le Client | Pour l'Exploitant |
|---|---|
| Nom, titre : | Nom, titre : |
| Signature : | Signature : |
| Date : | Date : |

---

## Annexe A — Renseignements traités

| Catégorie | Exemples | Source | Personnes concernées |
|---|---|---|---|
| Comptes | nom, adresse courriel, organisation, rôle | utilisateurs du Client | employés du Client |
| Invitations | adresse courriel de la personne invitée | administrateur du Client | personnes invitées |
| Flotte et garages | numéro d'unité, NIV, marque, modèle, année, kilométrage, garage | import ou saisie par le Client | en principe aucune (données d'organisation) ; indirectement le conducteur attitré, le cas échéant |
| Documents | factures et devis téléversés (peuvent contenir adresse de service, numéro de compte) | Client | Client, fournisseurs |
| Télématique (si connectée) | identifiants d'accès à la plateforme (chiffrés), données de véhicules | plateforme du Client (Geotab, Samsara) | indirectement les conducteurs |
| Historique du copilote (si activé) | questions et réponses | utilisateurs du Client | employés du Client |
| Données techniques | session d'authentification, journaux de l'hébergeur | navigateur, hébergeur | utilisateurs |

**Renseignements sensibles** : aucun champ prévu. Le Client s'abstient d'en
saisir.

## Annexe B — Mesures de sécurité (état réel du logiciel)

**En place** :
- chiffrement des échanges (HTTPS, HSTS) ;
- politique de sécurité du contenu stricte sur le site ;
- cloisonnement par organisation au niveau de la base de données : sécurité
  par ligne sur toutes les tables, vérifiée en continu par des tests
  automatisés ;
- rôles par organisation (administrateur, membre, lecteur) ; le dernier
  administrateur est protégé ;
- authentification par Supabase ; aucune fonction serveur sans vérification
  explicite de l'appelant ;
- identifiants télématiques **chiffrés AES-256-GCM** côté serveur :
  - clé conservée hors de la base ;
  - jamais renvoyés au navigateur ;
  - effacés à la déconnexion ;
- documents téléversés dans un stockage privé par organisation ; une pièce
  confirmée ne peut plus être modifiée ;
- journal immuable des modifications du plan ;
- fonctions d'IA désactivées par défaut, avec minimisation des données
  transmises ;
- secrets (clés d'API) conservés côté serveur seulement.

**À mettre en place avant toute donnée réelle** (voir
`docs/pret-premier-client.md`) :
- **sauvegardes quotidiennes restaurables de la base**, avec rétention de
  [n] jours ;
- registre des incidents de confidentialité ;
- procédure d'accès du personnel de l'Exploitant (principe du moindre
  privilège, double authentification) ;
- région d'hébergement confirmée et documentée.

## Annexe C — Sous-traitants ultérieurs

| Sous-traitant | Rôle | Données | Lieu | Quand |
|---|---|---|---|---|
| Supabase, Inc. | base de données, authentification, stockage de fichiers, fonctions serveur | toutes les données du Service | région [à confirmer] | toujours |
| Cloudflare, Inc. | hébergement du site (fichiers statiques), DNS, réseau de diffusion | adresses IP et requêtes des visiteurs ; aucune donnée du Client stockée | mondial | toujours |
| GitHub, Inc. (Microsoft) | exécution des tâches planifiées (recalcul nocturne des alertes du plan) et des déploiements | données des projets lues en mémoire pendant l'exécution, non conservées | États-Unis | toujours |
| Twilio SendGrid | envoi des courriels (invitations, résumés d'alertes, rappels) | adresse courriel du destinataire, contenu du courriel (nom de l'organisation ou du projet, textes des alertes) | États-Unis | si l'envoi de courriels est activé |
| Anthropic, PBC | modèle d'IA (copilote, import intelligent, lecture de factures, note au conseil) | voir `efvp-ia-anthropic.md` (données minimisées) | États-Unis | seulement si le Client active une fonction d'IA |

*Chaque communication à l'extérieur du Québec doit être couverte par une
EFVP. Les conditions contractuelles de chaque sous-traitant (DPA) sont à
joindre ou à référencer.* *[À compléter.]*

---
*BROUILLON À FAIRE VALIDER PAR UN JURISTE.*

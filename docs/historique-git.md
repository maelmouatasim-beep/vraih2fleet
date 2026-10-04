# Retirer ton adresse courriel de l'historique git

> **Rien n'a été exécuté sur GitHub.** Ce document décrit la procédure et ses
> risques. La réécriture n'aura lieu qu'avec ton accord explicite.

## État constaté (comptes seulement, l'adresse n'est jamais affichée)

| Où | Occurrences |
|---|---|
| Métadonnées des commits (auteur ou committer) | 52, sur 26 commits datés du 22 au 27/09 |
| Contenu des fichiers, toutes versions confondues | 12 : 2 anciennes versions de `src/lib/constants.ts`, retirée du fichier depuis |
| Messages de commit | 0 |
| Fichiers actuels | 0 |

- Le dépôt n'a **aucun fork**, aucune pull request et aucune étiquette, et une
  seule branche. C'est le cas le plus simple possible.
- **Simulation faite** sur une copie locale (`scripts/historique/nettoyer-courriel.sh`,
  sans `--pousser`) : 52 → 0 et 12 → 0 en 10 secondes, rien poussé, copie
  supprimée.

## Ce que fait la procédure

`git filter-repo` réécrit chaque commit sur une **copie miroir** :

- dans les métadonnées, l'adresse est remplacée par ton adresse GitHub
  « noreply » (`ID+login@users.noreply.github.com`) ; ton nom ne change pas ;
- dans le contenu des fichiers et les messages, elle devient
  `adresse-retiree@example.invalid`.

Le script vérifie qu'il ne reste **aucune** occurrence avant de proposer de
pousser. Il ne montre que des comptes et lit l'adresse uniquement dans une
variable d'environnement, jamais en argument ni dans un fichier du dépôt.

## Risques (à lire avant de dire oui)

1. **Tous les identifiants de commit changent.** Les liens vers d'anciens
   commits deviennent morts : historique des runs GitHub Actions, références
   dans l'artefact d'audit, commits cités dans nos échanges. Le code, lui,
   ne change pas d'un octet.
2. **Push forcé.** La branche `claude/code-integration-site-o88hza` (et
   `production` si elle existe déjà) est remplacée sur GitHub.
   - Toute copie existante devient incompatible et doit être re-clonée :
     ma session Claude et les sessions futures, ton ordinateur si tu as
     cloné le dépôt, Cloudflare (qui reconstruit tout seul).
   - **Une vieille copie qui repousserait remettrait l'adresse.**
3. **Ce que la réécriture n'efface pas.** Le dépôt est public depuis
   septembre.
   - GitHub garde un temps les anciens commits accessibles par leur
     identifiant exact. Pour les purger, il faut une demande au support
     GitHub (formulaire *Remove cached views / sensitive data*, en citant le
     dépôt).
   - Des copies tierces peuvent exister : archives publiques (GH Archive,
     Software Heritage), robots, personnes qui ont cloné. On ne peut pas les
     effacer.
   - La réécriture **réduit fortement l'exposition**, elle ne rend pas
     l'adresse secrète. Si le spam t'inquiète, un alias ou un filtre reste
     le complément.
4. **Lovable** : si le dépôt est encore connecté à un projet Lovable,
   déconnecte-le **avant**. Lovable pourrait repousser l'ancien historique.
5. **Protection de branche** : si tu as protégé `production`, autorise
   temporairement le push forcé (Settings → Branches), puis remets la
   protection.

## Procédure (une fois ton accord donné)

### 1. Préparer, de ton côté (5 min)

- GitHub → Settings → **Emails** :
  - coche **Keep my email addresses private** ;
  - coche **Block command line pushes that expose my email** ;
  - note l'adresse affichée `…@users.noreply.github.com`. C'est une valeur
    publique, tu peux me la donner dans le chat.
- Sur ton ordinateur, si tu fais des commits :
  `git config --global user.email "<adresse noreply>"`.
- Si le dépôt est connecté à Lovable, déconnecte-le.

### 2. Exécuter (10 min, par moi avec ton accord, ou par toi)

```bash
pipx install git-filter-repo          # ou : pip install git-filter-repo
export ANCIENNE_ADRESSE='…'           # ton adresse actuelle (jamais dans un fichier)
export NOUVELLE_ADRESSE='…@users.noreply.github.com'
# 1) Simulation : affiche les comptes avant / après, ne pousse rien
scripts/historique/nettoyer-courriel.sh https://github.com/maelmouatasim-beep/vraih2fleet.git
# 2) Si « Après : 0 · 0 · 0 » : réécriture de GitHub
scripts/historique/nettoyer-courriel.sh https://github.com/maelmouatasim-beep/vraih2fleet.git --pousser
```

Le script garde une **sauvegarde intégrale** (`sauvegarde-avant-nettoyage.bundle`)
dans son dossier de travail. Elle contient encore l'adresse : garde-la hors
ligne quelques jours, puis supprime-la.

### 3. Vérifier

- GitHub → onglet *Commits* : les commits concernés montrent ton nom avec
  l'adresse noreply.
- Je re-clone et relance le décompte : il doit donner 0 · 0 · 0.
- Cloudflare a reconstruit l'aperçu et la production sans erreur.
- **Facultatif** : demande de purge au support GitHub (point 3 des risques).

### 4. Ensuite seulement

Passer le dépôt en privé : phase F de `docs/production.md`.

## Alternative si tu préfères ne pas réécrire

Passer le dépôt en privé sans réécrire. L'historique n'est alors plus visible
que des personnes autorisées, mais l'adresse reste dans l'historique : si le
dépôt redevient public un jour, ou s'il est partagé avec un collaborateur, elle
sera de nouveau visible. La réécriture avant le passage en privé est la
solution propre ; le dépôt sans fork le permet aujourd'hui à moindre coût.

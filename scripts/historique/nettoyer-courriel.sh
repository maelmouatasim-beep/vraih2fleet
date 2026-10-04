#!/usr/bin/env bash
# Retire une adresse courriel de TOUT l'historique git (métadonnées des
# commits ET contenu des fichiers), sur une COPIE miroir du dépôt.
#
# Par défaut : SIMULATION — rien n'est poussé ; le script affiche des
# COMPTES (jamais l'adresse) avant / après et échoue s'il en reste.
# Avec --pousser : réécrit GitHub (push forcé de toutes les branches et
# étiquettes). À ne lancer qu'avec l'accord explicite du propriétaire,
# après lecture de docs/historique-git.md.
#
#   ANCIENNE_ADRESSE='…' NOUVELLE_ADRESSE='ID+login@users.noreply.github.com' \
#     scripts/historique/nettoyer-courriel.sh <url-ou-chemin-du-dépôt> [--pousser]
#
# L'adresse n'est lue que dans l'environnement : jamais en argument (elle
# finirait dans l'historique du terminal), jamais écrite dans le dépôt.
set -euo pipefail

SOURCE="${1:?usage : nettoyer-courriel.sh <url-ou-chemin> [--pousser]}"
POUSSER="${2:-}"
: "${ANCIENNE_ADRESSE:?définir ANCIENNE_ADRESSE (variable d environnement)}"
: "${NOUVELLE_ADRESSE:?définir NOUVELLE_ADRESSE (adresse noreply GitHub)}"
REMPLACEMENT_TEXTE="${REMPLACEMENT_TEXTE:-adresse-retiree@example.invalid}"

git filter-repo --version >/dev/null 2>&1 || { echo "git-filter-repo absent : pipx install git-filter-repo" >&2; exit 2; }

TRAVAIL="$(mktemp -d "${TMPDIR:-/tmp}/nettoyage-historique.XXXXXX")"
chmod 700 "$TRAVAIL"
echo "Dossier de travail : $TRAVAIL"
git clone --quiet --mirror "$SOURCE" "$TRAVAIL/depot.git"
cd "$TRAVAIL/depot.git"

# Sauvegarde intégrale AVANT réécriture (contient encore l'adresse : à
# garder hors ligne, puis à supprimer une fois la réécriture validée).
git bundle create --quiet "$TRAVAIL/sauvegarde-avant-nettoyage.bundle" --all

compter() {
  local meta contenu
  meta=$(git log --all --format='%ae%n%ce' | grep -cF -- "$ANCIENNE_ADRESSE" || true)
  contenu=$(git rev-list --all | while read -r c; do git grep -lF -- "$ANCIENNE_ADRESSE" "$c" 2>/dev/null || true; done | wc -l)
  messages=$(git log --all --format='%B' | grep -cF -- "$ANCIENNE_ADRESSE" || true)
  echo "$meta $contenu $messages"
}

read -r M1 C1 G1 <<<"$(compter)"
echo "Avant : métadonnées $M1 · fichiers (toutes versions) $C1 · messages $G1"

umask 077
printf '<%s> <%s>\n' "$NOUVELLE_ADRESSE" "$ANCIENNE_ADRESSE" > "$TRAVAIL/mailmap"
printf '%s==>%s\n' "$ANCIENNE_ADRESSE" "$REMPLACEMENT_TEXTE" > "$TRAVAIL/remplacements"
git filter-repo --quiet --force \
  --mailmap "$TRAVAIL/mailmap" \
  --replace-text "$TRAVAIL/remplacements" \
  --replace-message "$TRAVAIL/remplacements"
rm -f "$TRAVAIL/mailmap" "$TRAVAIL/remplacements"

read -r M2 C2 G2 <<<"$(compter)"
echo "Après : métadonnées $M2 · fichiers (toutes versions) $C2 · messages $G2"
if [ "$M2" != 0 ] || [ "$C2" != 0 ] || [ "$G2" != 0 ]; then
  echo "ÉCHEC : l'adresse est encore présente — rien n'a été poussé." >&2
  exit 1
fi
echo "Branches réécrites : $(git for-each-ref --format='%(refname:short)' refs/heads | tr '\n' ' ')"

if [ "$POUSSER" != "--pousser" ]; then
  echo "Simulation terminée : rien n'a été poussé. Relancer avec --pousser pour réécrire GitHub."
  exit 0
fi

echo "Réécriture de $SOURCE (push forcé de toutes les branches et étiquettes)…"
git push --force "$SOURCE" 'refs/heads/*:refs/heads/*'
git push --force "$SOURCE" 'refs/tags/*:refs/tags/*' 2>/dev/null || true
echo "Terminé. Sauvegarde : $TRAVAIL/sauvegarde-avant-nettoyage.bundle (à supprimer après validation)."

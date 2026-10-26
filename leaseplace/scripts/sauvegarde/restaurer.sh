#!/usr/bin/env bash
# Restauration d'une sauvegarde chiffrée dans une base VIDE (jamais par-dessus
# la base de production : on restaure à côté, on vérifie, puis on bascule).
# Usage : restaurer.sh <fichier.dump.enc> <url de la base cible>
# Les rôles lp_app et lp_auth doivent exister sur le serveur cible.
set -euo pipefail

FILE="${1:?fichier de sauvegarde requis}"
TARGET="${2:?URL de la base cible requise}"
: "${LP_BACKUP_PASSPHRASE:?LP_BACKUP_PASSPHRASE requis}"

case "$TARGET" in
  *localhost*|*127.0.0.1*) ;;
  *)
    if [ "${LP_RESTORE_CONFIRM:-}" != "oui" ]; then
      echo "Cible distante : relancer avec LP_RESTORE_CONFIRM=oui après vérification." >&2
      exit 1
    fi
    ;;
esac

( cd "$(dirname "$FILE")" && sha256sum --check --quiet "$(basename "$FILE").sha256" )
TABLES="$(psql "$TARGET" -Atc "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')")"
if [ "$TABLES" != "0" ]; then
  echo "Refus : la base cible n'est pas vide ($TABLES tables)." >&2
  exit 1
fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:LP_BACKUP_PASSPHRASE -in "$FILE" \
  | pg_restore --exit-on-error --dbname="$TARGET"
echo "Restauration terminée dans la base cible."

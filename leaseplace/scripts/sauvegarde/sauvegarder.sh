#!/usr/bin/env bash
# Sauvegarde chiffrée de la base (quotidienne, lancée par le planificateur
# de l'hébergeur). Format pg_dump personnalisé, chiffré AES-256 (clé dérivée
# de LP_BACKUP_PASSPHRASE, PBKDF2) et empreinte SHA-256 du fichier chiffré.
# Les sauvegardes plus anciennes que LP_BACKUP_KEEP_DAYS sont supprimées.
#
# Variables : DATABASE_URL_ADMIN, LP_BACKUP_PASSPHRASE (32 caractères min.),
# LP_BACKUP_DIR (défaut ./sauvegardes), LP_BACKUP_KEEP_DAYS (défaut 35).
set -euo pipefail

: "${DATABASE_URL_ADMIN:?DATABASE_URL_ADMIN requis}"
: "${LP_BACKUP_PASSPHRASE:?LP_BACKUP_PASSPHRASE requis}"
if [ "${#LP_BACKUP_PASSPHRASE}" -lt 32 ]; then
  echo "LP_BACKUP_PASSPHRASE : 32 caractères minimum" >&2
  exit 1
fi
DIR="${LP_BACKUP_DIR:-./sauvegardes}"
KEEP="${LP_BACKUP_KEEP_DAYS:-35}"
mkdir -p "$DIR"
chmod 700 "$DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DIR/leaseplace-$STAMP.dump.enc"
umask 077
# Le dump en clair ne touche jamais le disque : chiffrement à la volée.
pg_dump --format=custom --compress=6 "$DATABASE_URL_ADMIN" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:LP_BACKUP_PASSPHRASE -out "$OUT"
( cd "$DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )

find "$DIR" -name 'leaseplace-*.dump.enc*' -type f -mtime +"$KEEP" -delete
echo "Sauvegarde : $OUT ($(du -h "$OUT" | cut -f1))"

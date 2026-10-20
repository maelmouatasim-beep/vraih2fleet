#!/usr/bin/env bash
# Prépare une base Postgres LOCALE (dev + tests) : bases leaseplace et
# leaseplace_test, migrations, mots de passe de développement des rôles
# lp_app / lp_auth. Ne jamais pointer ce script sur une base hébergée.
set -euo pipefail

ADMIN_URL="${PG_ADMIN_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
case "$ADMIN_URL" in
  *localhost*|*127.0.0.1*) ;;
  *) echo "Refus : PG_ADMIN_URL doit viser localhost" >&2; exit 1 ;;
esac
BASE="${ADMIN_URL%/*}"

for db in leaseplace leaseplace_test; do
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1 \
    || psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db"
  DATABASE_URL_ADMIN="$BASE/$db" pnpm --filter @leaseplace/db migrate
done

# Les rôles sont globaux au serveur : un seul jeu de mots de passe locaux.
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE lp_app WITH LOGIN PASSWORD 'lp_app_local'" \
  -c "ALTER ROLE lp_auth WITH LOGIN PASSWORD 'lp_auth_local'"

echo "Base locale prête. Copier .env.example vers apps/web/.env.local puis : pnpm db:seed"

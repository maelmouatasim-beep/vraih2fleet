#!/usr/bin/env bash
# Vérifie une restauration : mêmes volumes que la source sur les tables
# métier, chaîne du journal d'audit intacte, RLS active partout, migrations
# au même niveau. Usage : verifier.sh <url source> <url restaurée>
set -euo pipefail

SOURCE="${1:?URL source requise}"
RESTORED="${2:?URL restaurée requise}"

COUNTS="select string_agg(t || '=' || n, ' ' order by t) from (
  select 'organizations' t, count(*) n from identity.organizations union all
  select 'users', count(*) from identity.users union all
  select 'requests', count(*) from credit.financing_requests union all
  select 'documents', count(*) from kyc.documents union all
  select 'consents', count(*) from kyc.consents union all
  select 'offers', count(*) from market.offers union all
  select 'deals', count(*) from market.deals union all
  select 'commissions', count(*) from billing.commissions union all
  select 'invoices', count(*) from billing.invoices union all
  select 'audit', count(*) from audit.events) x"
MIGRATIONS="select count(*) from drizzle.__drizzle_migrations"

src="$(psql "$SOURCE" -Atc "$COUNTS") migrations=$(psql "$SOURCE" -Atc "$MIGRATIONS")"
dst="$(psql "$RESTORED" -Atc "$COUNTS") migrations=$(psql "$RESTORED" -Atc "$MIGRATIONS")"
echo "source    : $src"
echo "restaurée : $dst"
[ "$src" = "$dst" ] || { echo "ÉCHEC : volumes différents" >&2; exit 1; }

broken="$(psql "$RESTORED" -Atc "select coalesce(audit.verify_chain()::text, 'intacte')")"
[ "$broken" = "intacte" ] || { echo "ÉCHEC : chaîne d'audit rompue à la ligne $broken" >&2; exit 1; }

norls="$(psql "$RESTORED" -Atc "select count(*) from pg_tables where schemaname in
  ('identity','audit','dev','marketing','kyc','credit','market','billing','privacy') and not rowsecurity")"
[ "$norls" = "0" ] || { echo "ÉCHEC : $norls tables sans RLS" >&2; exit 1; }

echo "Restauration vérifiée : volumes identiques, chaîne d'audit intacte, RLS active."

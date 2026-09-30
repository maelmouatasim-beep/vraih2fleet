-- Tâches planifiées H2Fleet (pg_cron + pg_net) — à exécuter UNE fois dans
-- le SQL Editor du projet hébergé, APRÈS avoir créé les deux secrets du
-- Vault (Integrations → Vault → Add new secret) :
--   h2fleet_project_url  = https://<ref>.supabase.co   (sans / final)
--   h2fleet_cron_secret  = la MÊME valeur que le secret de fonction CRON_SECRET
-- Aucune valeur secrète dans ce fichier : les tâches lisent le Vault à
-- chaque exécution. Idempotent : relancer le script met les tâches à jour
-- (cron.schedule remplace une tâche du même nom).
-- Pas une migration : en local et en CI, ces appels HTTP n'ont pas de cible.

-- Rappels d'échéances de subventions : chaque jour à 7 h 45 (heure de
-- l'Est, 11 h 45 UTC en été / 12 h 45 en hiver — pg_cron est en UTC).
select cron.schedule(
  'h2fleet-notify-subsidy-deadlines',
  '45 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'h2fleet_project_url')
           || '/functions/v1/notify-subsidy-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'h2fleet_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Synchronisation télématique de toutes les connexions actives : toutes
-- les 6 heures (mode cron de sync-telematics-data, sans corps).
select cron.schedule(
  'h2fleet-sync-telematics',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'h2fleet_project_url')
           || '/functions/v1/sync-telematics-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'h2fleet_cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Purge du journal technique de limite de débit (fenêtres de 10 et 60 min :
-- rien d'utile au-delà d'un jour). Aucune donnée métier.
select cron.schedule(
  'h2fleet-purge-rate-limit',
  '30 3 * * *',
  $$ delete from public.rate_limit_events where created_at < now() - interval '1 day' $$
);

-- Contrôle : les trois tâches, et les derniers passages.
select jobname, schedule, active from cron.job where jobname like 'h2fleet-%' order by jobname;
-- select j.jobname, d.status, d.return_message, d.start_time
--   from cron.job_run_details d join cron.job j using (jobid)
--   order by d.start_time desc limit 10;

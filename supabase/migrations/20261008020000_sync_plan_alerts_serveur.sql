-- Recalcul PLANIFIÉ des alertes du plan côté serveur (chaque nuit,
-- .github/workflows/recalcul-alertes.yml → src/lib/journey/recalculAlertesServeur.ts,
-- même code que l'écran : src/lib/journey/surveillanceProjet.ts).
-- Jusqu'ici les alertes n'entraient dans la cloche que lorsqu'un éditeur
-- ouvrait le projet. Même logique que sync_plan_alerts, sans la
-- vérification du droit d'édition (pas d'utilisateur) : réservée au rôle
-- service_role, jamais exécutable par anon ni authenticated.
-- Migration ADDITIVE ; aucune suppression.
CREATE OR REPLACE FUNCTION public.sync_plan_alerts_serveur(_project UUID, _alerts JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _project) THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(_alerts) <> 'array' OR jsonb_array_length(_alerts) > 200 THEN
    RAISE EXCEPTION 'liste d''alertes invalide' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.plan_alerts (project_id, alert_key, kind, severity, title_fr, title_en, message_fr, message_en)
  SELECT _project, x.alert_key, x.kind, x.severity, x.title_fr, x.title_en, x.message_fr, x.message_en
  FROM jsonb_to_recordset(_alerts) AS x(alert_key TEXT, kind TEXT, severity TEXT, title_fr TEXT, title_en TEXT, message_fr TEXT, message_en TEXT)
  ON CONFLICT (project_id, alert_key) DO UPDATE
    SET severity = EXCLUDED.severity,
        title_fr = EXCLUDED.title_fr, title_en = EXCLUDED.title_en,
        message_fr = EXCLUDED.message_fr, message_en = EXCLUDED.message_en,
        last_seen_at = now(),
        resolved_at = NULL;

  UPDATE public.plan_alerts
     SET resolved_at = now()
   WHERE project_id = _project
     AND resolved_at IS NULL
     AND alert_key NOT IN (SELECT x->>'alert_key' FROM jsonb_array_elements(_alerts) AS x);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_plan_alerts_serveur(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_plan_alerts_serveur(UUID, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_plan_alerts_serveur(UUID, JSONB) TO service_role;

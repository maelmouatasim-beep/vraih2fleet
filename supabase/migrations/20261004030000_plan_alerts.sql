-- =====================================================
-- Phase 5, point 6 — SURVEILLANCE DU PLAN.
-- Les alertes sont CALCULÉES par le moteur dans l'application
-- (src/lib/journey/surveillance.ts, déterministe). Cette table en garde
-- l'ÉTAT par projet : première et dernière détection, résolution, « vue »
-- (qui, quand) et envoi par courriel (fonction plan-alerts-digest, quand
-- SendGrid sera branché). Chaque alerte a une clé qui change avec les
-- données : une situation qui évolue redevient une alerte active.
-- Migration ADDITIVE ; RLS dès la création ; aucune suppression.
-- =====================================================

CREATE TABLE public.plan_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  alert_key TEXT NOT NULL CHECK (char_length(alert_key) BETWEEN 1 AND 300),
  kind TEXT NOT NULL CHECK (kind IN ('donnees_energie', 'echeance_subvention', 'remplacement_retard', 'programme_modifie', 'capacite_garage')),
  severity TEXT NOT NULL CHECK (severity IN ('critique', 'attention', 'info')),
  -- Textes rendus (fr/en) au moment de la détection, pour le courriel.
  title_fr TEXT NOT NULL CHECK (char_length(title_fr) BETWEEN 1 AND 300),
  title_en TEXT NOT NULL CHECK (char_length(title_en) BETWEEN 1 AND 300),
  message_fr TEXT NOT NULL CHECK (char_length(message_fr) <= 1500),
  message_en TEXT NOT NULL CHECK (char_length(message_en) <= 1500),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  emailed_at TIMESTAMPTZ,
  UNIQUE (project_id, alert_key)
);

CREATE INDEX idx_plan_alerts_active ON public.plan_alerts(project_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_plan_alerts_to_email ON public.plan_alerts(first_seen_at)
  WHERE resolved_at IS NULL AND dismissed_at IS NULL AND emailed_at IS NULL;

ALTER TABLE public.plan_alerts ENABLE ROW LEVEL SECURITY;

-- Lecture : quiconque voit le projet. Aucune écriture directe : les
-- fonctions ci-dessous vérifient le droit d'ÉDITION du projet.
CREATE POLICY "plan alerts: project viewers read"
  ON public.plan_alerts FOR SELECT
  TO authenticated
  USING (public.can_view_project(project_id, auth.uid()));

-- Synchronisation de l'état : insère les nouvelles clés, rafraîchit les
-- clés encore présentes (et les réactive si elles étaient résolues),
-- marque résolues les clés absentes. Renvoie false (sans rien écrire) si
-- l'utilisateur ne peut pas éditer le projet (lecteur : alertes calculées
-- et affichées, état non enregistré).
CREATE OR REPLACE FUNCTION public.sync_plan_alerts(_project UUID, _alerts JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_edit_project(_project, auth.uid()) THEN
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

-- « Marquer comme vue » : éditeurs du projet ; trace qui et quand.
CREATE OR REPLACE FUNCTION public.dismiss_plan_alert(_alert UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p UUID;
BEGIN
  SELECT project_id INTO _p FROM public.plan_alerts WHERE id = _alert;
  IF _p IS NULL OR NOT public.can_edit_project(_p, auth.uid()) THEN
    RAISE EXCEPTION 'alerte introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;
  UPDATE public.plan_alerts
     SET dismissed_at = now(), dismissed_by = auth.uid()
   WHERE id = _alert AND dismissed_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_plan_alerts(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_plan_alert(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_plan_alerts(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_plan_alert(UUID) TO authenticated;

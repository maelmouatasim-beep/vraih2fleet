-- =====================================================
-- Phase 5, point 2 — IA (fournisseur : API Claude d'Anthropic, via la
-- fonction Edge `copilot` ; clé ANTHROPIC_API_KEY côté serveur seulement).
--
-- 1. organization_ai_settings : chaque fonction IA est ACTIVABLE par
--    organisation (désactivée par défaut — Loi 25 : un administrateur
--    l'active en connaissance de cause, les données nécessaires étant
--    transmises à Anthropic, hors Québec) + limites de débit et de coût.
-- 2. ai_usage_events : jetons consommés par appel (organisation, membre,
--    fonction, modèle) — aucune donnée de contenu. Écrit par la fonction
--    Edge (rôle service), lu par les administrateurs de l'organisation.
-- 3. copilot_messages : historique du copilote PAR PROJET, visible par
--    l'équipe ; seules les réponses dont les nombres ont été vérifiés
--    sont enregistrées.
-- Migration additive.
-- =====================================================

CREATE TABLE public.organization_ai_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  copilot_enabled BOOLEAN NOT NULL DEFAULT false,
  smart_import_enabled BOOLEAN NOT NULL DEFAULT false,
  document_reading_enabled BOOLEAN NOT NULL DEFAULT false,
  council_note_enabled BOOLEAN NOT NULL DEFAULT false,
  -- plafonds par organisation
  monthly_token_limit INTEGER NOT NULL DEFAULT 3000000 CHECK (monthly_token_limit BETWEEN 0 AND 100000000),
  daily_request_limit INTEGER NOT NULL DEFAULT 300 CHECK (daily_request_limit BETWEEN 0 AND 100000),
  updated_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read AI settings"
  ON public.organization_ai_settings FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins create AI settings"
  ON public.organization_ai_settings FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Admins update AI settings"
  ON public.organization_ai_settings FOR UPDATE
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.ai_settings_touch()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ai_settings_touch
  BEFORE INSERT OR UPDATE ON public.organization_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.ai_settings_touch();

-- =====================================================
CREATE TABLE public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  feature TEXT NOT NULL CHECK (feature IN ('copilote', 'import', 'document', 'note_conseil', 'veille')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cache_read_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),
  cache_write_tokens INTEGER NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_org_date ON public.ai_usage_events(organization_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Aucune policy INSERT : seule la fonction Edge (rôle service) écrit.
CREATE POLICY "Admins read AI usage"
  ON public.ai_usage_events FOR SELECT
  USING (public.is_org_admin(organization_id, auth.uid()));

-- Consommation agrégée (mois courant, jour courant) : lisible par tout
-- membre de l'organisation (jauge), sans détail par personne.
CREATE OR REPLACE FUNCTION public.ai_usage_summary(_org UUID)
RETURNS TABLE (
  month_input_tokens BIGINT,
  month_output_tokens BIGINT,
  month_cache_read_tokens BIGINT,
  month_requests BIGINT,
  today_requests BIGINT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(input_tokens + cache_write_tokens) FILTER (WHERE created_at >= date_trunc('month', now())), 0),
    COALESCE(SUM(output_tokens) FILTER (WHERE created_at >= date_trunc('month', now())), 0),
    COALESCE(SUM(cache_read_tokens) FILTER (WHERE created_at >= date_trunc('month', now())), 0),
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())),
    COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now()))
  FROM ai_usage_events
  WHERE organization_id = _org
    AND (auth.uid() IS NULL OR is_org_member(_org, auth.uid()));
$$;

-- =====================================================
CREATE TABLE public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  -- outils appelés et sources citées (étape, hypothèse, date) ; nombres vérifiés
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  verified_numbers INTEGER,
  -- proposition d'action jointe (aperçu avant → après), jamais appliquée ici
  proposal JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_messages_project ON public.copilot_messages(project_id, created_at);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project viewers read the copilot history"
  ON public.copilot_messages FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Project viewers add to the copilot history"
  ON public.copilot_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.can_view_project(project_id, auth.uid()));

-- Effacement (Loi 25) : l'auteur ou un administrateur de l'organisation.
CREATE POLICY "Authors or org admins delete copilot messages"
  ON public.copilot_messages FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND p.organization_id IS NOT NULL AND public.is_org_admin(p.organization_id, auth.uid())
    )
  );

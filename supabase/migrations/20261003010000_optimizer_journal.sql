-- =====================================================
-- Phase 5, point 1 — Optimiseur de calendrier + JOURNAL DES ACTIONS.
--
-- 1. Le projet garde les contraintes saisies pour l'optimiseur et, une
--    fois la stratégie « optimisee » appliquée, l'assignation retenue
--    (année + technologie par véhicule, avec l'année prévue d'origine) :
--    le Plan, le PDF et l'Excel nomment la stratégie réellement retenue
--    et comptent les écarts depuis son application.
-- 2. 4e stratégie « optimisee » acceptée par les contraintes CHECK.
-- 3. Journal des actions (Phase 5, règle non négociable : « chaque
--    action est journalisée — qui, quand, quoi ») : une ligne IMMUABLE
--    par modification appliquée après confirmation (stratégie,
--    optimiseur, copilote, import, document…), avec l'aperçu avant →
--    après. Loi 25 : aucune donnée personnelle dans `details` (identifiants
--    de véhicules et valeurs du plan seulement) ; l'auteur est l'id du
--    compte (auth.uid()), jamais un nom ou un courriel copié.
-- Migration additive : aucune donnée existante supprimée.
-- =====================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS optimizer_constraints JSONB,
  ADD COLUMN IF NOT EXISTS optimized_assignment JSONB;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_selected_strategy_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_selected_strategy_check
  CHECK (selected_strategy IN ('plan_actuel', 'tout_electrique', 'economies_d_abord', 'optimisee'));

ALTER TABLE public.report_snapshots DROP CONSTRAINT IF EXISTS report_snapshots_strategy_key_check;
ALTER TABLE public.report_snapshots
  ADD CONSTRAINT report_snapshots_strategy_key_check
  CHECK (strategy_key IN ('plan_actuel', 'tout_electrique', 'economies_d_abord', 'optimisee'));

-- =====================================================
-- Journal des actions
-- =====================================================
CREATE TABLE public.plan_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- null = action au niveau de l'organisation (Ma flotte, garages)
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  source TEXT NOT NULL CHECK (source IN ('strategie', 'optimiseur', 'copilote', 'import', 'document', 'veille', 'manuel')),
  action TEXT NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 120),
  -- résumé lisible (ex. « 12 véhicules : année et technologie »)
  summary TEXT CHECK (summary IS NULL OR length(summary) <= 500),
  -- aperçu avant → après : [{ cible, avant, apres }]
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_change_log_project ON public.plan_change_log(project_id, created_at DESC);
CREATE INDEX idx_plan_change_log_org ON public.plan_change_log(organization_id, created_at DESC);

-- L'organisation d'une action de projet est TOUJOURS celle du projet.
CREATE OR REPLACE FUNCTION public.plan_change_log_set_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org UUID;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT organization_id INTO _org FROM projects WHERE id = NEW.project_id;
    IF _org IS NULL THEN
      RAISE EXCEPTION 'projet sans organisation' USING ERRCODE = '42501';
    END IF;
    NEW.organization_id := _org;
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER plan_change_log_set_org
  BEFORE INSERT ON public.plan_change_log
  FOR EACH ROW EXECUTE FUNCTION public.plan_change_log_set_org();

ALTER TABLE public.plan_change_log ENABLE ROW LEVEL SECURITY;

-- Lecture : membres de l'organisation (et, pour une action de projet,
-- personnes ayant accès au projet).
CREATE POLICY "Members can read the change log"
  ON public.plan_change_log FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (project_id IS NULL OR public.can_view_project(project_id, auth.uid()))
  );

-- Écriture : uniquement pour soi-même, et seulement si l'on peut
-- modifier le projet (ou écrire dans l'organisation pour une action
-- hors projet). Aucune policy UPDATE/DELETE : le journal est immuable.
CREATE POLICY "Writers append to the change log"
  ON public.plan_change_log FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (project_id IS NOT NULL AND public.can_edit_project(project_id, auth.uid()))
      OR (project_id IS NULL AND public.is_org_writer(organization_id, auth.uid()))
    )
  );

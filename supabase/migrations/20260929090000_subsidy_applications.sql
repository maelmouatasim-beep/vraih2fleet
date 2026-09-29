-- =====================================================
-- Revue externe C5 : suivi des DEMANDES de subvention par programme
-- (à préparer → déposée → accordée → reçue), avec montants et dates.
-- L'échéance affichée vient de la tâche générée du plan
-- (auto_key subvention:vehicule:programme) ou de la date de fin du
-- programme. Migration ADDITIVE ; RLS dès la création.
-- =====================================================
CREATE TABLE public.subsidy_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- NULL = demande globale du projet (programme par flotte)
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  -- id du registre (pave, ecocamionnage_v1, pagtcp…) ou 'autre' + libellé
  program_id TEXT NOT NULL CHECK (char_length(program_id) BETWEEN 1 AND 60),
  label TEXT CHECK (label IS NULL OR char_length(label) <= 200),
  status TEXT NOT NULL DEFAULT 'a_preparer'
    CHECK (status IN ('a_preparer', 'deposee', 'accordee', 'recue')),
  amount_requested NUMERIC CHECK (amount_requested IS NULL OR (amount_requested >= 0 AND amount_requested < 100000000)),
  amount_awarded NUMERIC CHECK (amount_awarded IS NULL OR (amount_awarded >= 0 AND amount_awarded < 100000000)),
  submitted_date DATE,
  decision_date DATE,
  received_date DATE,
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subsidy_applications_project ON public.subsidy_applications(project_id);
CREATE INDEX idx_subsidy_applications_vehicle ON public.subsidy_applications(vehicle_id);

CREATE TRIGGER trg_subsidy_applications_updated_at
  BEFORE UPDATE ON public.subsidy_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subsidy_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subsidy applications: project viewers can read"
  ON public.subsidy_applications FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "subsidy applications: project editors can insert"
  ON public.subsidy_applications FOR INSERT
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "subsidy applications: project editors can update"
  ON public.subsidy_applications FOR UPDATE
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "subsidy applications: project editors can delete"
  ON public.subsidy_applications FOR DELETE
  USING (public.can_edit_project(project_id, auth.uid()));

-- =====================================================
-- Revue externe C4 : marquer un remplacement RÉALISÉ sur la ligne
-- project_vehicles (date, véhicule acquis, coût réel) pour alimenter le
-- réalisé-vs-prévu de l'étape Suivi. Migration additive ; RLS existante
-- (can_view_project / can_edit_project) inchangée.
-- =====================================================
ALTER TABLE public.project_vehicles
  ADD COLUMN IF NOT EXISTS completed_date DATE,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC CHECK (actual_cost IS NULL OR actual_cost >= 0),
  ADD COLUMN IF NOT EXISTS acquired_vehicle TEXT
    CHECK (acquired_vehicle IS NULL OR char_length(acquired_vehicle) <= 300);

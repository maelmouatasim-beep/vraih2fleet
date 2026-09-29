-- =====================================================
-- Revue externe C3 : la stratégie RETENUE par le client est enregistrée
-- sur le projet (affichée à l'étape Stratégies et dans le plan), avec la
-- date d'application au plan. Migration additive, RLS existante des
-- projets inchangée (policy UPDATE déjà en place, colonnes sensibles
-- verrouillées par le trigger verrouiller_transfert_projet).
-- =====================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS selected_strategy TEXT
    CHECK (selected_strategy IN ('plan_actuel', 'tout_electrique', 'economies_d_abord')),
  ADD COLUMN IF NOT EXISTS strategy_applied_at TIMESTAMP WITH TIME ZONE;

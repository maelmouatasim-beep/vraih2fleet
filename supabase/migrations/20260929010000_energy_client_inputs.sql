-- =====================================================
-- Données client de prix de l'énergie (revue A1c) : la couche la plus
-- FORTE des trois couches de prix (§3.3 v2.2 de la méthodologie).
-- Une ligne par organisation (project_id NULL) et, au besoin, une ligne
-- par projet (prioritaire sur celle de l'organisation). Tous les
-- montants s'entendent AVANT TPS/TVQ (comme toutes les entrées du
-- moteur — §3.1 v2.2) ; le diesel comprend les accises.
-- Migration ADDITIVE ; RLS dès la création.
-- =====================================================
CREATE TABLE public.energy_client_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = valeurs par défaut de l'organisation ; sinon surcharge projet
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Prix carburant réellement payé ($/L avant TPS/TVQ, accises comprises)
  diesel_price_per_l NUMERIC CHECK (diesel_price_per_l IS NULL OR (diesel_price_per_l > 0 AND diesel_price_per_l < 20)),
  -- Coût effectif au compteur du dépôt ($/kWh avant taxes : énergie +
  -- prime de puissance amortie, dérivé d'une facture HQ)
  electricity_cost_per_kwh NUMERIC CHECK (electricity_cost_per_kwh IS NULL OR (electricity_cost_per_kwh > 0 AND electricity_cost_per_kwh < 5)),
  -- Prix H2 livré ($/kg avant taxes, devis fournisseur)
  h2_price_per_kg NUMERIC CHECK (h2_price_per_kg IS NULL OR (h2_price_per_kg > 0 AND h2_price_per_kg < 200)),
  -- Devis de raccordement du dépôt ($ avant taxes, devis HQ/entrepreneur)
  grid_connection_quote NUMERIC CHECK (grid_connection_quote IS NULL OR (grid_connection_quote >= 0 AND grid_connection_quote < 100000000)),
  -- Provenance en clair (ex. « facture HQ mars 2026 », « contrat carburant 2026 »)
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une seule ligne « organisation » et une seule ligne par projet
CREATE UNIQUE INDEX uq_energy_client_inputs_org
  ON public.energy_client_inputs(organization_id) WHERE project_id IS NULL;
CREATE UNIQUE INDEX uq_energy_client_inputs_project
  ON public.energy_client_inputs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_energy_client_inputs_org ON public.energy_client_inputs(organization_id);

CREATE TRIGGER trg_energy_client_inputs_updated_at
  BEFORE UPDATE ON public.energy_client_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cohérence : la ligne projet doit appartenir à l'organisation du projet
CREATE OR REPLACE FUNCTION public.check_energy_input_project_org()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = NEW.project_id
        AND (p.organization_id = NEW.organization_id OR p.organization_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'le projet n''appartient pas à cette organisation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_energy_client_inputs_project_org
  BEFORE INSERT OR UPDATE ON public.energy_client_inputs
  FOR EACH ROW EXECUTE FUNCTION public.check_energy_input_project_org();

-- =====================================================
-- RLS : lecture pour tout membre (ou accès projet), écriture pour les
-- rôles d'écriture (admin/member) — les readers ne modifient rien.
-- =====================================================
ALTER TABLE public.energy_client_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "energy inputs: members and project viewers can read"
  ON public.energy_client_inputs FOR SELECT
  USING (
    public.is_org_member(organization_id, auth.uid())
    OR (project_id IS NOT NULL AND public.can_view_project(project_id, auth.uid()))
  );

CREATE POLICY "energy inputs: org writers can insert"
  ON public.energy_client_inputs FOR INSERT
  WITH CHECK (
    public.is_org_writer(organization_id, auth.uid())
    AND (project_id IS NULL OR public.can_edit_project(project_id, auth.uid()))
  );

CREATE POLICY "energy inputs: org writers can update"
  ON public.energy_client_inputs FOR UPDATE
  USING (public.is_org_writer(organization_id, auth.uid()))
  WITH CHECK (
    public.is_org_writer(organization_id, auth.uid())
    AND (project_id IS NULL OR public.can_edit_project(project_id, auth.uid()))
  );

CREATE POLICY "energy inputs: org writers can delete"
  ON public.energy_client_inputs FOR DELETE
  USING (public.is_org_writer(organization_id, auth.uid()));

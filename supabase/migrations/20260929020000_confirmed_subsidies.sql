-- =====================================================
-- Subventions CONFIRMÉES par le client (demande utilisateur, bloc B) :
-- pour les programmes non chiffrables automatiquement (PAGTCP, FTCZE,
-- pourcentage Écocamionnage classes 5-8 à valider…), le client saisit
-- le montant confirmé AVEC LA RÉFÉRENCE DU DOCUMENT (lettre d'octroi,
-- décision). Le moteur l'utilise EN PRIORITÉ : elle remplace la
-- subvention résolue automatiquement du même programme pour ce
-- véhicule, et elle est marquée « confirmée par le client (réf. …) »
-- dans le Financement, le PDF et le classeur Excel.
-- Migration ADDITIVE ; RLS dès la création.
-- =====================================================
CREATE TABLE public.confirmed_subsidies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  -- id du registre (pagtcp, ftcze, ecocamionnage_v1, pave, roulez_vert…)
  -- ou 'autre' avec un libellé libre
  program_id TEXT NOT NULL CHECK (char_length(program_id) BETWEEN 1 AND 60),
  label TEXT CHECK (label IS NULL OR char_length(label) <= 200),
  amount NUMERIC NOT NULL CHECK (amount > 0 AND amount < 100000000),
  -- Année CALENDAIRE de versement prévue ; NULL = année d'achat du véhicule
  payment_year INTEGER CHECK (payment_year IS NULL OR (payment_year BETWEEN 2000 AND 2100)),
  -- Référence du document qui confirme le montant (obligatoire) :
  -- numéro de lettre d'octroi, décision, entente…
  document_reference TEXT NOT NULL CHECK (char_length(document_reference) BETWEEN 1 AND 500),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- une confirmation par programme et par véhicule d'un projet
  UNIQUE (project_id, vehicle_id, program_id)
);

CREATE INDEX idx_confirmed_subsidies_project ON public.confirmed_subsidies(project_id);
CREATE INDEX idx_confirmed_subsidies_vehicle ON public.confirmed_subsidies(vehicle_id);

CREATE TRIGGER trg_confirmed_subsidies_updated_at
  BEFORE UPDATE ON public.confirmed_subsidies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.confirmed_subsidies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confirmed subsidies: project viewers can read"
  ON public.confirmed_subsidies FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "confirmed subsidies: project editors can insert"
  ON public.confirmed_subsidies FOR INSERT
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "confirmed subsidies: project editors can update"
  ON public.confirmed_subsidies FOR UPDATE
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "confirmed subsidies: project editors can delete"
  ON public.confirmed_subsidies FOR DELETE
  USING (public.can_edit_project(project_id, auth.uid()));

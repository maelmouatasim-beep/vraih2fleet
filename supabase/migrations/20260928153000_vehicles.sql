-- Phase 2b de la refonte : « Ma flotte » — la flotte réelle, une ligne
-- par véhicule, au niveau de l'ORGANISATION (jusqu'ici la flotte
-- n'existait qu'en pourcentages par catégorie dans les scénarios).
-- project_vehicles relie un projet aux véhicules qu'il inclut, avec
-- l'année de remplacement et la technologie cible PAR VÉHICULE.

-- =====================================================
-- 1. Table vehicles
-- =====================================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- identité
  unit_number TEXT NOT NULL,
  vin TEXT,
  make TEXT,
  model TEXT,
  model_year INTEGER CHECK (model_year IS NULL OR (model_year BETWEEN 1950 AND 2100)),
  in_service_date DATE,
  -- classification (catégories alignées sur le moteur TCO — src/lib/tco)
  category TEXT NOT NULL CHECK (category IN (
    'vehicule_leger', 'camionnette', 'camion_moyen', 'camion_lourd',
    'autobus_urbain_12m', 'autre'
  )),
  fuel_type TEXT NOT NULL DEFAULT 'diesel' CHECK (fuel_type IN (
    'diesel', 'essence', 'hybride', 'phev', 'bev', 'fcev', 'gnc', 'propane', 'autre'
  )),
  -- exploitation
  annual_km NUMERIC CHECK (annual_km IS NULL OR annual_km >= 0),
  -- consommation RÉELLE dans l'unité native du carburant
  -- (L/100 km, kWh/100 km ou kg H2/100 km)
  consumption_per_100km NUMERIC CHECK (consumption_per_100km IS NULL OR consumption_per_100km > 0),
  -- provenance de la consommation : jamais de valeur inventée —
  -- « estimation » = défaut de catégorie du moteur TCO, affiché comme tel
  consumption_source TEXT NOT NULL DEFAULT 'estimation'
    CHECK (consumption_source IN ('saisie', 'telematique', 'estimation')),
  usage_profile TEXT CHECK (usage_profile IS NULL OR usage_profile IN (
    'urbain', 'regional', 'longue_distance', 'mixte', 'hors_route'
  )),
  department TEXT,
  depot TEXT,
  status TEXT NOT NULL DEFAULT 'actif'
    CHECK (status IN ('actif', 'inactif', 'reforme', 'vendu')),
  -- lien télématique (source de vérité de la consommation quand présent)
  telematics_vehicle_id UUID REFERENCES public.telematics_vehicles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, unit_number)
);

CREATE INDEX idx_vehicles_organization ON public.vehicles(organization_id);
CREATE INDEX idx_vehicles_telematics ON public.vehicles(telematics_vehicle_id);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view fleet"
  ON public.vehicles FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org writers can add vehicles"
  ON public.vehicles FOR INSERT
  WITH CHECK (public.is_org_writer(organization_id, auth.uid()));

CREATE POLICY "Org writers can update vehicles"
  ON public.vehicles FOR UPDATE
  USING (public.is_org_writer(organization_id, auth.uid()));

CREATE POLICY "Org writers can delete vehicles"
  ON public.vehicles FOR DELETE
  USING (public.is_org_writer(organization_id, auth.uid()));

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 2. Accès projet factorisé (réutilisé par project_vehicles et,
-- en Phase 3, par les autres tables liées au parcours projet)
-- =====================================================
CREATE OR REPLACE FUNCTION public.can_view_project(_project UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = _project AND (
      p.user_id = _user
      OR EXISTS (SELECT 1 FROM project_collaborators c WHERE c.project_id = p.id AND c.user_id = _user)
      OR (p.organization_id IS NOT NULL AND is_org_member(p.organization_id, _user))
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = _project AND (
      p.user_id = _user
      OR EXISTS (
        SELECT 1 FROM project_collaborators c
        WHERE c.project_id = p.id AND c.user_id = _user AND c.role IN ('owner', 'editor')
      )
      OR (p.organization_id IS NOT NULL AND is_org_writer(p.organization_id, _user))
    )
  );
$$;

-- =====================================================
-- 3. Table project_vehicles : les véhicules inclus dans un projet,
-- avec le plan de remplacement véhicule par véhicule
-- =====================================================
CREATE TABLE public.project_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  replacement_year INTEGER CHECK (replacement_year IS NULL OR (replacement_year BETWEEN 2000 AND 2100)),
  target_technology TEXT CHECK (target_technology IS NULL OR target_technology IN ('diesel', 'bev', 'fcev')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, vehicle_id)
);

CREATE INDEX idx_project_vehicles_project ON public.project_vehicles(project_id);
CREATE INDEX idx_project_vehicles_vehicle ON public.project_vehicles(vehicle_id);

ALTER TABLE public.project_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project viewers can view project vehicles"
  ON public.project_vehicles FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));

CREATE POLICY "Project editors can add project vehicles"
  ON public.project_vehicles FOR INSERT
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "Project editors can update project vehicles"
  ON public.project_vehicles FOR UPDATE
  USING (public.can_edit_project(project_id, auth.uid()));

CREATE POLICY "Project editors can delete project vehicles"
  ON public.project_vehicles FOR DELETE
  USING (public.can_edit_project(project_id, auth.uid()));

CREATE TRIGGER update_project_vehicles_updated_at
  BEFORE UPDATE ON public.project_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

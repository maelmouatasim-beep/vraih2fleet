-- Test terrain, bloc 2.1 : les GARAGES deviennent une vraie entité de
-- l'organisation (nom, adresse, puissance électrique disponible, tarif
-- Hydro-Québec, fenêtre de recharge = heures de retour et de départ des
-- véhicules, places), utilisée par le dimensionnement des bornes et du
-- raccordement (src/lib/journey/infrastructure.ts).
--
-- Les véhicules gardent leur colonne texte `depot` (lue partout dans le
-- parcours) : elle est désormais SYNCHRONISÉE avec le garage lié
-- (`garage_id`) par trigger — renommer un garage renomme le dépôt de ses
-- véhicules ; un dépôt saisi qui correspond au nom d'un garage de
-- l'organisation (casse et espaces ignorés) est rattaché à ce garage.
-- Migration additive : aucune donnée existante n'est supprimée.

CREATE TABLE public.garages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  address TEXT,
  -- puissance électrique résiduelle disponible pour la recharge (kW)
  available_power_kw NUMERIC CHECK (available_power_kw IS NULL OR available_power_kw >= 0),
  -- tarif Hydro-Québec de l'abonnement du garage
  hq_rate TEXT CHECK (hq_rate IS NULL OR hq_rate IN ('G', 'M', 'LG', 'autre')),
  -- fenêtre de recharge : retour des véhicules le soir → départ le matin
  return_time TIME,
  departure_time TIME,
  parking_spots INTEGER CHECK (parking_spots IS NULL OR parking_spots >= 0),
  -- devis Hydro-Québec de raccordement propre au garage (prioritaire)
  grid_connection_quote NUMERIC CHECK (grid_connection_quote IS NULL OR grid_connection_quote >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nom unique par organisation, casse et espaces ignorés (même clé que
-- cleGarage() côté application).
CREATE OR REPLACE FUNCTION public.garage_name_key(_name TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$ SELECT lower(regexp_replace(btrim(_name), '\s+', ' ', 'g')) $$;

CREATE UNIQUE INDEX uq_garages_org_name ON public.garages (organization_id, public.garage_name_key(name));
CREATE INDEX idx_garages_organization ON public.garages(organization_id);

ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view garages"
  ON public.garages FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org writers can add garages"
  ON public.garages FOR INSERT
  WITH CHECK (public.is_org_writer(organization_id, auth.uid()));

CREATE POLICY "Org writers can update garages"
  ON public.garages FOR UPDATE
  USING (public.is_org_writer(organization_id, auth.uid()))
  WITH CHECK (public.is_org_writer(organization_id, auth.uid()));

CREATE POLICY "Org writers can delete garages"
  ON public.garages FOR DELETE
  USING (public.is_org_writer(organization_id, auth.uid()));

CREATE TRIGGER update_garages_updated_at
  BEFORE UPDATE ON public.garages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Nom normalisé (espaces superflus retirés), comme cleGarage().
CREATE OR REPLACE FUNCTION public.garages_normalize_name()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.name := regexp_replace(btrim(NEW.name), '\s+', ' ', 'g');
  RETURN NEW;
END;
$$;

CREATE TRIGGER garages_normalize_name
  BEFORE INSERT OR UPDATE OF name ON public.garages
  FOR EACH ROW EXECUTE FUNCTION public.garages_normalize_name();

-- L'organisation d'un garage ne change jamais (pas de déplacement entre organisations).
CREATE OR REPLACE FUNCTION public.garages_lock_org()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id d''un garage non modifiable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER garages_lock_org
  BEFORE UPDATE ON public.garages
  FOR EACH ROW EXECUTE FUNCTION public.garages_lock_org();

-- =====================================================
-- Lien véhicule → garage
-- =====================================================
ALTER TABLE public.vehicles
  ADD COLUMN garage_id UUID REFERENCES public.garages(id) ON DELETE SET NULL;

CREATE INDEX idx_vehicles_garage ON public.vehicles(garage_id);

-- Synchronisation dépôt ↔ garage, même organisation obligatoire.
CREATE OR REPLACE FUNCTION public.vehicles_sync_garage()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g RECORD;
BEGIN
  IF NEW.garage_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.garage_id IS DISTINCT FROM OLD.garage_id) THEN
    SELECT id, organization_id, name INTO g FROM garages WHERE id = NEW.garage_id;
    IF g.organization_id IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'le garage n''appartient pas à l''organisation du véhicule' USING ERRCODE = '42501';
    END IF;
    NEW.depot := g.name;
  ELSIF TG_OP = 'INSERT' OR NEW.depot IS DISTINCT FROM OLD.depot THEN
    -- dépôt saisi (ou vidé) : rattaché au garage du même nom, sinon à aucun
    SELECT id, name INTO g FROM garages
      WHERE organization_id = NEW.organization_id
        AND NEW.depot IS NOT NULL
        AND garage_name_key(name) = garage_name_key(NEW.depot);
    IF FOUND THEN
      NEW.garage_id := g.id;
      NEW.depot := g.name;
    ELSE
      NEW.garage_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER vehicles_sync_garage
  BEFORE INSERT OR UPDATE OF garage_id, depot ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.vehicles_sync_garage();

-- Renommer un garage renomme le dépôt de ses véhicules.
CREATE OR REPLACE FUNCTION public.garages_propagate_name()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE vehicles SET depot = NEW.name WHERE garage_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER garages_propagate_name
  AFTER UPDATE OF name ON public.garages
  FOR EACH ROW EXECUTE FUNCTION public.garages_propagate_name();

-- Rattachement des véhicules existants aux garages créés plus tard : fait
-- par l'application à la création du garage (UPDATE vehicles SET depot =
-- depot déclenche la synchronisation). Les garages des dépôts déjà saisis
-- sont créés ici, une fois, pour que chaque organisation retrouve ses
-- dépôts comme garages (nom seulement — puissance à renseigner).
INSERT INTO public.garages (organization_id, name)
SELECT DISTINCT ON (v.organization_id, public.garage_name_key(v.depot))
  v.organization_id, regexp_replace(btrim(v.depot), '\s+', ' ', 'g')
FROM public.vehicles v
WHERE v.depot IS NOT NULL AND btrim(v.depot) <> ''
ORDER BY v.organization_id, public.garage_name_key(v.depot), v.created_at;

UPDATE public.vehicles v SET garage_id = g.id, depot = g.name
FROM public.garages g
WHERE g.organization_id = v.organization_id
  AND v.depot IS NOT NULL
  AND public.garage_name_key(g.name) = public.garage_name_key(v.depot);

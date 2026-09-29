-- =====================================================
-- Revue externe, bloc B (B4-B6) : gouvernance des organisations.
-- B4 : le DERNIER ADMIN ne peut ni partir ni être rétrogradé (sauf
--      suppression de l'organisation elle-même).
-- B5 : organisation COURANTE choisie par l'utilisateur
--      (profiles.current_organization_id) au lieu de « la plus
--      ancienne » ; le parcours projet lit le type d'organisme du
--      PROJET (fonction get_project_org_type), pas celui de
--      l'utilisateur.
-- B6 : le type d'organisme est demandé à l'inscription
--      (raw_user_meta_data.org_type) au lieu d'être imposé
--      « municipalite » ; une organisation est créée même pour les
--      utilisateurs SANS ligne profiles (handle_new_user robuste +
--      rattrapage des comptes existants).
-- Migration ADDITIVE.
-- =====================================================

-- ────────────────────────────────────────────────────────────────────
-- B4. Le dernier admin ne part pas (départ ou rétrogradation refusés
-- tant qu'aucun autre admin n'existe). La suppression de l'organisation
-- entière reste possible : pendant la cascade, la ligne organizations
-- n'existe déjà plus et le verrou s'efface.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.proteger_dernier_admin()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.role <> 'admin' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;
  -- cascade de suppression de l'organisation : verrou levé
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = OLD.organization_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = OLD.organization_id AND role = 'admin' AND id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'impossible : c''est le dernier administrateur de l''organisation — nommez un autre admin d''abord';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_org_members_dernier_admin ON public.organization_members;
CREATE TRIGGER trg_org_members_dernier_admin
  BEFORE DELETE OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.proteger_dernier_admin();

-- ────────────────────────────────────────────────────────────────────
-- B5. Organisation courante choisie par l'utilisateur.
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_organization_id UUID
    REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Type d'organisme du PROJET, pour quiconque peut voir le projet
-- (le collaborateur externe ne peut pas lire organizations directement).
CREATE OR REPLACE FUNCTION public.get_project_org_type(_project UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.org_type
  FROM projects p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = _project
    AND public.can_view_project(_project, auth.uid());
$$;

-- ────────────────────────────────────────────────────────────────────
-- B6. Inscription : type d'organisme choisi, organisation garantie
-- même sans profil. handle_new_user devient ROBUSTE : l'échec de la
-- création du profil ne bloque plus la création du compte, et
-- l'organisation est créée dans tous les cas.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  type_organisme TEXT;
BEGIN
  -- Organisation D'ABORD (avec le type choisi) : le trigger de
  -- profiles crée sinon une organisation par défaut avant qu'on ait
  -- lu org_type, et le choix de l'inscription serait perdu.
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id = NEW.id) THEN
    type_organisme := NEW.raw_user_meta_data ->> 'org_type';
    IF type_organisme IS NULL
       OR type_organisme NOT IN ('municipalite', 'societe_transport', 'entreprise') THEN
      type_organisme := 'municipalite';
    END IF;
    INSERT INTO organizations (name, org_type, created_by)
    VALUES (
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company'), ''), 'Mon organisation'),
      type_organisme,
      NEW.id
    );
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, full_name, company, function_title, fleet_size, fleet_types, newsletter_opt_in)
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'company',
      NEW.raw_user_meta_data ->> 'function_title',
      NEW.raw_user_meta_data ->> 'fleet_size',
      CASE
        WHEN NEW.raw_user_meta_data -> 'fleet_types' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data -> 'fleet_types'))
        ELSE NULL
      END,
      COALESCE((NEW.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- le compte se crée quand même ; le profil se complètera à la connexion
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- Rattrapage : chaque compte existant SANS organisation en reçoit une
-- (les comptes sans profil n'avaient rien reçu en Phase 2a).
INSERT INTO public.organizations (name, created_by)
SELECT 'Mon organisation', u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = u.id);

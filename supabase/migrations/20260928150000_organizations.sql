-- Phase 2a de la refonte : entité organisation.
-- Jusqu'ici l'« organisation » n'existait que comme texte libre
-- (profiles.company). On crée organizations + organization_members
-- (rôles admin / member / reader), on rattache les projets à une
-- organisation, et chaque utilisateur existant reçoit sa propre
-- organisation (aucune perte de données). pending_invitations et
-- project_collaborators sont conservés (invités externes par projet).

-- =====================================================
-- 1. Types et tables
-- =====================================================
CREATE TYPE public.org_role AS ENUM ('admin', 'member', 'reader');

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- type d'organisme : pilote les taux de taxes non récupérables du
  -- moteur TCO (docs/tco-methodologie.md §3.1)
  org_type TEXT NOT NULL DEFAULT 'municipalite'
    CHECK (org_type IN ('municipalite', 'societe_transport', 'entreprise')),
  region TEXT NOT NULL DEFAULT 'CA_QC',
  currency TEXT NOT NULL DEFAULT 'CAD',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org ON public.organization_members(organization_id);

-- =====================================================
-- 2. Fonctions d'appartenance (SECURITY DEFINER : évite la récursion RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = _org AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = _org AND user_id = _user AND role = 'admin'
  );
$$;

-- admin ou member (écriture) — reader = lecture seule
CREATE OR REPLACE FUNCTION public.is_org_writer(_org UUID, _user UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = _org AND user_id = _user AND role IN ('admin', 'member')
  );
$$;

-- =====================================================
-- 3. RLS
-- =====================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their organization"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create an organization"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id, auth.uid()));

CREATE POLICY "Admins can delete their organization"
  ON public.organizations FOR DELETE
  USING (public.is_org_admin(id, auth.uid()));

CREATE POLICY "Members can view the member list"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can change member roles"
  ON public.organization_members FOR UPDATE
  USING (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Admins can remove members and members can leave"
  ON public.organization_members FOR DELETE
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR user_id = auth.uid()
  );

-- =====================================================
-- 4. Le créateur devient admin automatiquement
-- (SECURITY DEFINER : l'INSERT du membre passe sous RLS sinon —
-- le créateur n'est pas encore admin au moment de l'insertion)
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- =====================================================
-- 5. Rattachement des projets (et, en 2b, de la flotte)
-- =====================================================
ALTER TABLE public.projects
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_organization ON public.projects(organization_id);

-- Lecture : propriétaire, collaborateur externe (existant) OU membre de
-- l'organisation du projet.
DROP POLICY IF EXISTS "Users can view own and shared projects" ON public.projects;
CREATE POLICY "Users can view own, shared and org projects"
  ON public.projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
  );

-- Écriture : propriétaire OU membre écrivain (admin/member) de l'organisation.
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Owners and org writers can update projects"
  ON public.projects FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_writer(organization_id, auth.uid()))
  );

-- Suppression : propriétaire OU admin de l'organisation.
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Owners and org admins can delete projects"
  ON public.projects FOR DELETE
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_admin(organization_id, auth.uid()))
  );

-- Création : par le propriétaire ; si un organization_id est fourni, il
-- faut être écrivain de cette organisation.
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create projects in their organization"
  ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      organization_id IS NULL
      OR public.is_org_writer(organization_id, auth.uid())
    )
  );

-- =====================================================
-- 6. Peuplement : chaque utilisateur existant reçoit SA propre
-- organisation (nommée d'après profiles.company si renseignée), en
-- devient admin (trigger §4), et ses projets y sont rattachés.
-- =====================================================
INSERT INTO public.organizations (name, created_by)
SELECT COALESCE(NULLIF(TRIM(p.company), ''), 'Mon organisation'), p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members m WHERE m.user_id = p.id
);

UPDATE public.projects pr
SET organization_id = m.organization_id
FROM public.organization_members m
WHERE pr.organization_id IS NULL
  AND pr.user_id = m.user_id;

-- =====================================================
-- 7. Chaque NOUVEL utilisateur reçoit aussi son organisation
-- (déclenché à la création du profil, elle-même déclenchée par
-- handle_new_user sur auth.users).
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_profile_organization()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id = NEW.id) THEN
    INSERT INTO organizations (name, created_by)
    VALUES (COALESCE(NULLIF(TRIM(NEW.company), ''), 'Mon organisation'), NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_organization
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_organization();

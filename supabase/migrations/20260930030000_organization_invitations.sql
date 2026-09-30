-- =====================================================
-- Revue externe D6 — INVITATIONS D'ÉQUIPE au niveau de l'ORGANISATION.
-- pending_invitations est propre aux PROJETS (project_id obligatoire,
-- rôles de projet) : une table dédiée évite de mélanger deux modèles
-- de droits. Un admin invite une adresse courriel avec un rôle ; la
-- personne invitée (même courriel dans son jeton) voit l'invitation et
-- l'accepte via accept_organization_invitation (SECURITY DEFINER : elle
-- n'est pas encore membre, la RLS de organization_members l'empêcherait
-- de s'ajouter). Migration ADDITIVE ; RLS dès la création.
-- =====================================================
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 320),
  role public.org_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- une seule invitation OUVERTE par adresse et par organisation
CREATE UNIQUE INDEX uniq_org_invitation_open
  ON public.organization_invitations(organization_id, email)
  WHERE accepted_at IS NULL;
CREATE INDEX idx_org_invitations_email ON public.organization_invitations(email);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org invitations: admins and invitee can read"
  ON public.organization_invitations FOR SELECT
  USING (
    public.is_org_admin(organization_id, auth.uid())
    OR email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "org invitations: admins can invite"
  ON public.organization_invitations FOR INSERT
  WITH CHECK (
    public.is_org_admin(organization_id, auth.uid())
    AND invited_by = auth.uid()
    AND accepted_at IS NULL
  );

CREATE POLICY "org invitations: admins can revoke"
  ON public.organization_invitations FOR DELETE
  USING (public.is_org_admin(organization_id, auth.uid()));
-- aucune policy UPDATE : l'acceptation passe par la fonction ci-dessous

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(_invitation UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv public.organization_invitations%ROWTYPE;
  courriel TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentification requise';
  END IF;
  SELECT * INTO inv FROM public.organization_invitations
  WHERE id = _invitation
    AND accepted_at IS NULL
    AND expires_at > now()
    AND email = courriel
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation introuvable, expirée ou destinée à une autre adresse';
  END IF;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (inv.organization_id, auth.uid(), inv.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  UPDATE public.organization_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = inv.id;
  RETURN inv.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_organization_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(UUID) TO authenticated;

-- Liste des membres AVEC nom et courriel (les profils des autres
-- utilisateurs ne sont pas lisibles directement) — réservée aux membres.
CREATE OR REPLACE FUNCTION public.list_organization_members_detail(_org UUID)
RETURNS TABLE (member_id UUID, user_id UUID, role public.org_role, created_at TIMESTAMPTZ, email TEXT, full_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.role, m.created_at, p.email, p.full_name
  FROM public.organization_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.organization_id = _org
    AND public.is_org_member(_org, auth.uid())
  ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION public.list_organization_members_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_organization_members_detail(UUID) TO authenticated;

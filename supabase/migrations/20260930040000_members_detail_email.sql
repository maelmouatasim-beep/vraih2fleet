-- =====================================================
-- D6 (correctif) — profiles.email n'est renseigné qu'au CHANGEMENT de
-- courriel (trigger on_auth_user_email_update) et par un rattrapage
-- ponctuel : un compte créé depuis n'a pas de courriel dans son profil,
-- et la liste des membres l'affichait « sans nom ». La fonction lit donc
-- le courriel de référence dans auth.users (SECURITY DEFINER, réservée
-- aux membres de l'organisation, comme avant).
-- =====================================================
CREATE OR REPLACE FUNCTION public.list_organization_members_detail(_org UUID)
RETURNS TABLE (member_id UUID, user_id UUID, role public.org_role, created_at TIMESTAMPTZ, email TEXT, full_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.role, m.created_at,
         coalesce(u.email::text, p.email) AS email,
         p.full_name
  FROM public.organization_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = _org
    AND public.is_org_member(_org, auth.uid())
  ORDER BY m.created_at;
$$;

-- Durcissement RLS (audit de sécurité, items B10-B16) + table de rate limit.
-- Migration additive : les migrations existantes ne sont pas modifiées.

-- ────────────────────────────────────────────────────────────────────────────
-- Table de limite de débit des edge functions (send-email, assistant-chat).
-- Service role uniquement : RLS activée sans aucune politique.
-- Purge recommandée via pg_cron (voir procédure de déploiement).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  caller TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (bucket, caller, created_at);
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────
-- B10. subscriptions : un utilisateur ne modifie plus son propre tier/status.
-- Seules les fonctions serveur (service role) écrivent. Lecture inchangée.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;

-- ────────────────────────────────────────────────────────────────────────────
-- B11. api_keys : UPDATE limité aux colonnes key_name et is_active.
-- La politique garde la ligne dans le périmètre de l'utilisateur ; le trigger
-- bloque toute autre colonne (scopes, rate_limit_per_hour, request_count…).
-- Le service role (api-gateway : compteurs) n'est pas concerné
-- (auth.uid() IS NULL).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
CREATE POLICY "Users can rename or disable their own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_api_keys_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (to_jsonb(NEW) - ARRAY['key_name','is_active'])
         IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['key_name','is_active']) THEN
    RAISE EXCEPTION 'Only key_name and is_active can be updated on api_keys';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_api_keys_update_columns ON public.api_keys;
CREATE TRIGGER enforce_api_keys_update_columns
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_api_keys_update_columns();

-- ────────────────────────────────────────────────────────────────────────────
-- B12. notifications : plus d'INSERT ouvert ; les notifications sont créées
-- par les triggers SECURITY DEFINER (qui ne passent pas par la RLS) ou par
-- les fonctions serveur. Contrainte CHECK élargie aux types réellement
-- utilisés par les triggers + 'subsidy' (à venir). UPDATE verrouillé sur la
-- ligne du destinataire (WITH CHECK manquait).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'comment', 'reply', 'invitation', 'version', 'role_change',
    'task_assigned', 'task_mentioned', 'milestone_assigned',
    'collaboration_accepted', 'subsidy'
  ));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- B13. roadmap_* : séparation lecture/écriture. Lecture pour tout membre du
-- projet (inchangée) ; écriture réservée au propriétaire du projet et aux
-- collaborateurs owner/editor — un viewer ne peut plus écrire.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_edit_roadmap(_roadmap_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM transition_roadmaps tr
    WHERE tr.id = _roadmap_id
      AND (
        is_project_owner(tr.project_id)
        OR EXISTS (
          SELECT 1 FROM project_collaborators pc
          WHERE pc.project_id = tr.project_id
            AND pc.user_id = auth.uid()
            AND pc.role IN ('owner', 'editor')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_phase(_phase_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM roadmap_phases p
    WHERE p.id = _phase_id
      AND public.can_edit_roadmap(p.roadmap_id)
  );
$$;

-- roadmap_phases
DROP POLICY IF EXISTS "Users can manage phases for accessible roadmaps" ON public.roadmap_phases;
CREATE POLICY "Editors can insert phases"
  ON public.roadmap_phases FOR INSERT
  WITH CHECK (public.can_edit_roadmap(roadmap_id));
CREATE POLICY "Editors can update phases"
  ON public.roadmap_phases FOR UPDATE
  USING (public.can_edit_roadmap(roadmap_id))
  WITH CHECK (public.can_edit_roadmap(roadmap_id));
CREATE POLICY "Editors can delete phases"
  ON public.roadmap_phases FOR DELETE
  USING (public.can_edit_roadmap(roadmap_id));

-- roadmap_milestones
DROP POLICY IF EXISTS "Users can manage milestones for accessible phases" ON public.roadmap_milestones;
CREATE POLICY "Editors can insert milestones"
  ON public.roadmap_milestones FOR INSERT
  WITH CHECK (public.can_edit_phase(phase_id));
CREATE POLICY "Editors can update milestones"
  ON public.roadmap_milestones FOR UPDATE
  USING (public.can_edit_phase(phase_id))
  WITH CHECK (public.can_edit_phase(phase_id));
CREATE POLICY "Editors can delete milestones"
  ON public.roadmap_milestones FOR DELETE
  USING (public.can_edit_phase(phase_id));

-- roadmap_cash_flow
DROP POLICY IF EXISTS "Users can manage cash flow for accessible roadmaps" ON public.roadmap_cash_flow;
CREATE POLICY "Editors can insert cash flow"
  ON public.roadmap_cash_flow FOR INSERT
  WITH CHECK (public.can_edit_roadmap(roadmap_id));
CREATE POLICY "Editors can update cash flow"
  ON public.roadmap_cash_flow FOR UPDATE
  USING (public.can_edit_roadmap(roadmap_id))
  WITH CHECK (public.can_edit_roadmap(roadmap_id));
CREATE POLICY "Editors can delete cash flow"
  ON public.roadmap_cash_flow FOR DELETE
  USING (public.can_edit_roadmap(roadmap_id));

-- roadmap_alerts
DROP POLICY IF EXISTS "Users can manage alerts for accessible roadmaps" ON public.roadmap_alerts;
CREATE POLICY "Editors can insert alerts"
  ON public.roadmap_alerts FOR INSERT
  WITH CHECK (public.can_edit_roadmap(roadmap_id));
CREATE POLICY "Editors can update alerts"
  ON public.roadmap_alerts FOR UPDATE
  USING (public.can_edit_roadmap(roadmap_id))
  WITH CHECK (public.can_edit_roadmap(roadmap_id));
CREATE POLICY "Editors can delete alerts"
  ON public.roadmap_alerts FOR DELETE
  USING (public.can_edit_roadmap(roadmap_id));

-- ────────────────────────────────────────────────────────────────────────────
-- B14. tasks / task_attachments : created_by et uploaded_by liés à
-- auth.uid(). tasks UPDATE reçoit un WITH CHECK (une tâche ne peut plus être
-- déplacée vers un projet où l'on n'a pas les droits). project_comments /
-- task_comments : UPDATE ne peut plus changer project_id / task_id.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Project editors can create tasks" ON public.tasks;
CREATE POLICY "Project editors can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      is_project_owner(project_id)
      OR EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = tasks.project_id
          AND project_collaborators.user_id = auth.uid()
          AND project_collaborators.role IN ('owner', 'editor')
      )
    )
  );

DROP POLICY IF EXISTS "Project editors can update tasks" ON public.tasks;
CREATE POLICY "Project editors can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    is_project_owner(project_id)
    OR EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = tasks.project_id
        AND project_collaborators.user_id = auth.uid()
        AND project_collaborators.role IN ('owner', 'editor')
    )
  )
  WITH CHECK (
    is_project_owner(project_id)
    OR EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = tasks.project_id
        AND project_collaborators.user_id = auth.uid()
        AND project_collaborators.role IN ('owner', 'editor')
    )
  );

DROP POLICY IF EXISTS "Project editors can add task attachments" ON public.task_attachments;
CREATE POLICY "Project editors can add task attachments"
  ON public.task_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_attachments.task_id
        AND (
          is_project_owner(tasks.project_id)
          OR EXISTS (
            SELECT 1 FROM project_collaborators
            WHERE project_collaborators.project_id = tasks.project_id
              AND project_collaborators.user_id = auth.uid()
              AND project_collaborators.role IN ('owner', 'editor')
          )
        )
    )
  );

-- Trigger générique : interdit de changer la colonne de rattachement lors
-- d'un UPDATE utilisateur (TG_ARGV[0] = nom de colonne).
CREATE OR REPLACE FUNCTION public.prevent_parent_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  col TEXT := TG_ARGV[0];
BEGIN
  IF auth.uid() IS NOT NULL
     AND (to_jsonb(NEW) ->> col) IS DISTINCT FROM (to_jsonb(OLD) ->> col) THEN
    RAISE EXCEPTION '% cannot be changed on %', col, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users can update own comments" ON public.project_comments;
CREATE POLICY "Users can update own comments"
  ON public.project_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS prevent_project_comment_rehoming ON public.project_comments;
CREATE TRIGGER prevent_project_comment_rehoming
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_parent_change('project_id');

DROP POLICY IF EXISTS "Users can update own task comments" ON public.task_comments;
CREATE POLICY "Users can update own task comments"
  ON public.task_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS prevent_task_comment_rehoming ON public.task_comments;
CREATE TRIGGER prevent_task_comment_rehoming
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_parent_change('task_id');

-- ────────────────────────────────────────────────────────────────────────────
-- B15. pending_invitations : la politique SELECT lisait auth.users
-- (permission denied pour authenticated). Remplacée par auth.jwt()->>'email'.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view invitations for their email" ON public.pending_invitations;
CREATE POLICY "Users can view invitations for their email"
  ON public.pending_invitations FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────────────────────
-- B16. hydrogen_suppliers (module en fin de vie) : les contacts (email,
-- téléphone) ne sont lisibles que par les admins. Les autres utilisateurs
-- lisent l'annuaire via une vue sans colonnes de contact, construite
-- dynamiquement pour ne pas dériver du schéma.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read hydrogen suppliers" ON public.hydrogen_suppliers;
CREATE POLICY "Only admins can read hydrogen suppliers"
  ON public.hydrogen_suppliers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DO $$
DECLARE
  cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'hydrogen_suppliers'
    AND column_name NOT IN ('contact_email', 'contact_phone');

  -- Vue "security definer" (pas de security_invoker) : elle lit la table de
  -- base avec les droits de son propriétaire, en n'exposant jamais les
  -- colonnes de contact.
  EXECUTE format(
    'CREATE OR REPLACE VIEW public.hydrogen_suppliers_directory AS SELECT %s FROM public.hydrogen_suppliers',
    cols
  );
END;
$$;

REVOKE ALL ON public.hydrogen_suppliers_directory FROM anon;
GRANT SELECT ON public.hydrogen_suppliers_directory TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Divers : profiles UPDATE sans WITH CHECK (verrouillage de la ligne).
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────────────────────
-- Constat du test d'audit : reference_data_history était lisible par anon
-- (USING true). L'historique d'audit des données de référence est réservé
-- aux utilisateurs connectés ; les tables de référence courantes restent
-- publiques pour le calculateur.
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read reference history" ON public.reference_data_history;
CREATE POLICY "Authenticated users can read reference history"
  ON public.reference_data_history FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- Notifications : une seule cloche, textes bilingues, préférences
-- respectées, archivage, alertes de la Phase 5.
-- Migration ADDITIVE (colonnes, fonctions, triggers) ; aucune suppression
-- de données ; RLS inchangée sur le principe (le destinataire seul).
--
-- 1. payload JSONB : paramètres des textes (projet, auteur, sujet, nombre,
--    textes fr/en des alertes) — le titre et le message sont rendus dans la
--    langue de l'interface (src/lib/notifications/model.ts) ; les colonnes
--    title/message restent un repli (français) pour les anciens clients.
-- 2. archived_at : « archiver » retire la notification de la cloche sans
--    la supprimer.
-- 3. profiles.notification_preferences : catégories désactivées par
--    l'utilisateur (Paramètres) ; appliquées À LA SOURCE par un trigger
--    BEFORE INSERT commun à toutes les fonctions qui créent des
--    notifications (aucune n'a besoin de connaître les préférences).
-- 4. Nouveaux types : plan_alert (surveillance du plan : échéances de
--    subventions, programmes modifiés validés par la veille, retards,
--    énergie, garages) et tasks_generated (tâches du plan générées).
-- =====================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE public.notifications SET is_read = false WHERE is_read IS NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'comment', 'reply', 'invitation', 'version', 'role_change',
    'task_assigned', 'task_mentioned', 'milestone_assigned',
    'collaboration_accepted', 'subsidy',
    'plan_alert', 'tasks_generated'
  ));

CREATE INDEX IF NOT EXISTS idx_notifications_user_active
  ON public.notifications(user_id, created_at DESC) WHERE archived_at IS NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Catégorie d'un type (même table que src/lib/notifications/model.ts) ──
CREATE OR REPLACE FUNCTION public.notification_category(_type TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _type IN ('comment', 'reply') THEN 'comments'
    WHEN _type IN ('task_assigned', 'task_mentioned', 'milestone_assigned', 'tasks_generated') THEN 'tasks'
    WHEN _type IN ('invitation', 'collaboration_accepted', 'role_change') THEN 'team'
    WHEN _type = 'version' THEN 'versions'
    WHEN _type IN ('plan_alert', 'subsidy') THEN 'plan_alerts'
    ELSE 'other'
  END
$$;

-- ── Paramètres des textes, lus au moment de la création ─────────────────
CREATE OR REPLACE FUNCTION public.notification_payload(_type TEXT, _project UUID, _related UUID, _actor UUID, _base JSONB)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r JSONB := jsonb_build_object('v', 1);
  x TEXT;
BEGIN
  IF _project IS NOT NULL THEN
    SELECT name INTO x FROM projects WHERE id = _project;
    IF x IS NOT NULL THEN r := r || jsonb_build_object('project', x); END IF;
  END IF;
  x := NULL;
  IF _actor IS NOT NULL THEN
    SELECT full_name INTO x FROM profiles WHERE id = _actor;
    IF x IS NOT NULL AND x <> '' THEN r := r || jsonb_build_object('actor', x); END IF;
  END IF;
  x := NULL;
  IF _related IS NOT NULL THEN
    IF _type IN ('task_assigned', 'task_mentioned') THEN
      SELECT title INTO x FROM tasks WHERE id = _related;
    ELSIF _type = 'milestone_assigned' THEN
      SELECT title INTO x FROM roadmap_milestones WHERE id = _related;
    ELSIF _type = 'version' THEN
      SELECT version_name INTO x FROM project_versions WHERE id = _related;
    ELSIF _type = 'invitation' THEN
      SELECT role::text INTO x FROM project_collaborators WHERE id = _related;
    END IF;
    IF x IS NOT NULL THEN
      r := r || jsonb_build_object(CASE WHEN _type = 'invitation' THEN 'role' ELSE 'subject' END, x);
    END IF;
  END IF;
  -- Les valeurs fournies par la fonction créatrice priment.
  RETURN r || COALESCE(_base, '{}'::jsonb);
END;
$$;

-- ── Trigger commun : préférences + paramètres des textes ────────────────
CREATE OR REPLACE FUNCTION public.notifications_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefs JSONB;
BEGIN
  SELECT notification_preferences INTO prefs FROM profiles WHERE id = NEW.user_id;
  -- Catégorie désactivée par le destinataire : la notification n'est pas créée.
  IF prefs IS NOT NULL AND (prefs ->> public.notification_category(NEW.type)) = 'false' THEN
    RETURN NULL;
  END IF;
  NEW.payload := public.notification_payload(NEW.type, NEW.project_id, NEW.related_id, NEW.actor_id, NEW.payload);
  NEW.is_read := COALESCE(NEW.is_read, false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_before_insert ON public.notifications;
CREATE TRIGGER notifications_before_insert
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_before_insert();

-- ── Le destinataire ne change que « lu » et « archivé » ─────────────────
CREATE OR REPLACE FUNCTION public.notifications_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
       NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.related_id IS DISTINCT FROM OLD.related_id
    OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
    OR NEW.payload IS DISTINCT FROM OLD.payload
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'seuls « lu » et « archivé » sont modifiables' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_guard_update ON public.notifications;
CREATE TRIGGER notifications_guard_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_guard_update();

-- ── Correctif : notify_on_version lisait NEW.name, colonne inexistante
-- (la colonne est version_name) → l'enregistrement d'une version d'un
-- projet partagé échouait (« record "new" has no field "name" »).
CREATE OR REPLACE FUNCTION public.notify_on_version()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_owner_id UUID;
  project_name TEXT;
  actor_name TEXT;
BEGIN
  SELECT user_id, name INTO project_owner_id, project_name FROM projects WHERE id = NEW.project_id;
  SELECT full_name INTO actor_name FROM profiles WHERE id = NEW.created_by;
  IF actor_name IS NULL OR actor_name = '' THEN actor_name := 'Un utilisateur'; END IF;

  INSERT INTO notifications (user_id, type, title, message, project_id, related_id, actor_id)
  SELECT a.user_id, 'version', 'Nouvelle version sauvegardée',
         actor_name || ' a créé la version « ' || NEW.version_name || ' » sur ' || COALESCE(project_name, 'un projet'),
         NEW.project_id, NEW.id, NEW.created_by
    FROM (
      SELECT project_owner_id AS user_id WHERE project_owner_id IS NOT NULL
      UNION
      SELECT c.user_id FROM project_collaborators c WHERE c.project_id = NEW.project_id
    ) a
   WHERE a.user_id <> NEW.created_by;
  RETURN NEW;
END;
$$;

-- Notifications existantes : mêmes paramètres que les nouvelles.
UPDATE public.notifications
   SET payload = public.notification_payload(type, project_id, related_id, actor_id, payload)
 WHERE NOT (payload ? 'v');

-- ── Équipe d'un projet (propriétaire, collaborateurs, membres de l'org) ──
CREATE OR REPLACE FUNCTION public.project_audience(_project UUID)
RETURNS TABLE (user_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id FROM projects p WHERE p.id = _project AND p.user_id IS NOT NULL
  UNION
  SELECT c.user_id FROM project_collaborators c WHERE c.project_id = _project
  UNION
  SELECT m.user_id FROM projects p
    JOIN organization_members m ON m.organization_id = p.organization_id
   WHERE p.id = _project
$$;
REVOKE ALL ON FUNCTION public.project_audience(UUID) FROM PUBLIC, anon, authenticated;

-- ── Alertes de surveillance du plan → cloche de l'équipe du projet ──────
-- Nouvelle alerte (ou alerte résolue qui revient) de gravité « critique »
-- ou « attention » ; les textes fr/en déjà rendus par le moteur voyagent
-- dans payload. Les alertes « info » restent dans le panneau du Suivi.
CREATE OR REPLACE FUNCTION public.notify_plan_alert()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.resolved_at IS NOT NULL AND NEW.resolved_at IS NULL) THEN
    RETURN NEW;
  END IF;
  IF NEW.severity = 'info' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, message, project_id, related_id, payload)
  SELECT a.user_id, 'plan_alert', NEW.title_fr, NEW.message_fr, NEW.project_id, NEW.id,
         jsonb_build_object(
           'kind', NEW.kind, 'severity', NEW.severity,
           'title_fr', NEW.title_fr, 'title_en', NEW.title_en,
           'message_fr', NEW.message_fr, 'message_en', NEW.message_en)
    FROM public.project_audience(NEW.project_id) AS a;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_plan_alert ON public.plan_alerts;
CREATE TRIGGER notify_plan_alert
  AFTER INSERT OR UPDATE OF resolved_at ON public.plan_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_plan_alert();

-- ── Tâches du plan générées (Suivi) → une notification groupée ──────────
CREATE OR REPLACE FUNCTION public.notify_tasks_generated()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, project_id, actor_id, payload)
  SELECT a.user_id, 'tasks_generated', 'Tâches du plan générées',
         format('%s tâche(s) du plan générée(s)', g.n), g.project_id, g.auteur,
         jsonb_build_object('count', g.n)
    FROM (
      SELECT project_id, (array_agg(created_by))[1] AS auteur, count(*)::int AS n
        FROM nouvelles
       WHERE auto_key IS NOT NULL AND project_id IS NOT NULL
       GROUP BY project_id
    ) g
    CROSS JOIN LATERAL public.project_audience(g.project_id) AS a;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notify_tasks_generated ON public.tasks;
CREATE TRIGGER notify_tasks_generated
  AFTER INSERT ON public.tasks
  REFERENCING NEW TABLE AS nouvelles
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_tasks_generated();

REVOKE ALL ON FUNCTION public.notification_payload(TEXT, UUID, UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifications_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_plan_alert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_tasks_generated() FROM PUBLIC, anon, authenticated;

-- La table reste dans la publication temps réel (vérifié par
-- scripts/verifier-base.mjs) ; on s'en assure sans erreur si déjà présente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

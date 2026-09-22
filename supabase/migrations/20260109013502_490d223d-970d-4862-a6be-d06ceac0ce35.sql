-- Table des notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('comment', 'reply', 'invitation', 'version', 'role_change')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  related_id UUID,
  actor_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Les utilisateurs ne voient que leurs notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Fonction pour créer des notifications de commentaire
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_owner_id UUID;
  project_name TEXT;
  actor_name TEXT;
  collaborator_record RECORD;
  parent_author_id UUID;
BEGIN
  -- Récupérer le propriétaire et le nom du projet
  SELECT user_id, name INTO project_owner_id, project_name
  FROM projects WHERE id = NEW.project_id;

  -- Récupérer le nom de l'auteur du commentaire
  SELECT full_name INTO actor_name FROM profiles WHERE id = NEW.user_id;
  IF actor_name IS NULL THEN actor_name := 'Un utilisateur'; END IF;

  -- Si c'est une réponse, notifier l'auteur du commentaire parent
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author_id FROM project_comments WHERE id = NEW.parent_id;
    IF parent_author_id IS NOT NULL AND parent_author_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, project_id, related_id, actor_id)
      VALUES (
        parent_author_id,
        'reply',
        'Réponse à votre commentaire',
        actor_name || ' a répondu à votre commentaire sur ' || COALESCE(project_name, 'un projet'),
        NEW.project_id,
        NEW.id,
        NEW.user_id
      );
    END IF;
  END IF;

  -- Notifier le propriétaire du projet (sauf si c'est lui l'auteur)
  IF project_owner_id IS NOT NULL AND project_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, project_id, related_id, actor_id)
    VALUES (
      project_owner_id,
      'comment',
      'Nouveau commentaire',
      actor_name || ' a commenté sur ' || COALESCE(project_name, 'votre projet'),
      NEW.project_id,
      NEW.id,
      NEW.user_id
    );
  END IF;

  -- Notifier les collaborateurs (sauf l'auteur)
  FOR collaborator_record IN
    SELECT user_id FROM project_collaborators
    WHERE project_id = NEW.project_id AND user_id != NEW.user_id AND user_id != project_owner_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, project_id, related_id, actor_id)
    VALUES (
      collaborator_record.user_id,
      'comment',
      'Nouveau commentaire',
      actor_name || ' a commenté sur ' || COALESCE(project_name, 'un projet partagé'),
      NEW.project_id,
      NEW.id,
      NEW.user_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Fonction pour notifier les invitations
CREATE OR REPLACE FUNCTION public.notify_on_collaboration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_name TEXT;
  owner_name TEXT;
  project_owner_id UUID;
BEGIN
  -- Récupérer les infos du projet
  SELECT p.name, p.user_id, pr.full_name 
  INTO project_name, project_owner_id, owner_name
  FROM projects p
  LEFT JOIN profiles pr ON pr.id = p.user_id
  WHERE p.id = NEW.project_id;

  IF owner_name IS NULL THEN owner_name := 'Un utilisateur'; END IF;

  -- Notifier l'utilisateur invité
  INSERT INTO notifications (user_id, type, title, message, project_id, related_id, actor_id)
  VALUES (
    NEW.user_id,
    'invitation',
    'Invitation à collaborer',
    owner_name || ' vous a ajouté au projet "' || COALESCE(project_name, 'Sans nom') || '" en tant que ' || NEW.role,
    NEW.project_id,
    NEW.id,
    project_owner_id
  );

  RETURN NEW;
END;
$$;

-- Fonction pour notifier les nouvelles versions
CREATE OR REPLACE FUNCTION public.notify_on_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_owner_id UUID;
  project_name TEXT;
  actor_name TEXT;
  collaborator_record RECORD;
BEGIN
  -- Récupérer les infos du projet
  SELECT user_id, name INTO project_owner_id, project_name
  FROM projects WHERE id = NEW.project_id;

  -- Récupérer le nom de l'auteur
  SELECT full_name INTO actor_name FROM profiles WHERE id = NEW.created_by;
  IF actor_name IS NULL THEN actor_name := 'Un utilisateur'; END IF;

  -- Notifier le propriétaire (sauf si c'est lui)
  IF project_owner_id IS NOT NULL AND project_owner_id != NEW.created_by THEN
    INSERT INTO notifications (user_id, type, title, message, project_id, related_id, actor_id)
    VALUES (
      project_owner_id,
      'version',
      'Nouvelle version sauvegardée',
      actor_name || ' a créé la version "' || NEW.name || '" sur ' || COALESCE(project_name, 'votre projet'),
      NEW.project_id,
      NEW.id,
      NEW.created_by
    );
  END IF;

  -- Notifier les collaborateurs
  FOR collaborator_record IN
    SELECT user_id FROM project_collaborators
    WHERE project_id = NEW.project_id AND user_id != NEW.created_by AND user_id != project_owner_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, project_id, related_id, actor_id)
    VALUES (
      collaborator_record.user_id,
      'version',
      'Nouvelle version sauvegardée',
      actor_name || ' a créé la version "' || NEW.name || '" sur ' || COALESCE(project_name, 'un projet partagé'),
      NEW.project_id,
      NEW.id,
      NEW.created_by
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Créer les triggers
CREATE TRIGGER trigger_notify_on_comment
  AFTER INSERT ON public.project_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();

CREATE TRIGGER trigger_notify_on_collaboration
  AFTER INSERT ON public.project_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_collaboration();

CREATE TRIGGER trigger_notify_on_version
  AFTER INSERT ON public.project_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_version();
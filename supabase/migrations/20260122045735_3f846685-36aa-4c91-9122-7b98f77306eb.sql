-- Phase 1: Infrastructure pour les invitations par email

-- 1.1 Ajouter colonne email aux profils pour lookup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Créer un index pour les recherches par email
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 1.2 Fonction pour synchroniser l'email depuis auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET email = NEW.email 
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger sur auth.users pour sync automatique
DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();

-- Synchroniser les emails existants
UPDATE public.profiles p 
SET email = u.email 
FROM auth.users u 
WHERE u.id = p.id AND p.email IS NULL;

-- 1.3 Table des invitations en attente (pour utilisateurs non inscrits)
CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  UNIQUE(email, project_id)
);

-- Index pour recherche par email
CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON public.pending_invitations(email);

-- RLS sur pending_invitations
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Les propriétaires de projet peuvent gérer les invitations
CREATE POLICY "Project owners can manage pending invitations"
  ON public.pending_invitations
  FOR ALL
  USING (is_project_owner(project_id));

-- Les utilisateurs peuvent voir leurs propres invitations (par email)
CREATE POLICY "Users can view invitations for their email"
  ON public.pending_invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 1.4 Fonction pour accepter les invitations à la connexion
CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS TRIGGER AS $$
DECLARE
  invitation RECORD;
BEGIN
  -- Chercher les invitations pour cet email
  FOR invitation IN 
    SELECT * FROM public.pending_invitations 
    WHERE email = NEW.email 
    AND expires_at > now()
  LOOP
    -- Créer la collaboration
    INSERT INTO public.project_collaborators (project_id, user_id, role, invited_by, accepted_at)
    VALUES (invitation.project_id, NEW.id, invitation.role, invitation.invited_by, now())
    ON CONFLICT (project_id, user_id) DO NOTHING;
    
    -- Supprimer l'invitation
    DELETE FROM public.pending_invitations WHERE id = invitation.id;
    
    -- Créer une notification
    INSERT INTO public.notifications (user_id, type, title, message, project_id)
    VALUES (
      NEW.id,
      'collaboration_accepted',
      'Invitation acceptée',
      'Vous avez rejoint un nouveau projet',
      invitation.project_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger à la création d'un profil (donc à l'inscription)
DROP TRIGGER IF EXISTS on_profile_created_accept_invitations ON public.profiles;
CREATE TRIGGER on_profile_created_accept_invitations
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.accept_pending_invitations();

-- 1.5 Contrainte unique sur project_collaborators pour éviter les doublons
ALTER TABLE public.project_collaborators 
  DROP CONSTRAINT IF EXISTS unique_project_user;
ALTER TABLE public.project_collaborators 
  ADD CONSTRAINT unique_project_user UNIQUE (project_id, user_id);

-- 1.6 Trigger pour notifier lors d'assignation de tâche
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  new_assignee UUID;
  task_title TEXT;
  project_name TEXT;
BEGIN
  -- Si assigned_to a été modifié
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    -- Récupérer le titre de la tâche
    task_title := NEW.title;
    
    -- Récupérer le nom du projet
    SELECT name INTO project_name FROM projects WHERE id = NEW.project_id;
    
    -- Pour chaque nouvel assigné (qui n'était pas dans l'ancienne liste)
    FOREACH new_assignee IN ARRAY COALESCE(NEW.assigned_to, '{}')
    LOOP
      -- Vérifier que ce n'est pas dans l'ancienne liste
      IF NOT (new_assignee = ANY(COALESCE(OLD.assigned_to, '{}'))) THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, related_id)
        VALUES (
          new_assignee,
          'task_assigned',
          'Nouvelle tâche assignée',
          format('Vous avez été assigné à la tâche "%s" dans le projet %s', task_title, project_name),
          NEW.project_id,
          NEW.id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_task_assignment ON public.tasks;
CREATE TRIGGER on_task_assignment
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();

-- 1.7 Trigger pour notifier lors d'assignation de milestone
CREATE OR REPLACE FUNCTION public.notify_milestone_assignment()
RETURNS TRIGGER AS $$
DECLARE
  milestone_title TEXT;
  project_name TEXT;
  roadmap_project_id UUID;
BEGIN
  -- Si assigned_to a été modifié
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    -- Récupérer le titre
    milestone_title := NEW.title;
    
    -- Récupérer le project_id via la chaîne phase -> roadmap -> project
    SELECT p.name, tr.project_id INTO project_name, roadmap_project_id
    FROM roadmap_phases rp
    JOIN transition_roadmaps tr ON rp.roadmap_id = tr.id
    JOIN projects p ON tr.project_id = p.id
    WHERE rp.id = NEW.phase_id;
    
    -- Notifier le nouvel assigné
    IF OLD.assigned_to IS NULL OR NEW.assigned_to != OLD.assigned_to THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, related_id)
      VALUES (
        NEW.assigned_to,
        'milestone_assigned',
        'Nouveau jalon assigné',
        format('Vous avez été assigné au jalon "%s" dans le projet %s', milestone_title, project_name),
        roadmap_project_id,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_milestone_assignment ON public.roadmap_milestones;
CREATE TRIGGER on_milestone_assignment
  AFTER UPDATE ON public.roadmap_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_milestone_assignment();
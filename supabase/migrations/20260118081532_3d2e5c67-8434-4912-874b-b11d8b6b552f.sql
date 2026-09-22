-- =====================================================
-- MODULE GESTION DE PROJET - TABLES TASKS
-- =====================================================

-- 1. Table principale des tâches
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES public.roadmap_milestones(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'completed')),
  
  -- Budget tracking
  budget_allocated NUMERIC DEFAULT 0,
  budget_spent NUMERIC DEFAULT 0,
  
  -- Timeline
  start_date DATE,
  due_date DATE,
  completed_date DATE,
  
  -- Assignments (array of user IDs)
  assigned_to UUID[] DEFAULT '{}',
  
  -- Dependencies
  depends_on UUID[] DEFAULT '{}',
  blocked_by TEXT,
  
  -- Computed flags
  is_overdue BOOLEAN DEFAULT false,
  is_over_budget BOOLEAN DEFAULT false,
  
  -- Priority
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Ordering within status
  order_index INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Table des commentaires de tâches avec @mentions
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table des pièces jointes
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Index pour performance
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_milestone_id ON public.tasks(milestone_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks USING GIN(assigned_to);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

-- 5. Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for tasks (based on project access)
CREATE POLICY "Project members can view tasks"
ON public.tasks FOR SELECT
USING (
  is_project_owner(project_id) OR 
  EXISTS (
    SELECT 1 FROM project_collaborators 
    WHERE project_collaborators.project_id = tasks.project_id 
    AND project_collaborators.user_id = auth.uid()
  )
);

CREATE POLICY "Project editors can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  is_project_owner(project_id) OR 
  EXISTS (
    SELECT 1 FROM project_collaborators 
    WHERE project_collaborators.project_id = tasks.project_id 
    AND project_collaborators.user_id = auth.uid()
    AND project_collaborators.role IN ('owner', 'editor')
  )
);

CREATE POLICY "Project editors can update tasks"
ON public.tasks FOR UPDATE
USING (
  is_project_owner(project_id) OR 
  EXISTS (
    SELECT 1 FROM project_collaborators 
    WHERE project_collaborators.project_id = tasks.project_id 
    AND project_collaborators.user_id = auth.uid()
    AND project_collaborators.role IN ('owner', 'editor')
  )
);

CREATE POLICY "Project owners can delete tasks"
ON public.tasks FOR DELETE
USING (
  is_project_owner(project_id) OR 
  EXISTS (
    SELECT 1 FROM project_collaborators 
    WHERE project_collaborators.project_id = tasks.project_id 
    AND project_collaborators.user_id = auth.uid()
    AND project_collaborators.role = 'owner'
  )
);

-- 7. RLS Policies for task_comments
CREATE POLICY "Project members can view task comments"
ON public.task_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_comments.task_id
    AND (
      is_project_owner(tasks.project_id) OR 
      EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = tasks.project_id 
        AND project_collaborators.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project members can add task comments"
ON public.task_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_comments.task_id
    AND (
      is_project_owner(tasks.project_id) OR 
      EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = tasks.project_id 
        AND project_collaborators.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Users can update own task comments"
ON public.task_comments FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task comments"
ON public.task_comments FOR DELETE
USING (auth.uid() = user_id);

-- 8. RLS Policies for task_attachments
CREATE POLICY "Project members can view task attachments"
ON public.task_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_attachments.task_id
    AND (
      is_project_owner(tasks.project_id) OR 
      EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = tasks.project_id 
        AND project_collaborators.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Project editors can add task attachments"
ON public.task_attachments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_attachments.task_id
    AND (
      is_project_owner(tasks.project_id) OR 
      EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_collaborators.project_id = tasks.project_id 
        AND project_collaborators.user_id = auth.uid()
        AND project_collaborators.role IN ('owner', 'editor')
      )
    )
  )
);

CREATE POLICY "Uploaders can delete own attachments"
ON public.task_attachments FOR DELETE
USING (auth.uid() = uploaded_by);

-- 9. Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_tasks_updated_at();

CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.update_tasks_updated_at();

-- 10. Trigger to check overdue and over_budget
CREATE OR REPLACE FUNCTION public.check_task_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Check overdue
  IF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND NEW.status != 'completed' THEN
    NEW.is_overdue := true;
  ELSE
    NEW.is_overdue := false;
  END IF;
  
  -- Check over budget
  IF NEW.budget_allocated > 0 AND NEW.budget_spent > NEW.budget_allocated THEN
    NEW.is_over_budget := true;
  ELSE
    NEW.is_over_budget := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_task_alerts_trigger
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.check_task_alerts();

-- 11. Trigger to create notification on task assignment
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  assigned_user UUID;
  task_project_id UUID;
  task_title TEXT;
BEGIN
  -- Get project info
  task_project_id := NEW.project_id;
  task_title := NEW.title;
  
  -- For new tasks or when assigned_to changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.assigned_to != OLD.assigned_to) THEN
    FOREACH assigned_user IN ARRAY NEW.assigned_to
    LOOP
      -- Don't notify if user assigned themselves
      IF assigned_user != auth.uid() THEN
        INSERT INTO public.notifications (
          user_id,
          project_id,
          related_id,
          actor_id,
          type,
          title,
          message
        ) VALUES (
          assigned_user,
          task_project_id,
          NEW.id,
          auth.uid(),
          'task_assigned',
          'Nouvelle tâche assignée',
          'Vous avez été assigné à la tâche: ' || task_title
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_task_assignment_trigger
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- 12. Trigger to notify @mentions in comments
CREATE OR REPLACE FUNCTION public.notify_task_mentions()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user UUID;
  task_info RECORD;
BEGIN
  -- Get task info
  SELECT t.title, t.project_id INTO task_info
  FROM tasks t WHERE t.id = NEW.task_id;
  
  FOREACH mentioned_user IN ARRAY NEW.mentions
  LOOP
    IF mentioned_user != NEW.user_id THEN
      INSERT INTO public.notifications (
        user_id,
        project_id,
        related_id,
        actor_id,
        type,
        title,
        message
      ) VALUES (
        mentioned_user,
        task_info.project_id,
        NEW.task_id,
        NEW.user_id,
        'task_mentioned',
        'Vous avez été mentionné',
        'Vous avez été mentionné dans un commentaire sur: ' || task_info.title
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_task_mentions_trigger
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_task_mentions();

-- 13. Enable realtime for tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
-- =====================================================
-- 0. CREATE HELPER FUNCTION IF NOT EXISTS
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- 1. Create enum for project roles (if not exists)
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_role') THEN
    CREATE TYPE public.project_role AS ENUM ('owner', 'editor', 'viewer');
  END IF;
END $$;

-- =====================================================
-- 2. Create project_collaborators table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role project_role NOT NULL DEFAULT 'viewer',
  invited_by UUID,
  invited_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, user_id)
);

-- =====================================================
-- 3. Create project_comments table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  section TEXT,
  parent_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- 4. Create project_versions table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  version_name TEXT NOT NULL,
  version_note TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =====================================================
-- 5. Enable RLS on all tables
-- =====================================================
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. RLS POLICIES FOR project_collaborators
-- =====================================================
CREATE POLICY "Project owners can manage collaborators"
  ON public.project_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_collaborators.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their collaborations"
  ON public.project_collaborators FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- 7. RLS POLICIES FOR project_comments
-- =====================================================
CREATE POLICY "Project members can view comments"
  ON public.project_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_comments.project_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_collaborators 
      WHERE project_id = project_comments.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can add comments"
  ON public.project_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_collaborators WHERE project_id = project_comments.project_id AND user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own comments"
  ON public.project_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON public.project_comments FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 8. RLS POLICIES FOR project_versions
-- =====================================================
CREATE POLICY "Project members can view versions"
  ON public.project_versions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_versions.project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_collaborators WHERE project_id = project_versions.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Editors can create versions"
  ON public.project_versions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND (
      EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM project_collaborators 
        WHERE project_id = project_versions.project_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'editor')
      )
    )
  );

CREATE POLICY "Owners can delete versions"
  ON public.project_versions FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_versions.project_id AND user_id = auth.uid())
  );

-- =====================================================
-- 9. UPDATE PROJECTS TABLE RLS (SELECT policy)
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;

CREATE POLICY "Users can view own and shared projects"
  ON public.projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_collaborators 
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. TRIGGER FOR updated_at on comments
-- =====================================================
CREATE TRIGGER update_project_comments_updated_at
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
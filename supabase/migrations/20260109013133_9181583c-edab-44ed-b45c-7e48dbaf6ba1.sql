-- Create security definer function to check project ownership (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_project_owner(project_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_uuid AND user_id = auth.uid()
  )
$$;

-- Drop existing problematic policies on project_collaborators
DROP POLICY IF EXISTS "Project owners can manage collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "Users can view their collaborations" ON public.project_collaborators;

-- Recreate policies using the security definer function
CREATE POLICY "Project owners can manage collaborators"
  ON public.project_collaborators FOR ALL
  USING (public.is_project_owner(project_id));

CREATE POLICY "Users can view their collaborations"
  ON public.project_collaborators FOR SELECT
  USING (user_id = auth.uid());

-- Drop and recreate policies on project_comments
DROP POLICY IF EXISTS "Project members can view comments" ON public.project_comments;
DROP POLICY IF EXISTS "Project members can add comments" ON public.project_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.project_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.project_comments;

CREATE POLICY "Project members can view comments"
  ON public.project_comments FOR SELECT
  USING (
    public.is_project_owner(project_id)
    OR EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_comments.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can add comments"
  ON public.project_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_project_owner(project_id)
      OR EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = project_comments.project_id
        AND project_collaborators.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update own comments"
  ON public.project_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON public.project_comments FOR DELETE
  USING (user_id = auth.uid());

-- Drop and recreate policies on project_versions
DROP POLICY IF EXISTS "Project members can view versions" ON public.project_versions;
DROP POLICY IF EXISTS "Editors can create versions" ON public.project_versions;
DROP POLICY IF EXISTS "Owners can delete versions" ON public.project_versions;

CREATE POLICY "Project members can view versions"
  ON public.project_versions FOR SELECT
  USING (
    public.is_project_owner(project_id)
    OR EXISTS (
      SELECT 1 FROM project_collaborators
      WHERE project_collaborators.project_id = project_versions.project_id
      AND project_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "Editors can create versions"
  ON public.project_versions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_project_owner(project_id)
      OR EXISTS (
        SELECT 1 FROM project_collaborators
        WHERE project_collaborators.project_id = project_versions.project_id
        AND project_collaborators.user_id = auth.uid()
        AND project_collaborators.role IN ('owner', 'editor')
      )
    )
  );

CREATE POLICY "Owners can delete versions"
  ON public.project_versions FOR DELETE
  USING (public.is_project_owner(project_id));
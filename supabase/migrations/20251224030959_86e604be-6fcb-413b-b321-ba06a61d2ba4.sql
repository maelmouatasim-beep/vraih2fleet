-- Add user_id column to projects table for ownership tracking
ALTER TABLE public.projects 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing projects to have no owner (they'll need to be reassigned or deleted)
-- For now, we'll leave them as NULL but new projects will require a user_id

-- Drop existing permissive policies on projects
DROP POLICY IF EXISTS "Anyone can read projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;

-- Create new owner-based policies for projects
CREATE POLICY "Users can view their own projects"
ON public.projects
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
USING (auth.uid() = user_id);

-- Drop existing permissive policies on scenarios
DROP POLICY IF EXISTS "Anyone can read scenarios" ON public.scenarios;
DROP POLICY IF EXISTS "Authenticated users can delete scenarios" ON public.scenarios;
DROP POLICY IF EXISTS "Authenticated users can insert scenarios" ON public.scenarios;
DROP POLICY IF EXISTS "Authenticated users can update scenarios" ON public.scenarios;

-- Create owner-based policies for scenarios (check project ownership)
CREATE POLICY "Users can view scenarios for their projects"
ON public.scenarios
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scenarios.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create scenarios for their projects"
ON public.scenarios
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scenarios.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update scenarios for their projects"
ON public.scenarios
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scenarios.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete scenarios for their projects"
ON public.scenarios
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = scenarios.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- Drop existing permissive policies on tco_results
DROP POLICY IF EXISTS "Anyone can read tco_results" ON public.tco_results;
DROP POLICY IF EXISTS "Authenticated users can delete tco_results" ON public.tco_results;
DROP POLICY IF EXISTS "Authenticated users can insert tco_results" ON public.tco_results;
DROP POLICY IF EXISTS "Authenticated users can update tco_results" ON public.tco_results;

-- Create owner-based policies for tco_results (check scenario's project ownership)
CREATE POLICY "Users can view tco_results for their scenarios"
ON public.tco_results
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.scenarios
    JOIN public.projects ON projects.id = scenarios.project_id
    WHERE scenarios.id = tco_results.scenario_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tco_results for their scenarios"
ON public.tco_results
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.scenarios
    JOIN public.projects ON projects.id = scenarios.project_id
    WHERE scenarios.id = tco_results.scenario_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tco_results for their scenarios"
ON public.tco_results
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.scenarios
    JOIN public.projects ON projects.id = scenarios.project_id
    WHERE scenarios.id = tco_results.scenario_id
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tco_results for their scenarios"
ON public.tco_results
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.scenarios
    JOIN public.projects ON projects.id = scenarios.project_id
    WHERE scenarios.id = tco_results.scenario_id
    AND projects.user_id = auth.uid()
  )
);
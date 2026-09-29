-- =====================================================
-- Revue externe, bloc B (B1-B3) : alignement de TOUT l'accès projet sur
-- can_view_project / can_edit_project (propriétaire + collaborateurs +
-- membres de l'organisation) — jusqu'ici scenarios, tco_results, tasks,
-- task_comments et transition_roadmaps ignoraient l'organisation.
-- B1 : UPDATE projects reçoit un WITH CHECK, et le TRANSFERT (user_id,
-- organization_id) est verrouillé au propriétaire/admin d'organisation.
-- B3 : un véhicule inclus dans un projet doit appartenir à la même
-- organisation que le projet (trigger), et les véhicules d'un projet
-- sont lisibles par quiconque voit le projet (fix « jointure null »
-- des collaborateurs externes).
-- Migration ADDITIVE (policies/fonctions recréées, aucune donnée touchée).
-- =====================================================

-- ────────────────────────────────────────────────────────────────────
-- B1. projects : WITH CHECK sur UPDATE + verrou de transfert
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners and org writers can update projects" ON public.projects;
CREATE POLICY "Owners and org writers can update projects"
  ON public.projects FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_writer(organization_id, auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_writer(organization_id, auth.uid()))
  );

-- Le transfert de propriété (user_id) ou d'organisation n'est permis
-- qu'au PROPRIÉTAIRE du projet ou à un ADMIN de son organisation — un
-- simple membre écrivain ne peut plus s'approprier un projet ni le
-- déplacer. auth.uid() NULL = service role (scripts d'administration).
CREATE OR REPLACE FUNCTION public.verrouiller_transfert_projet()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id)
     AND NOT (
       OLD.user_id = auth.uid()
       OR (OLD.organization_id IS NOT NULL AND public.is_org_admin(OLD.organization_id, auth.uid()))
     ) THEN
    RAISE EXCEPTION 'seul le propriétaire du projet ou un administrateur de son organisation peut le transférer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_verrou_transfert ON public.projects;
CREATE TRIGGER trg_projects_verrou_transfert
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.verrouiller_transfert_projet();

-- ────────────────────────────────────────────────────────────────────
-- B2. scenarios : accès par can_view/can_edit (organisation comprise)
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view scenarios for their projects" ON public.scenarios;
DROP POLICY IF EXISTS "Users can create scenarios for their projects" ON public.scenarios;
DROP POLICY IF EXISTS "Users can update scenarios for their projects" ON public.scenarios;
DROP POLICY IF EXISTS "Users can delete scenarios for their projects" ON public.scenarios;

CREATE POLICY "Project viewers can view scenarios"
  ON public.scenarios FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Project editors can create scenarios"
  ON public.scenarios FOR INSERT
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "Project editors can update scenarios"
  ON public.scenarios FOR UPDATE
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "Project editors can delete scenarios"
  ON public.scenarios FOR DELETE
  USING (public.can_edit_project(project_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────────
-- B2. tco_results : via le scénario parent
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view tco_results for their scenarios" ON public.tco_results;
DROP POLICY IF EXISTS "Users can create tco_results for their scenarios" ON public.tco_results;
DROP POLICY IF EXISTS "Users can update tco_results for their scenarios" ON public.tco_results;
DROP POLICY IF EXISTS "Users can delete tco_results for their scenarios" ON public.tco_results;

CREATE POLICY "Project viewers can view tco_results"
  ON public.tco_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scenarios s
    WHERE s.id = tco_results.scenario_id AND public.can_view_project(s.project_id, auth.uid())
  ));
CREATE POLICY "Project editors can create tco_results"
  ON public.tco_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scenarios s
    WHERE s.id = tco_results.scenario_id AND public.can_edit_project(s.project_id, auth.uid())
  ));
CREATE POLICY "Project editors can update tco_results"
  ON public.tco_results FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.scenarios s
    WHERE s.id = tco_results.scenario_id AND public.can_edit_project(s.project_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.scenarios s
    WHERE s.id = tco_results.scenario_id AND public.can_edit_project(s.project_id, auth.uid())
  ));
CREATE POLICY "Project editors can delete tco_results"
  ON public.tco_results FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.scenarios s
    WHERE s.id = tco_results.scenario_id AND public.can_edit_project(s.project_id, auth.uid())
  ));

-- ────────────────────────────────────────────────────────────────────
-- B2. tasks : lecture pour tout accès projet, écriture pour les éditeurs
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Project members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project editors can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project editors can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Project owners can delete tasks" ON public.tasks;

CREATE POLICY "Project viewers can view tasks"
  ON public.tasks FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Project editors can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (created_by = auth.uid() AND public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "Project editors can update tasks"
  ON public.tasks FOR UPDATE
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "Project editors can delete tasks"
  ON public.tasks FOR DELETE
  USING (public.can_edit_project(project_id, auth.uid()));

-- ────────────────────────────────────────────────────────────────────
-- B2. task_comments : via la tâche parente ; la modification et la
-- suppression restent réservées à l'auteur (policies existantes).
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Project members can view task comments" ON public.task_comments;
DROP POLICY IF EXISTS "Project members can add task comments" ON public.task_comments;

CREATE POLICY "Project viewers can view task comments"
  ON public.task_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_comments.task_id AND public.can_view_project(t.project_id, auth.uid())
  ));
CREATE POLICY "Project editors can add task comments"
  ON public.task_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_comments.task_id AND public.can_edit_project(t.project_id, auth.uid())
    )
  );

-- ────────────────────────────────────────────────────────────────────
-- B2. transition_roadmaps : mêmes règles ; les tables enfants
-- (phases/jalons/flux/alertes) suivent automatiquement — leurs SELECT
-- passent par la visibilité du roadmap, leurs écritures par
-- can_edit_roadmap, redéfini ci-dessous sur can_edit_project.
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view roadmaps for their projects" ON public.transition_roadmaps;
DROP POLICY IF EXISTS "Users can create roadmaps for their projects" ON public.transition_roadmaps;
DROP POLICY IF EXISTS "Users can update roadmaps for their projects" ON public.transition_roadmaps;
DROP POLICY IF EXISTS "Users can delete roadmaps for their projects" ON public.transition_roadmaps;

CREATE POLICY "Project viewers can view roadmaps"
  ON public.transition_roadmaps FOR SELECT
  USING (public.can_view_project(project_id, auth.uid()));
CREATE POLICY "Project editors can create roadmaps"
  ON public.transition_roadmaps FOR INSERT
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "Project editors can update roadmaps"
  ON public.transition_roadmaps FOR UPDATE
  USING (public.can_edit_project(project_id, auth.uid()))
  WITH CHECK (public.can_edit_project(project_id, auth.uid()));
CREATE POLICY "Project editors can delete roadmaps"
  ON public.transition_roadmaps FOR DELETE
  USING (public.can_edit_project(project_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.can_edit_roadmap(_roadmap_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM transition_roadmaps tr
    WHERE tr.id = _roadmap_id
      AND public.can_edit_project(tr.project_id, auth.uid())
  );
$$;

-- ────────────────────────────────────────────────────────────────────
-- B3. project_vehicles : le véhicule doit appartenir à la même
-- organisation que le projet (un projet sans organisation exige un
-- véhicule d'une organisation dont l'utilisateur est membre).
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verifier_vehicule_meme_organisation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  org_projet UUID;
  org_vehicule UUID;
BEGIN
  SELECT organization_id INTO org_projet FROM projects WHERE id = NEW.project_id;
  SELECT organization_id INTO org_vehicule FROM vehicles WHERE id = NEW.vehicle_id;
  IF org_projet IS NOT NULL THEN
    IF org_vehicule IS DISTINCT FROM org_projet THEN
      RAISE EXCEPTION 'le véhicule n''appartient pas à l''organisation du projet';
    END IF;
  ELSIF auth.uid() IS NOT NULL AND NOT public.is_org_member(org_vehicule, auth.uid()) THEN
    RAISE EXCEPTION 'le véhicule appartient à une autre organisation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_vehicles_meme_org ON public.project_vehicles;
CREATE TRIGGER trg_project_vehicles_meme_org
  BEFORE INSERT OR UPDATE ON public.project_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.verifier_vehicule_meme_organisation();

-- ────────────────────────────────────────────────────────────────────
-- B3. vehicles : lisibles par quiconque peut VOIR un projet qui les
-- inclut (le collaborateur externe recevait une jointure NULL et
-- l'écran plantait). L'écriture reste réservée à l'organisation.
-- ────────────────────────────────────────────────────────────────────
CREATE POLICY "Project viewers can view project vehicles"
  ON public.vehicles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_vehicles pv
    WHERE pv.vehicle_id = vehicles.id AND public.can_view_project(pv.project_id, auth.uid())
  ));

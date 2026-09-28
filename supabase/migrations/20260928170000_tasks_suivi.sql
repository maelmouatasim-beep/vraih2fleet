-- Phase 3, bloc 7 (étape Suivi) : tâches intégrées au parcours projet.
-- 1) Correction du DOUBLE déclencheur de notification d'assignation :
--    la migration 20260118… créait notify_task_assignment_trigger
--    (AFTER INSERT OR UPDATE) puis la migration 20260122… a remplacé la
--    fonction (version qui référence OLD, donc erreur sur INSERT) et
--    ajouté un second déclencheur on_task_assignment (AFTER UPDATE) sans
--    retirer le premier → deux notifications par assignation lors d'un
--    UPDATE, et INSERT cassé. On garde UN déclencheur, avec une fonction
--    sûre pour INSERT et UPDATE.
-- 2) Colonnes de liaison du Suivi : véhicule, année du plan, programme
--    de subvention (identifiant du registre en code) et clé d'auto-
--    génération idempotente. Additif seulement, aucune donnée touchée.

-- =====================================================
-- 1. Un seul déclencheur d'assignation, sûr pour INSERT et UPDATE
-- =====================================================
DROP TRIGGER IF EXISTS notify_task_assignment_trigger ON public.tasks;
DROP TRIGGER IF EXISTS on_task_assignment ON public.tasks;

CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
DECLARE
  anciens UUID[];
  nouvel_assigne UUID;
  nom_projet TEXT;
BEGIN
  anciens := CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.assigned_to, '{}') ELSE '{}' END;
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  SELECT name INTO nom_projet FROM projects WHERE id = NEW.project_id;

  FOREACH nouvel_assigne IN ARRAY COALESCE(NEW.assigned_to, '{}')
  LOOP
    IF NOT (nouvel_assigne = ANY(anciens)) THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, related_id)
      VALUES (
        nouvel_assigne,
        'task_assigned',
        'Nouvelle tâche assignée',
        format('Vous avez été assigné à la tâche "%s" dans le projet %s', NEW.title, nom_projet),
        NEW.project_id,
        NEW.id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_task_assignment
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();

-- =====================================================
-- 2. Liaisons du Suivi (additif)
-- =====================================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_year INTEGER
    CHECK (plan_year IS NULL OR (plan_year BETWEEN 2000 AND 2100)),
  ADD COLUMN IF NOT EXISTS subsidy_program TEXT,
  ADD COLUMN IF NOT EXISTS auto_key TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_vehicle ON public.tasks(vehicle_id);
-- Génération idempotente des tâches du plan : une seule tâche auto par
-- clé et par projet, même si on regénère plusieurs fois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_auto_key
  ON public.tasks(project_id, auto_key)
  WHERE auto_key IS NOT NULL;


-- Supprimer le trigger mal configuré sur la table projects
DROP TRIGGER IF EXISTS update_reference_last_updated ON public.projects;

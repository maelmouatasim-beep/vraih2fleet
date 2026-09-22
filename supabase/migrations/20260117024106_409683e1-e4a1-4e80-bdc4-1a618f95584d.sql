
-- Supprimer le trigger mal configuré sur projects
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;

-- Recréer le trigger avec la bonne fonction
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

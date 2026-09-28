-- Phase 2d de la refonte : UN SEUL résultat TCO courant par scénario.
-- Chaque recalcul ajoutait une ligne dans tco_results et les agrégats
-- (Dashboard, Analytics) additionnaient TOUTES les lignes : 120 véhicules
-- affichés pour une flotte de 40, 178 088 t de CO2 « évitées par an ».
-- L'historique est CONSERVÉ (aucune suppression de données) ; seule la
-- ligne la plus récente de chaque scénario reste marquée courante.

ALTER TABLE public.tco_results
  ADD COLUMN is_current BOOLEAN NOT NULL DEFAULT true;

-- Rattrapage : ne garder courant que le résultat le plus récent de
-- chaque scénario (départage par id en cas d'égalité de date).
UPDATE public.tco_results t
SET is_current = false
WHERE EXISTS (
  SELECT 1 FROM public.tco_results t2
  WHERE t2.scenario_id = t.scenario_id
    AND (
      t2.created_at > t.created_at
      OR (t2.created_at = t.created_at AND t2.id > t.id)
    )
);

-- Garantie structurelle : au plus UNE ligne courante par scénario.
CREATE UNIQUE INDEX uniq_tco_results_current
  ON public.tco_results (scenario_id)
  WHERE is_current;

-- Chaque nouvel enregistrement devient LE courant : les précédents du
-- même scénario passent à l'historique avant l'insertion.
CREATE OR REPLACE FUNCTION public.demote_previous_tco_results()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.is_current := true;
  UPDATE tco_results
  SET is_current = false
  WHERE scenario_id = NEW.scenario_id AND is_current;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tco_results_demote_previous
  BEFORE INSERT ON public.tco_results
  FOR EACH ROW EXECUTE FUNCTION public.demote_previous_tco_results();

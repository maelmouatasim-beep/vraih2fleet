-- =====================================================
-- Revue externe B7 : deux recalculs SIMULTANÉS du même scénario
-- pouvaient violer l'index unique partiel uniq_tco_results_current
-- (chaque transaction rétrogradait ce qu'elle voyait puis insérait sa
-- ligne courante). Un verrou consultatif TRANSACTIONNEL par scénario
-- sérialise les insertions : la deuxième attend la première, puis
-- rétrograde sa ligne — plus aucune erreur d'unicité, et toujours
-- exactement UNE ligne courante.
-- =====================================================
CREATE OR REPLACE FUNCTION public.demote_previous_tco_results()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Sérialise les insertions concurrentes du même scénario (le verrou
  -- se libère à la fin de la transaction).
  PERFORM pg_advisory_xact_lock(hashtext('tco_results_current:' || NEW.scenario_id::text));
  NEW.is_current := true;
  UPDATE tco_results
  SET is_current = false
  WHERE scenario_id = NEW.scenario_id AND is_current;
  RETURN NEW;
END;
$$;

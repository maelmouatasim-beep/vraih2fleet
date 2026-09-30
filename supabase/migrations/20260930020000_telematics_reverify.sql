-- =====================================================
-- Revue externe D5 — lignes télématiques générées AVANT la correction de
-- la phase 2c (valeurs aléatoires de kilométrage/consommation) : elles
-- avaient reçu le défaut « estimation » à l'ajout de la colonne. Elles
-- sont marquées « a_reverifier » : l'import vers Ma flotte n'en reprend
-- que l'identité (NIV, marque, modèle, année), JAMAIS les mesures. Une
-- nouvelle synchronisation réécrit la provenance réelle.
-- Aucune ligne supprimée.
-- =====================================================
ALTER TABLE public.telematics_vehicles
  DROP CONSTRAINT IF EXISTS telematics_vehicles_consumption_source_check;

ALTER TABLE public.telematics_vehicles
  ADD CONSTRAINT telematics_vehicles_consumption_source_check
  CHECK (consumption_source IN ('telematique', 'estimation', 'a_reverifier'));

-- Correction de la phase 2c poussée le 2026-09-28 (migration
-- 20260928160000) : toute ligne créée avant n'a pas de mesure fiable.
UPDATE public.telematics_vehicles
SET consumption_source = 'a_reverifier'
WHERE created_at < TIMESTAMPTZ '2026-09-28 16:00:00+00'
  AND consumption_source = 'estimation';

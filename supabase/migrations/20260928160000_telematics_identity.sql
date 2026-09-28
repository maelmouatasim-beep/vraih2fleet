-- Phase 2c de la refonte : identité des véhicules télématiques.
-- Les APIs (Samsara, Geotab) fournissent VIN, marque, modèle et année :
-- on les importe au lieu de les perdre, pour permettre le rapprochement
-- telematics_vehicles → vehicles (« Ma flotte »).
ALTER TABLE public.telematics_vehicles
  ADD COLUMN vin TEXT,
  ADD COLUMN make TEXT,
  ADD COLUMN model TEXT,
  ADD COLUMN model_year INTEGER
    CHECK (model_year IS NULL OR (model_year BETWEEN 1950 AND 2100)),
  -- provenance de la consommation stockée : mesure API ou défaut de
  -- catégorie (aucune valeur inventée — Phase 2c)
  ADD COLUMN consumption_source TEXT NOT NULL DEFAULT 'estimation'
    CHECK (consumption_source IN ('telematique', 'estimation'));

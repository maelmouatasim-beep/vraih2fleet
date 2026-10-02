-- Test terrain, bloc 3.1 : une consommation venue d'un fichier importé
-- est marquée « import » (et non « saisie », réservé à la saisie dans la
-- fiche du véhicule). Contrainte seulement élargie. Additive.
ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_consumption_source_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_consumption_source_check
  CHECK (consumption_source IN ('saisie', 'import', 'telematique', 'estimation'));

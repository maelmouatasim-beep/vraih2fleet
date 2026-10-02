-- Test terrain, bloc 2.2 : classe de poids réglementaire (PNBV, classes
-- 1 à 8 avec 2a/2b) du véhicule. Elle détermine le barème EXACT des
-- programmes par classe (Écocamionnage) ; sans elle, le résolveur retient
-- le barème le plus bas par prudence. Saisie à l'import ou sur la fiche ;
-- l'application PROPOSE une classe (catégorie, modèle) que l'utilisateur
-- confirme — seule une classe confirmée est enregistrée. Additive.
ALTER TABLE public.vehicles
  ADD COLUMN gvwr_class TEXT
    CHECK (gvwr_class IS NULL OR gvwr_class IN ('1', '2a', '2b', '3', '4', '5', '6', '7', '8'));

COMMENT ON COLUMN public.vehicles.gvwr_class IS
  'Classe de poids PNBV confirmée (1, 2a, 2b, 3-8) — barème exact des subventions par classe';

-- Test terrain, bloc 2.4 : kilométrage journalier MAXIMAL du véhicule
-- (jour le plus chargé, tournée de déneigement…), comparé à l'autonomie
-- hivernale réelle d'un modèle électrique et à la fenêtre de recharge du
-- garage. Absent : estimé km/an ÷ jours d'utilisation (signalé). Additive.
ALTER TABLE public.vehicles
  ADD COLUMN max_daily_km NUMERIC CHECK (max_daily_km IS NULL OR (max_daily_km >= 0 AND max_daily_km <= 5000));

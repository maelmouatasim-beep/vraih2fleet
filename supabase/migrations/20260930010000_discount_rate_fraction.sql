-- =====================================================
-- Revue externe (D4) — UNITÉ DU TAUX D'ACTUALISATION DES PROJETS.
-- Deux conventions coexistaient : la création de projet (écran et API
-- MCP) écrivait une FRACTION (0.05 = 5 %), alors que le défaut de la
-- colonne (5.0), la démo et le moteur lisaient des POUR CENT. Un projet
-- créé à l'écran était donc actualisé à 0,05 % au lieu de 5 %.
-- Convention unique retenue : FRACTION décimale (0.05 = 5 %).
-- Correction d'unité des lignes existantes (aucune ligne supprimée) :
-- une valeur >= 1 est un pourcentage et est divisée par 100.
-- =====================================================
UPDATE public.projects
SET default_discount_rate = default_discount_rate / 100
WHERE default_discount_rate >= 1;

ALTER TABLE public.projects
  ALTER COLUMN default_discount_rate SET DEFAULT 0.05;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_discount_rate_fraction
  CHECK (default_discount_rate >= 0 AND default_discount_rate < 1);

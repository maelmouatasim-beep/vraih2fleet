-- =====================================================
-- Security Advisor (CRITICAL « security definer view ») :
-- public.hydrogen_suppliers_directory lisait public.hydrogen_suppliers avec
-- les droits de son propriétaire, contournant la RLS de la table. La vue
-- n'est plus utilisée (module fournisseurs retiré en Phase 2 ; aucune
-- lecture dans l'application, les fonctions ni l'API) : elle est
-- supprimée. Aucune donnée n'est touchée — la table hydrogen_suppliers et
-- sa RLS (lecture réservée aux administrateurs H2Fleet) restent en place.
-- =====================================================

DROP VIEW IF EXISTS public.hydrogen_suppliers_directory;

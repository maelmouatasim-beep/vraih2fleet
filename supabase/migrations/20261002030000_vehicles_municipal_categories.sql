-- Test terrain, bloc 2.3 : catégories municipales — déneigeuse,
-- souffleuse, camion à benne, véhicule spécialisé/outil, véhicule
-- d'urgence. Le moteur TCO leur prête les défauts d'une de ses
-- catégories (signalés « estimation » dans l'application) ; celles sans
-- véhicule électrique crédible sont « à reporter ». La contrainte est
-- seulement ÉLARGIE : toute valeur déjà valide le reste.
ALTER TABLE public.vehicles DROP CONSTRAINT vehicles_category_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_category_check CHECK (category IN (
  'vehicule_leger', 'camionnette', 'camion_moyen', 'camion_lourd', 'autobus_urbain_12m',
  'deneigeuse', 'souffleuse', 'camion_benne', 'vehicule_specialise', 'vehicule_urgence',
  'autre'
));

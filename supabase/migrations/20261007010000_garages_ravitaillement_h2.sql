-- Audit acheteur, ajustement A (moteur 2.5.0, méthodologie §3.5) :
-- ravitaillement des véhicules à hydrogène d'un garage — station au dépôt
-- ou station EXTERNE (prix livré $/kg, détour optionnel, aucun capex de
-- station au dépôt). « auto » = station externe sous le seuil du registre
-- (seuil_station_h2_depot_vehicules), station au dépôt sinon.
-- Migration ADDITIVE : colonnes nullables / avec défaut, RLS de la table
-- garages inchangée (déjà en place).

alter table public.garages
  add column if not exists h2_refuelling text not null default 'auto',
  add column if not exists h2_external_price_per_kg numeric,
  add column if not exists h2_detour_km_per_day numeric;

alter table public.garages
  drop constraint if exists garages_h2_refuelling_check,
  add constraint garages_h2_refuelling_check check (h2_refuelling in ('auto', 'depot', 'externe'));

alter table public.garages
  drop constraint if exists garages_h2_external_price_check,
  add constraint garages_h2_external_price_check check (h2_external_price_per_kg is null or (h2_external_price_per_kg > 0 and h2_external_price_per_kg < 1000));

alter table public.garages
  drop constraint if exists garages_h2_detour_check,
  add constraint garages_h2_detour_check check (h2_detour_km_per_day is null or (h2_detour_km_per_day >= 0 and h2_detour_km_per_day <= 1000));

comment on column public.garages.h2_refuelling is
  'Ravitaillement H2 : auto (station externe sous le seuil du registre), depot (station au dépôt), externe (station externe).';
comment on column public.garages.h2_external_price_per_kg is
  'Prix livré à la station H2 externe, $/kg avant taxes ; null = prix du projet (registre ou donnée client).';
comment on column public.garages.h2_detour_km_per_day is
  'Détour aller-retour par jour d''utilisation pour rejoindre la station externe (km).';

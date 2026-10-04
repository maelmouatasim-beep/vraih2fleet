-- Audit acheteur, point 6 : appliquer une stratégie (ou un lissage des
-- remplacements) en UNE écriture atomique au lieu d'une requête par
-- véhicule (846 changements : plus de 5 min, plan à moitié modifié si la
-- page était quittée). SECURITY INVOKER : la RLS de project_vehicles
-- s'applique (seuls les éditeurs du projet modifient) ; si une seule ligne
-- est refusée ou n'appartient pas au projet, RIEN n'est écrit.
-- Migration ADDITIVE (nouvelle fonction, aucune table modifiée).

create or replace function public.apply_project_vehicle_changes(_project uuid, _changes jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  attendu integer;
  appliques integer;
begin
  if _changes is null or jsonb_typeof(_changes) <> 'array' then
    raise exception 'changements attendus sous forme de tableau' using errcode = '22023';
  end if;
  attendu := jsonb_array_length(_changes);
  if attendu = 0 then
    return 0;
  end if;
  if attendu > 5000 then
    raise exception 'trop de changements en une fois (% > 5000)', attendu using errcode = '22023';
  end if;

  update public.project_vehicles pv
     set target_technology = case when c.v ? 'target_technology' then c.v->>'target_technology' else pv.target_technology end,
         replacement_year  = case when c.v ? 'replacement_year' then (c.v->>'replacement_year')::integer else pv.replacement_year end,
         updated_at = now()
    from jsonb_array_elements(_changes) as c(v)
   where pv.id = (c.v->>'id')::uuid
     and pv.project_id = _project;
  get diagnostics appliques = row_count;

  if appliques <> attendu then
    raise exception 'changements refusés : % sur % applicables (droits d''édition ou véhicules hors du projet) — aucun changement écrit', appliques, attendu
      using errcode = '42501';
  end if;
  return appliques;
end;
$$;

revoke all on function public.apply_project_vehicle_changes(uuid, jsonb) from public, anon;
grant execute on function public.apply_project_vehicle_changes(uuid, jsonb) to authenticated;

comment on function public.apply_project_vehicle_changes(uuid, jsonb) is
  'Applique en une transaction des changements {id, target_technology?, replacement_year?} aux véhicules d''un projet ; RLS appliquée (security invoker), tout ou rien.';

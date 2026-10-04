/**
 * Nombre de véhicules par projet (cartes de la liste des projets) — PUR,
 * testable sans client Supabase : compte les lignes project_vehicles.
 */
export function compterVehiculesParProjet(lignes: { project_id: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lignes) m.set(l.project_id, (m.get(l.project_id) ?? 0) + 1);
  return m;
}

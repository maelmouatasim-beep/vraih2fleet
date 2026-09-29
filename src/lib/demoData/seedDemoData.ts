/**
 * Chargement du projet de DÉMONSTRATION (« Ville de Rivière-Claire »,
 * municipalité fictive, ~40 véhicules) : la démo n'insère AUCUN
 * résultat pré-calculé — seulement la flotte et les sélections du
 * parcours ; toutes les étapes (Faisabilité, Stratégies, Plan,
 * Financement, Rapports) calculent en direct avec le moteur src/lib/tco.
 * Recharger la démo remplace l'ancienne (véhicules marqués + projet).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  MARQUEUR_DEMO,
  NOM_PROJET_DEMO,
  genererFlotteDemo,
  planDemo,
} from "./villeDemo";

async function organisationDe(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Aucune organisation pour cet utilisateur");
  return data.organization_id;
}

export async function checkDemoProjectExists(userId: string): Promise<string | null> {
  // .limit(1) et pas maybeSingle : d'anciens rechargements interrompus
  // peuvent avoir laissé plusieurs projets démo (C7 — jamais d'erreur ici)
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", NOM_PROJET_DEMO)
    .limit(1);
  return data?.[0]?.id ?? null;
}

/** Retire l'ancienne démo (TOUS les projets démo + véhicules marqués)
 *  avant rechargement — aucun doublon possible (C7). */
export async function deleteDemoProject(userId: string, organizationId: string): Promise<void> {
  // project_vehicles et tasks suivent par ON DELETE CASCADE
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("user_id", userId)
    .eq("name", NOM_PROJET_DEMO);
  if (error) throw error;
  await deleteDemoVehicles(organizationId);
}

/** Supprime les véhicules MARQUÉS démo de l'organisation (C7 : appelés
 *  aussi quand le projet démo est supprimé depuis la liste des projets). */
export async function deleteDemoVehicles(organizationId: string): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("organization_id", organizationId)
    .like("notes", `%${MARQUEUR_DEMO}%`);
  if (error) throw error;
}

export async function seedDemoProject(userId: string): Promise<{ projectId: string }> {
  const organizationId = await organisationDe(userId);
  await deleteDemoProject(userId, organizationId);

  const { data: projet, error: errProjet } = await supabase
    .from("projects")
    .insert({
      name: NOM_PROJET_DEMO,
      description:
        "Projet de démonstration — municipalité fictive d'environ 40 véhicules. " +
        "Données de flotte fictives ; tous les chiffres sont calculés en direct par le moteur TCO.",
      country_or_region: "CA_QC",
      currency: "CAD",
      default_analysis_horizon_years: 10,
      default_discount_rate: 5,
      user_id: userId,
      organization_id: organizationId,
    })
    .select("id")
    .single();
  if (errProjet) throw errProjet;

  const flotte = genererFlotteDemo();
  const { data: inseres, error: errVehicules } = await supabase
    .from("vehicles")
    .insert(flotte.map((v) => ({ ...v, organization_id: organizationId })))
    .select("id, unit_number");
  if (errVehicules) throw errVehicules;

  const idParUnite = new Map((inseres ?? []).map((v) => [v.unit_number, v.id]));
  const plan = planDemo(flotte, new Date().getFullYear());
  const { error: errPlan } = await supabase.from("project_vehicles").insert(
    plan
      .filter((p) => idParUnite.has(p.unit_number))
      .map((p) => ({
        project_id: projet.id,
        vehicle_id: idParUnite.get(p.unit_number)!,
        replacement_year: p.replacement_year,
        target_technology: p.target_technology,
      })),
  );
  if (errPlan) throw errPlan;

  return { projectId: projet.id };
}

export function getDemoProjectInfo() {
  return {
    name: NOM_PROJET_DEMO,
    description: "Municipalité québécoise fictive, ~40 véhicules — parcours complet calculé en direct.",
    vehicleCount: genererFlotteDemo().length,
    scenarioCount: 3, // les trois stratégies de l'étape Stratégies
    region: "Québec, Canada",
    source: "Données fictives (démonstration)",
  };
}

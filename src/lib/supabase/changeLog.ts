/**
 * Journal des actions (Phase 5) : chaque modification appliquée après
 * confirmation (stratégie, optimiseur, copilote, import, document…) laisse
 * une ligne IMMUABLE — qui (id du compte, posé par la base), quand, quoi,
 * avec l'aperçu avant → après. Aucune donnée personnelle dans les détails.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { EntreeJournal } from "@/lib/journey/changeLog";

export type LigneJournal = Tables<"plan_change_log">;

export async function journaliser(e: EntreeJournal): Promise<void> {
  const { error } = await supabase.from("plan_change_log").insert({
    organization_id: e.organizationId,
    project_id: e.projectId ?? null,
    source: e.source,
    action: e.action,
    summary: e.resume ?? null,
    details: { changements: e.changements } as unknown as Json,
  });
  if (error) throw error;
}

export async function listerJournalProjet(projectId: string, limite = 50): Promise<LigneJournal[]> {
  const { data, error } = await supabase
    .from("plan_change_log")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

/** Journal de la FLOTTE de l'organisation (imports, hors projet). */
export async function listerJournalFlotte(organizationId: string, limite = 30): Promise<LigneJournal[]> {
  const { data, error } = await supabase
    .from("plan_change_log")
    .select("*")
    .eq("organization_id", organizationId)
    .is("project_id", null)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

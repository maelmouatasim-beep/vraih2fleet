/**
 * Phase 5.6 — État des alertes de surveillance (table plan_alerts) :
 * lecture (RLS : membres du projet), synchronisation et « vue » par des
 * fonctions SQL qui vérifient le droit d'édition du projet.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

export type LigneAlertePlan = Tables<"plan_alerts">;

export interface AlerteASynchroniser {
  alert_key: string;
  kind: string;
  severity: string;
  title_fr: string;
  title_en: string;
  message_fr: string;
  message_en: string;
}

export async function listerAlertesPlan(projectId: string): Promise<LigneAlertePlan[]> {
  const { data, error } = await supabase
    .from("plan_alerts")
    .select("*")
    .eq("project_id", projectId)
    .is("resolved_at", null)
    .order("first_seen_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

/** Renvoie false si l'utilisateur ne peut pas éditer le projet (rien n'est écrit). */
export async function synchroniserAlertesPlan(projectId: string, alertes: AlerteASynchroniser[]): Promise<boolean> {
  const { data, error } = await supabase.rpc("sync_plan_alerts", {
    _project: projectId,
    _alerts: alertes as unknown as Json,
  });
  if (error) throw error;
  return data === true;
}

export async function marquerAlerteVue(id: string): Promise<void> {
  const { error } = await supabase.rpc("dismiss_plan_alert", { _alert: id });
  if (error) throw error;
}

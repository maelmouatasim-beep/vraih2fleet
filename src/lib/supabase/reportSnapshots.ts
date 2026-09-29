/**
 * Snapshots de rapports (règle A1) : chaque rapport généré FIGE le plan
 * (version du moteur + empreinte des entrées + paramètres + chiffres
 * clés). Lignes immuables — de nouvelles données ne changent jamais un
 * rapport émis ; on compare l'empreinte courante au dernier snapshot
 * pour afficher « Données mises à jour disponibles » (avant→après).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

export type ReportSnapshot = Tables<"report_snapshots">;

export interface NouveauSnapshot {
  projectId: string;
  strategyKey: "plan_actuel" | "tout_electrique" | "economies_d_abord";
  reportKind: "pdf_fr" | "pdf_en" | "xlsx";
  engineVersion: string;
  fingerprint: string;
  parameters: Json;
  van: number;
  tcoAlt: number;
  tcoRef: number;
}

export async function insererSnapshotRapport(s: NouveauSnapshot): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("report_snapshots").insert({
    project_id: s.projectId,
    strategy_key: s.strategyKey,
    report_kind: s.reportKind,
    engine_version: s.engineVersion,
    fingerprint: s.fingerprint,
    parameters: s.parameters,
    van: s.van,
    tco_alt: s.tcoAlt,
    tco_ref: s.tcoRef,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function dernierSnapshotRapport(projectId: string): Promise<ReportSnapshot | null> {
  const { data, error } = await supabase
    .from("report_snapshots")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

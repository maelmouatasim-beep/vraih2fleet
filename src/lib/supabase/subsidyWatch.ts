/**
 * Phase 5.5 — Veille des subventions : file de validation (administrateurs
 * H2Fleet, RLS has_role) et événements VALIDÉS (lisibles par tous).
 * Valider / rejeter passent par des fonctions SQL atomiques ; rien n'est
 * jamais appliqué automatiquement au registre.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ChangementVeille = Tables<"subsidy_watch_changes">;
export type EvenementProgramme = Tables<"subsidy_program_events">;

/** Archive des textes lus (dépôt GitHub, branche par défaut). */
export const ARCHIVE_VEILLE = "https://github.com/maelmouatasim-beep/vraih2fleet/blob/claude/code-integration-site-o88hza/";

export async function listerFileVeille(statut: "pending" | "validated" | "rejected" = "pending"): Promise<ChangementVeille[]> {
  const { data, error } = await supabase
    .from("subsidy_watch_changes")
    .select("*")
    .eq("status", statut)
    .order("detected_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listerEvenementsProgrammes(programmes?: string[]): Promise<EvenementProgramme[]> {
  let q = supabase.from("subsidy_program_events").select("*");
  if (programmes) {
    if (programmes.length === 0) return [];
    q = q.in("program_id", programmes);
  }
  const { data, error } = await q.order("validated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function validerChangement(id: string, resumeFr: string, resumeEn: string, note: string | null): Promise<void> {
  const { error } = await supabase.rpc("validate_subsidy_change", {
    _change: id,
    _summary_fr: resumeFr,
    _summary_en: resumeEn,
    _note: note,
  });
  if (error) throw error;
}

export async function rejeterChangement(id: string, note: string | null): Promise<void> {
  const { error } = await supabase.rpc("reject_subsidy_change", { _change: id, _note: note });
  if (error) throw error;
}

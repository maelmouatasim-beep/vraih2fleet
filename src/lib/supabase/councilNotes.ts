/**
 * Phase 5.7 — Notes au conseil (table council_notes, RLS : lecture par
 * les membres du projet, écriture par ses éditeurs, aucune suppression)
 * et rédaction par la fonction Edge `council-note` (texte à jetons, aucun
 * chiffre écrit par l'IA).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { appelerFonctionIa } from "@/lib/supabase/ai";
import type { FaitTransmis, SectionsNote } from "../../../supabase/functions/_shared/councilNote";
import type { FaitNote } from "@/lib/journey/councilNote";

export type NoteConseilRow = Tables<"council_notes">;

export async function derniereNote(projectId: string): Promise<NoteConseilRow | null> {
  const { data, error } = await supabase
    .from("council_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface NoteAEnregistrer {
  id?: string;
  projectId: string;
  langue: "fr" | "en";
  sections: SectionsNote;
  faits: FaitNote[];
  source: "ia" | "modele";
  engineVersion: string;
  fingerprint: string;
  reportSnapshotId?: string | null;
  exportee?: boolean;
}

export async function enregistrerNote(n: NoteAEnregistrer): Promise<NoteConseilRow> {
  const { data: auth } = await supabase.auth.getUser();
  const ligne = {
    project_id: n.projectId,
    language: n.langue,
    sections: n.sections as unknown as Json,
    facts: n.faits as unknown as Json,
    source: n.source,
    engine_version: n.engineVersion,
    fingerprint: n.fingerprint,
    ...(n.reportSnapshotId !== undefined ? { report_snapshot_id: n.reportSnapshotId } : {}),
    ...(n.exportee ? { exported_at: new Date().toISOString() } : {}),
  };
  const requete = n.id
    ? supabase.from("council_notes").update(ligne).eq("id", n.id)
    : supabase.from("council_notes").insert({ ...ligne, created_by: auth.user?.id ?? null });
  const { data, error } = await requete.select("*").single();
  if (error) throw error;
  return data;
}

export type SortieRedaction =
  | { type: "note"; sections: SectionsNote; tentatives: number; ecartsRejetes: number }
  | { type: "refus" }
  | { type: "invalide"; ecarts: { section: string; type: string; extrait: string }[] };

export function redigerNoteIa(projectId: string, langue: "fr" | "en", faits: FaitTransmis[]): Promise<SortieRedaction> {
  return appelerFonctionIa<SortieRedaction>("council-note", { projectId, langue, faits });
}

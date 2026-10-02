/**
 * Fonctions IA (Phase 5) : réglages par organisation (activables,
 * plafonds), consommation, historique du copilote et appel de la fonction
 * Edge `copilot` (clé Anthropic côté serveur uniquement).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ReglagesIaRow = Tables<"organization_ai_settings">;
export type MessageCopiloteRow = Tables<"copilot_messages">;

export async function lireReglagesIa(organizationId: string): Promise<ReglagesIaRow | null> {
  const { data, error } = await supabase
    .from("organization_ai_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function enregistrerReglagesIa(
  organizationId: string,
  patch: Omit<TablesInsert<"organization_ai_settings">, "organization_id">,
): Promise<void> {
  const { error } = await supabase
    .from("organization_ai_settings")
    .upsert({ organization_id: organizationId, ...patch }, { onConflict: "organization_id" });
  if (error) throw error;
}

export interface ResumeUsageIa {
  month_input_tokens: number;
  month_output_tokens: number;
  month_cache_read_tokens: number;
  month_requests: number;
  today_requests: number;
}

export async function resumeUsageIa(organizationId: string): Promise<ResumeUsageIa | null> {
  const { data, error } = await supabase.rpc("ai_usage_summary", { _org: organizationId });
  if (error) throw error;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
  if (!r) return null;
  return {
    month_input_tokens: Number(r.month_input_tokens ?? 0),
    month_output_tokens: Number(r.month_output_tokens ?? 0),
    month_cache_read_tokens: Number(r.month_cache_read_tokens ?? 0),
    month_requests: Number(r.month_requests ?? 0),
    today_requests: Number(r.today_requests ?? 0),
  };
}

export async function listerMessagesCopilote(projectId: string, limite = 60): Promise<MessageCopiloteRow[]> {
  const { data, error } = await supabase
    .from("copilot_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

/** Codes d'erreur stables de la fonction `copilot` (affichés via i18n). */
export type CodeErreurIa =
  | "service_non_configure"
  | "fonction_desactivee"
  | "quota_journalier"
  | "quota_mensuel"
  | "trop_de_requetes"
  | "projet_introuvable"
  | "erreur_service";

export class ErreurIa extends Error {
  constructor(public code: CodeErreurIa) {
    super(code);
  }
}

/** Appelle une fonction Edge IA et convertit ses erreurs en codes stables. */
export async function appelerFonctionIa<T>(nom: string, corps: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nom, { body: corps });
  if (!error) return data as T;
  const reponse = (error as { context?: unknown }).context;
  if (reponse instanceof Response) {
    try {
      const json = await reponse.clone().json();
      if (typeof json?.error === "string") throw new ErreurIa(json.error as CodeErreurIa);
    } catch (e) {
      if (e instanceof ErreurIa) throw e;
    }
  }
  throw new ErreurIa("erreur_service");
}

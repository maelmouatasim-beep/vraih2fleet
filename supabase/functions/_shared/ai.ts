// Accès à l'API Claude (Anthropic) pour les fonctions IA de H2Fleet.
//
// - Clé ANTHROPIC_API_KEY côté serveur uniquement (secret Supabase) ;
//   absente → 503 `service_non_configure` (message propre côté client).
// - Interrupteur global AI_FEATURES_DISABLED=true → 503 pour tout.
// - Chaque fonction est ACTIVABLE par organisation
//   (organization_ai_settings, désactivée par défaut) ; plafonds de
//   requêtes par jour et de jetons par mois PAR ORGANISATION, débit par
//   utilisateur.
// - Chaque appel est journalisé dans ai_usage_events (jetons seulement,
//   aucun contenu).
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";
import { HttpError } from "./auth.ts";

export type FonctionIa = "copilote" | "import" | "document" | "note_conseil";

const COLONNE: Record<FonctionIa, string> = {
  copilote: "copilot_enabled",
  import: "smart_import_enabled",
  document: "document_reading_enabled",
  note_conseil: "council_note_enabled",
};

/** Modèle par défaut (surchargeable par ANTHROPIC_MODEL). */
export const MODELE_PAR_DEFAUT = "claude-opus-5-5";

export function modeleIa(): string {
  return Deno.env.get("ANTHROPIC_MODEL") || MODELE_PAR_DEFAUT;
}

export function iaDesactiveeGlobalement(): boolean {
  return Deno.env.get("AI_FEATURES_DISABLED") === "true";
}

export function clientAnthropic(): Anthropic | null {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  // ANTHROPIC_BASE_URL (facultatif) : réservé aux tests locaux.
  const baseURL = Deno.env.get("ANTHROPIC_BASE_URL") || undefined;
  return new Anthropic({ apiKey, baseURL, maxRetries: 2, timeout: 2 * 60_000 });
}

export interface ReglagesIa {
  actif: boolean;
  monthly_token_limit: number;
  daily_request_limit: number;
}

export interface ResumeUsage {
  jetonsMois: number;
  requetesJour: number;
}

/** Réglages d'une fonction pour une organisation, lus avec le client de
 *  l'UTILISATEUR (RLS : seuls les membres les lisent). null = non membre
 *  ou jamais activée. */
export async function lireReglages(
  userClient: SupabaseClient,
  organizationId: string,
  fonction: FonctionIa,
): Promise<ReglagesIa | null> {
  const { data } = await userClient
    .from("organization_ai_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    actif: row[COLONNE[fonction]] === true,
    monthly_token_limit: Number(row.monthly_token_limit ?? 0),
    daily_request_limit: Number(row.daily_request_limit ?? 0),
  };
}

export async function resumeUsage(service: SupabaseClient, organizationId: string): Promise<ResumeUsage> {
  const { data, error } = await service.rpc("ai_usage_summary", { _org: organizationId });
  if (error) throw new HttpError(500, "usage_indisponible");
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
  return {
    jetonsMois: Number(r?.month_input_tokens ?? 0) + Number(r?.month_output_tokens ?? 0),
    requetesJour: Number(r?.today_requests ?? 0),
  };
}

/** Débit par utilisateur (fenêtre glissante, table rate_limit_events). */
export async function debitUtilisateurOk(
  service: SupabaseClient,
  bucket: string,
  userId: string,
  limite = 40,
  minutes = 10,
): Promise<boolean> {
  const depuis = new Date(Date.now() - minutes * 60_000).toISOString();
  const { count, error } = await service
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("caller", userId)
    .gte("created_at", depuis);
  if (error) return true;
  if ((count ?? 0) >= limite) return false;
  await service.from("rate_limit_events").insert({ bucket, caller: userId });
  return true;
}

/** Contrôle d'accès commun à toutes les fonctions IA (lève HttpError). */
export function verifierQuotas(reglages: ReglagesIa | null, usage: ResumeUsage): void {
  if (!reglages || !reglages.actif) throw new HttpError(403, "fonction_desactivee");
  if (usage.requetesJour >= reglages.daily_request_limit) throw new HttpError(429, "quota_journalier");
  if (usage.jetonsMois >= reglages.monthly_token_limit) throw new HttpError(429, "quota_mensuel");
}

export interface UsageAppel {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export async function journaliserUsage(
  service: SupabaseClient,
  e: { organizationId: string; userId: string; fonction: FonctionIa; modele: string; usage: UsageAppel },
): Promise<void> {
  const { error } = await service.from("ai_usage_events").insert({
    organization_id: e.organizationId,
    user_id: e.userId,
    feature: e.fonction,
    model: e.modele,
    input_tokens: e.usage.input_tokens ?? 0,
    output_tokens: e.usage.output_tokens ?? 0,
    cache_read_tokens: e.usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: e.usage.cache_creation_input_tokens ?? 0,
  });
  if (error) console.error("ai_usage_events:", error.message);
}

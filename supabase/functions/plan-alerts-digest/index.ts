// plan-alerts-digest — tâche planifiée (pg_cron uniquement), Phase 5.6.
//
// Envoie à chaque membre concerné le résumé des NOUVELLES alertes de
// surveillance de ses projets (actives, non vues, pas encore envoyées),
// puis marque ces alertes envoyées. Les alertes sont calculées par le
// moteur dans l'application et enregistrées dans plan_alerts.
//
// Sécurité :
// - Exige x-cron-secret (CRON_SECRET).
// - SMTP non branché (SMTP_PASSWORD absent) → 503 « service_non_configure », rien n'est
//   marqué (les alertes partiront au premier passage après branchement).
// - Envois par send-email (gabarit fermé, secret interne, HTML échappé).
// - Aucune adresse ni donnée personnelle dans les journaux.

import { smtpActif } from "../_shared/smtpConfig.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { HttpError, requireCronSecret, serviceRoleClient } from "../_shared/auth.ts";
import { construireEnvois, type AlerteDigest, type MembreDigest, type ProjetDigest } from "./core.ts";

async function courrielsUtilisateurs(supabase: ReturnType<typeof serviceRoleClient>, ids: Set<string>) {
  const map = new Map<string, string>();
  const perPage = 200;
  for (let page = 1; page <= 100 && map.size < ids.size; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) if (u.email && ids.has(u.id)) map.set(u.id, u.email);
    if (data.users.length < perPage) break;
  }
  return map;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);
  try {
    requireCronSecret(req);
    if (!smtpActif()) {
      return jsonResponse(req, { error: "service_non_configure", service: "smtp" }, 503);
    }
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    if (!internalSecret) throw new HttpError(500, "INTERNAL_FUNCTION_SECRET is not configured");

    const supabase = serviceRoleClient();
    const { data: alertes, error } = await supabase
      .from("plan_alerts")
      .select("id, project_id, severity, title_fr, title_en, message_fr, message_en")
      .is("resolved_at", null)
      .is("dismissed_at", null)
      .is("emailed_at", null)
      .in("severity", ["critique", "attention"])
      .order("first_seen_at", { ascending: true })
      .limit(500);
    if (error) throw error;
    if (!alertes || alertes.length === 0) return jsonResponse(req, { envoyes: 0, alertes: 0 });

    const projectIds = [...new Set(alertes.map((a) => a.project_id))];
    const { data: projets, error: e1 } = await supabase
      .from("projects")
      .select("id, name, user_id, organization_id")
      .in("id", projectIds);
    if (e1) throw e1;
    const orgIds = [...new Set((projets ?? []).map((p) => p.organization_id).filter((x): x is string => !!x))];
    const { data: membres, error: e2 } = orgIds.length
      ? await supabase.from("organization_members").select("organization_id, user_id, role").in("organization_id", orgIds)
      : { data: [], error: null };
    if (e2) throw e2;
    const userIds = new Set<string>([...(projets ?? []).map((p) => p.user_id), ...(membres ?? []).map((m) => m.user_id)]);
    const { data: profils, error: e3 } = await supabase
      .from("profiles")
      .select("id, email_notifications")
      .in("id", [...userIds]);
    if (e3) throw e3;
    const preferences = new Map((profils ?? []).map((p) => [p.id, p.email_notifications as Record<string, unknown> | null]));
    const courriels = await courrielsUtilisateurs(supabase, userIds);

    const envois = construireEnvois(
      alertes as AlerteDigest[],
      (projets ?? []) as ProjetDigest[],
      (membres ?? []) as MembreDigest[],
      preferences,
      courriels,
    );

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
    let envoyes = 0;
    let echecs = 0;
    const traitees = new Set<string>();
    for (const e of envois) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-secret": internalSecret },
        body: JSON.stringify({
          templateType: "plan_alerts_digest",
          data: { to: e.to, projectId: e.projectId, projectName: e.projectName, lang: e.lang, alerts: e.alerts },
        }),
      });
      if (r.ok) {
        envoyes++;
        e.alertIds.forEach((id) => traitees.add(id));
      } else {
        echecs++;
      }
      await r.body?.cancel();
    }
    // Marquées envoyées : les alertes réellement envoyées, et celles d'un
    // projet sans aucun destinataire (préférence désactivée partout), pour
    // ne pas les envoyer des semaines plus tard. Un envoi échoué ou une
    // alerte au-delà du plafond par courriel repart au prochain passage.
    const projetsAvecEnvoi = new Set(envois.map((e) => e.projectId));
    const aMarquer = alertes.filter((a) => traitees.has(a.id) || !projetsAvecEnvoi.has(a.project_id)).map((a) => a.id);
    if (aMarquer.length > 0) {
      const { error: e4 } = await supabase.from("plan_alerts").update({ emailed_at: new Date().toISOString() }).in("id", aMarquer);
      if (e4) throw e4;
    }
    console.log(`plan-alerts-digest : ${envoyes} courriel(s), ${echecs} échec(s), ${aMarquer.length} alerte(s) marquée(s)`);
    return jsonResponse(req, { envoyes, echecs, alertes: aMarquer.length });
  } catch (error) {
    if (error instanceof HttpError) return jsonResponse(req, { error: error.message }, error.status);
    console.error("Error in plan-alerts-digest:", error instanceof Error ? error.message : "unknown");
    return jsonResponse(req, { error: "Internal error" }, 500);
  }
});

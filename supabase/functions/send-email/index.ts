// send-email — relais SendGrid fermé.
//
// Sécurité :
// - Aucun destinataire ni HTML libre dans la requête : chaque gabarit (liste
//   fermée) définit son destinataire côté serveur et échappe toutes les
//   données interpolées.
// - Gabarits publics (demo_request, contact) : limite de débit par IP,
//   champ pot de miel, enregistrement du lead dans email_leads.
// - Gabarits authentifiés (support_request, collaboration_invite,
//   task_mention) : JWT vérifié via getUserOrThrow, destinataire résolu en
//   base (jamais fourni par le client).
// - Gabarits internes (subsidy_reminder, plan_alerts_digest) : secret
//   partagé x-internal-secret.

import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getUserOrThrow,
  HttpError,
  requireInternalSecret,
  serviceRoleClient,
} from "../_shared/auth.ts";
import {
  clientIp,
  escapeHtml,
  parseJsonBody,
  safeHttpsUrl,
  ValidationError,
  z,
} from "../_shared/validation.ts";

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
const FROM_EMAIL = "contact@h2fleet.ca";
const FROM_NAME = "H2Fleet Planner";
// Destinataire interne des formulaires publics ; jamais fourni par le client.
const INTERNAL_INBOX = Deno.env.get("CONTACT_INBOX_EMAIL") ?? "contact@h2fleet.ca";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://h2fleet.app";

// ── Limite de débit par IP pour les gabarits publics ───────────────────────
const PUBLIC_RATE_LIMIT = 5; // envois
const PUBLIC_RATE_WINDOW_MINUTES = 60;

async function checkPublicRateLimit(bucket: string, ip: string): Promise<boolean> {
  const supabase = serviceRoleClient();
  const windowStart = new Date(
    Date.now() - PUBLIC_RATE_WINDOW_MINUTES * 60_000,
  ).toISOString();
  const { count, error } = await supabase
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("caller", ip)
    .gte("created_at", windowStart);
  if (error) {
    console.error("rate limit check failed:", error.message);
    return true; // ne pas bloquer les utilisateurs légitimes sur une panne interne
  }
  if ((count ?? 0) >= PUBLIC_RATE_LIMIT) return false;
  await supabase.from("rate_limit_events").insert({ bucket, caller: ip });
  return true;
}

// ── Schémas des gabarits (liste fermée) ─────────────────────────────────────
const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

const demoRequestSchema = z.object({
  templateType: z.literal("demo_request"),
  data: z.object({
    fullName: nonEmpty(120),
    email: z.string().trim().email().max(254),
    company: nonEmpty(160),
    fleetSize: nonEmpty(60),
    message: z.string().trim().max(2000).optional(),
    // Pot de miel : rempli par les robots, toujours vide pour un humain.
    website: z.string().max(200).optional(),
  }),
});

const contactSchema = z.object({
  templateType: z.literal("contact"),
  data: z.object({
    name: nonEmpty(120),
    email: z.string().trim().email().max(254),
    company: z.string().trim().max(160).optional(),
    fleetSize: z.string().trim().max(60).optional(),
    subject: nonEmpty(120),
    message: nonEmpty(4000),
    website: z.string().max(200).optional(), // pot de miel
  }),
});

const supportRequestSchema = z.object({
  templateType: z.literal("support_request"),
  data: z.object({
    category: nonEmpty(80),
    priority: z.string().trim().max(40).optional(),
    phone: z.string().trim().max(40).optional(),
    subject: nonEmpty(160),
    message: nonEmpty(4000),
    isPriority: z.boolean().optional(),
  }),
});

const collaborationInviteSchema = z.object({
  templateType: z.literal("collaboration_invite"),
  data: z.object({ invitationId: z.string().uuid() }),
});

const taskMentionSchema = z.object({
  templateType: z.literal("task_mention"),
  data: z.object({
    taskId: z.string().uuid(),
    mentionedUserId: z.string().uuid(),
    commentPreview: nonEmpty(300),
  }),
});

const subsidyReminderSchema = z.object({
  templateType: z.literal("subsidy_reminder"),
  data: z.object({
    to: z.string().trim().email().max(254),
    programName: nonEmpty(300),
    amount: nonEmpty(60),
    daysRemaining: z.number().int().min(0).max(365),
    deadline: nonEmpty(120),
    applyUrl: z.string().max(2048),
    isUrgent: z.boolean(),
    lang: z.enum(["fr", "en"]),
  }),
});

// Phase 5.6 — résumé des alertes de surveillance d'un projet (fonction
// plan-alerts-digest) ; le lien est construit ici à partir de l'UUID.
const planAlertsDigestSchema = z.object({
  templateType: z.literal("plan_alerts_digest"),
  data: z.object({
    to: z.string().trim().email().max(254),
    projectId: z.string().uuid(),
    projectName: nonEmpty(200),
    lang: z.enum(["fr", "en"]),
    alerts: z
      .array(
        z.object({
          severity: z.enum(["critique", "attention", "info"]),
          title: nonEmpty(300),
          message: z.string().trim().max(1500),
        }),
      )
      .min(1)
      .max(20),
  }),
});

const requestSchema = z.discriminatedUnion("templateType", [
  demoRequestSchema,
  contactSchema,
  supportRequestSchema,
  collaborationInviteSchema,
  taskMentionSchema,
  subsidyReminderSchema,
  planAlertsDigestSchema,
]);

// ── Gabarits HTML (toutes les valeurs passent par escapeHtml) ───────────────
function layout(header: string, body: string, footer: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f4f4f5;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;">
<div style="background:linear-gradient(135deg,#0ea5e9 0%,#22c55e 100%);padding:28px;text-align:center;">
<h1 style="color:white;margin:0;font-size:22px;">H2Fleet Planner</h1>
<p style="color:rgba(255,255,255,0.9);margin:8px 0 0 0;">${header}</p>
</div>
<div style="padding:28px;">${body}</div>
<div style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#9ca3af;font-size:12px;">${footer}</p>
</div></div></body></html>`;
}

function tableRows(rows: Array<[string, string | undefined]>): string {
  return rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#6b7280;"><strong>${escapeHtml(k)}:</strong></td>` +
        `<td style="padding:8px 0;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
}

function leadEmailHtml(
  title: string,
  rows: Array<[string, string | undefined]>,
  message?: string,
): string {
  const messageBlock = message
    ? `<div style="margin-top:20px;padding:16px;background:#f3f4f6;border-radius:8px;">
<h3 style="margin:0 0 12px 0;">Message:</h3>
<p style="margin:0;white-space:pre-wrap;">${escapeHtml(message)}</p></div>`
    : "";
  return layout(
    escapeHtml(title),
    `<table style="width:100%;border-collapse:collapse;">${tableRows(rows)}</table>${messageBlock}`,
    "Formulaire du site h2fleet.app",
  );
}

// ── Envoi SendGrid ──────────────────────────────────────────────────────────
/**
 * Formulaires publics : la demande est déjà enregistrée (email_leads) ;
 * sans SendGrid on renvoie un succès avec emailSent=false au lieu d'une
 * erreur — l'interface l'indique honnêtement.
 */
async function sendEmailSiConfigure(...args: Parameters<typeof sendEmail>): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false;
  await sendEmail(...args);
  return true;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  // Service non branché (ex. site de test sans SendGrid) : réponse 503
  // explicite que l'interface traduit en message clair (jamais une 500).
  if (!SENDGRID_API_KEY) throw new HttpError(503, "service_non_configure");
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });
  if (!response.ok) {
    console.error("SendGrid API error:", response.status);
    throw new HttpError(502, "Email provider error");
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const body = await parseJsonBody(req, requestSchema);

    switch (body.templateType) {
      case "demo_request": {
        const d = body.data;
        if (d.website) return jsonResponse(req, { success: true }); // pot de miel
        if (!(await checkPublicRateLimit("send-email:public", clientIp(req)))) {
          return jsonResponse(req, { error: "Too many requests" }, 429);
        }
        // Enregistrer le lead même si l'envoi échoue ensuite.
        await serviceRoleClient().from("email_leads").insert({
          email: d.email,
          source: "demo_request",
          calculator_inputs: {
            fullName: d.fullName,
            company: d.company,
            fleetSize: d.fleetSize,
            message: d.message ?? null,
          },
        });
        const emailSent = await sendEmailSiConfigure(
          INTERNAL_INBOX,
          `[Demo Request] ${d.company} - ${d.fullName}`,
          leadEmailHtml(
            "New Demo Request",
            [
              ["Name", d.fullName],
              ["Email", d.email],
              ["Company", d.company],
              ["Fleet Size", d.fleetSize],
            ],
            d.message,
          ),
          `New Demo Request\n\nName: ${d.fullName}\nEmail: ${d.email}\nCompany: ${d.company}\nFleet Size: ${d.fleetSize}\n${d.message ? `\nNotes: ${d.message}` : ""}`,
        );
        return jsonResponse(req, { success: true, emailSent });
      }

      case "contact": {
        const d = body.data;
        if (d.website) return jsonResponse(req, { success: true }); // pot de miel
        if (!(await checkPublicRateLimit("send-email:public", clientIp(req)))) {
          return jsonResponse(req, { error: "Too many requests" }, 429);
        }
        await serviceRoleClient().from("email_leads").insert({
          email: d.email,
          source: "contact",
          calculator_inputs: {
            name: d.name,
            company: d.company ?? null,
            fleetSize: d.fleetSize ?? null,
            subject: d.subject,
            // Le texte du message est conservé : il reste lisible même si
            // l'envoi par courriel n'est pas (encore) configuré.
            message: d.message,
          },
        });
        const emailSent = await sendEmailSiConfigure(
          INTERNAL_INBOX,
          `[Contact] ${d.subject}`,
          leadEmailHtml(
            "New Contact Form Submission",
            [
              ["Name", d.name],
              ["Email", d.email],
              ["Company", d.company],
              ["Fleet Size", d.fleetSize],
              ["Subject", d.subject],
            ],
            d.message,
          ),
          `New contact from ${d.name} (${d.email})\n\nSubject: ${d.subject}\n\nMessage:\n${d.message}`,
        );
        return jsonResponse(req, { success: true, emailSent });
      }

      case "support_request": {
        const { user } = await getUserOrThrow(req);
        const d = body.data;
        const { data: profile } = await serviceRoleClient()
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        await sendEmail(
          INTERNAL_INBOX,
          `[Support${d.isPriority ? " - PRIORITY" : ""}] ${d.category}: ${d.subject}`,
          leadEmailHtml(
            "H2Fleet Support Request",
            [
              ["From", profile?.full_name ?? "N/A"],
              ["Email", user.email ?? "N/A"],
              ["Category", d.category],
              ["Priority", d.priority],
              ["Callback Phone", d.phone],
            ],
            d.message,
          ),
          `Support request from ${user.email}\nCategory: ${d.category}\n\n${d.message}`,
        );
        return jsonResponse(req, { success: true });
      }

      case "collaboration_invite": {
        const { user } = await getUserOrThrow(req);
        const admin = serviceRoleClient();
        // Le destinataire vient de l'invitation en base, créée par l'appelant.
        const { data: invitation } = await admin
          .from("pending_invitations")
          .select("id, email, role, project_id, invited_by, projects(name)")
          .eq("id", body.data.invitationId)
          .eq("invited_by", user.id)
          .maybeSingle();
        if (!invitation) throw new HttpError(404, "Invitation not found");

        const { data: inviterProfile } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        const projectName =
          (invitation.projects as { name?: string } | null)?.name ??
          "Projet H2Fleet";
        const inviterName = inviterProfile?.full_name ?? "Un utilisateur";
        const roleLabels: Record<string, string> = {
          owner: "Propriétaire",
          editor: "Éditeur",
          viewer: "Lecteur",
        };
        const roleLabel = roleLabels[invitation.role] ?? invitation.role;
        const projectUrl = `${APP_BASE_URL}/signup?invite=${invitation.project_id}`;

        await sendEmail(
          invitation.email,
          `Invitation à collaborer - ${projectName}`,
          layout(
            "Invitation à collaborer",
            `<p style="text-align:center;color:#6b7280;"><strong>${escapeHtml(inviterName)}</strong> vous a invité(e) à collaborer sur</p>
<div style="background:#f3f4f6;border-radius:8px;padding:20px;margin-bottom:24px;text-align:center;">
<p style="margin:0;font-size:20px;font-weight:600;">${escapeHtml(projectName)}</p>
<p style="margin:8px 0 0 0;color:#6b7280;font-size:14px;">Rôle : ${escapeHtml(roleLabel)}</p>
</div>
<p style="text-align:center;"><a href="${escapeHtml(projectUrl)}" style="display:inline-block;background:#8b5cf6;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Voir le projet</a></p>`,
            "Vous avez reçu cet email car un utilisateur H2Fleet vous a invité(e) sur un projet.",
          ),
          `${inviterName} vous a invité(e) à collaborer sur ${projectName} (rôle : ${roleLabel}).\n${projectUrl}`,
        );
        return jsonResponse(req, { success: true });
      }

      case "task_mention": {
        const { user, supabase: userClient } = await getUserOrThrow(req);
        const d = body.data;
        // L'appelant doit voir la tâche (RLS) — sinon 404.
        const { data: task } = await userClient
          .from("tasks")
          .select("id, title, project_id, projects(name)")
          .eq("id", d.taskId)
          .maybeSingle();
        if (!task) throw new HttpError(404, "Task not found");

        const admin = serviceRoleClient();
        // Le mentionné doit être owner ou collaborateur du projet.
        const [{ data: project }, { data: collaborator }] = await Promise.all([
          admin
            .from("projects")
            .select("id, user_id")
            .eq("id", task.project_id)
            .maybeSingle(),
          admin
            .from("project_collaborators")
            .select("user_id")
            .eq("project_id", task.project_id)
            .eq("user_id", d.mentionedUserId)
            .maybeSingle(),
        ]);
        const isMember =
          collaborator !== null || project?.user_id === d.mentionedUserId;
        if (!isMember) throw new HttpError(403, "User is not on this project");

        const { data: mentioned } = await admin
          .from("profiles")
          .select("email, full_name, email_notifications")
          .eq("id", d.mentionedUserId)
          .maybeSingle();
        if (!mentioned?.email) return jsonResponse(req, { success: true });
        const prefs = mentioned.email_notifications as
          | { comment_replies?: boolean }
          | null;
        if (prefs?.comment_replies === false) {
          return jsonResponse(req, { success: true });
        }

        const { data: authorProfile } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        const authorName = authorProfile?.full_name ?? "Un utilisateur";
        const projectName =
          (task.projects as { name?: string } | null)?.name ?? "Projet";
        const taskUrl = `${APP_BASE_URL}/dashboard/tasks?project=${task.project_id}`;

        await sendEmail(
          mentioned.email,
          `@${authorName} vous a mentionné sur "${task.title}"`,
          layout(
            "Vous avez été mentionné",
            `<p style="color:#6b7280;text-align:center;">sur la tâche <strong>"${escapeHtml(task.title)}"</strong> dans le projet <strong>${escapeHtml(projectName)}</strong></p>
<div style="background:#f3f4f6;border-left:4px solid #f59e0b;padding:16px;margin-bottom:24px;border-radius:0 8px 8px 0;">
<p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;font-weight:600;">${escapeHtml(authorName)} a écrit :</p>
<p style="margin:0;font-style:italic;">"${escapeHtml(d.commentPreview)}"</p></div>
<p style="text-align:center;"><a href="${escapeHtml(taskUrl)}" style="display:inline-block;background:#f59e0b;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Voir la tâche</a></p>`,
            "Gérez vos préférences de notification dans les réglages.",
          ),
          `${authorName} vous a mentionné sur "${task.title}" (${projectName}) :\n"${d.commentPreview}"\n${taskUrl}`,
        );
        return jsonResponse(req, { success: true });
      }

      case "subsidy_reminder": {
        requireInternalSecret(req);
        const d = body.data;
        const applyUrl = safeHttpsUrl(d.applyUrl) ?? APP_BASE_URL;
        const isEnglish = d.lang === "en";
        const html = layout(
          isEnglish ? "Subsidy Deadline Reminder" : "Rappel d'échéance de subvention",
          `${d.isUrgent ? '<p style="text-align:center;"><span style="background:#ef4444;color:white;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:bold;">URGENT</span></p>' : ""}
<h2 style="margin:0 0 16px 0;">${escapeHtml(d.programName)}</h2>
<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;margin-bottom:24px;border-radius:0 8px 8px 0;">
<p style="margin:0;color:#166534;font-size:24px;font-weight:bold;">${escapeHtml(d.amount)}</p>
<p style="margin:4px 0 0 0;color:#15803d;font-size:14px;">${isEnglish ? "Available funding" : "Financement disponible"}</p></div>
<div style="background:${d.isUrgent ? "#fef2f2" : "#fffbeb"};border-radius:8px;padding:16px;margin-bottom:24px;">
<p style="margin:0;font-weight:600;">⏰ ${d.daysRemaining} ${isEnglish ? "days remaining" : "jours restants"}</p>
<p style="margin:8px 0 0 0;font-size:14px;">${isEnglish ? "Deadline" : "Date limite"} : ${escapeHtml(d.deadline)}</p></div>
<p style="text-align:center;"><a href="${escapeHtml(applyUrl)}" style="display:inline-block;background:#0ea5e9;color:white;padding:16px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${isEnglish ? "Apply Now" : "Faire une demande"}</a></p>`,
          isEnglish
            ? "You received this email because you enabled subsidy reminders."
            : "Vous avez reçu cet email car vous avez activé les rappels de subventions.",
        );
        await sendEmail(
          d.to,
          d.isUrgent
            ? `🚨 URGENT: ${isEnglish ? "Last day for" : "Dernier jour pour"} ${d.programName}`
            : `⏰ ${isEnglish ? "Reminder" : "Rappel"}: 7 ${isEnglish ? "days left for" : "jours pour"} ${d.programName}`,
          html,
          `${d.programName} — ${d.amount} — ${d.daysRemaining} ${isEnglish ? "days remaining" : "jours restants"} (${d.deadline})\n${applyUrl}`,
        );
        return jsonResponse(req, { success: true });
      }

      case "plan_alerts_digest": {
        requireInternalSecret(req);
        const d = body.data;
        const en = d.lang === "en";
        const projectUrl = `${APP_BASE_URL}/dashboard/projects/${d.projectId}/suivi`;
        const couleurs: Record<string, string> = { critique: "#b91c1c", attention: "#b45309", info: "#475569" };
        const libelles: Record<string, string> = en
          ? { critique: "Critical", attention: "Warning", info: "Information" }
          : { critique: "Critique", attention: "Attention", info: "Information" };
        const items = d.alerts
          .map(
            (a) => `<div style="border-left:4px solid ${couleurs[a.severity]};padding:10px 14px;margin-bottom:12px;background:#f9fafb;">
<p style="margin:0;font-size:12px;color:${couleurs[a.severity]};font-weight:600;text-transform:uppercase;">${libelles[a.severity]}</p>
<p style="margin:4px 0 0 0;font-weight:600;">${escapeHtml(a.title)}</p>
<p style="margin:6px 0 0 0;font-size:14px;color:#374151;">${escapeHtml(a.message)}</p></div>`,
          )
          .join("");
        const html = layout(
          en ? "Plan monitoring" : "Surveillance du plan",
          `<h2 style="margin:0 0 16px 0;">${escapeHtml(d.projectName)}</h2>${items}
<p style="text-align:center;margin-top:24px;"><a href="${escapeHtml(projectUrl)}" style="display:inline-block;background:#0f766e;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">${en ? "Open project tracking" : "Ouvrir le suivi du projet"}</a></p>`,
          en
            ? "Alerts computed by the H2Fleet engine. You received this email because plan monitoring alerts are enabled in your settings."
            : "Alertes calculées par le moteur H2Fleet. Vous recevez ce courriel car les alertes de surveillance du plan sont activées dans vos paramètres.",
        );
        await sendEmail(
          d.to,
          `${en ? "Plan monitoring" : "Surveillance du plan"} — ${d.projectName} (${d.alerts.length})`,
          html,
          `${d.projectName}\n\n${d.alerts.map((a) => `[${libelles[a.severity]}] ${a.title}\n${a.message}`).join("\n\n")}\n\n${projectUrl}`,
        );
        return jsonResponse(req, { success: true });
      }
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse(req, { error: error.message }, 400);
    }
    if (error instanceof HttpError) {
      return jsonResponse(req, { error: error.message }, error.status);
    }
    console.error("Error in send-email:", error);
    return jsonResponse(req, { error: "Internal error" }, 500);
  }

  return jsonResponse(req, { error: "Unknown template" }, 400);
});

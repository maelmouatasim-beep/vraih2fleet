// notify-subsidy-deadlines — tâche planifiée (pg_cron uniquement).
//
// Sécurité :
// - Exige le header x-cron-secret (CRON_SECRET) : personne d'autre que le
//   planificateur ne peut déclencher un envoi massif.
// - listUsers() paginé (l'API plafonne à 50 par page par défaut).
// - Aucune adresse email ni donnée personnelle dans les logs.
// - Les envois passent par send-email avec le secret interne.

import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  HttpError,
  requireCronSecret,
  serviceRoleClient,
} from "../_shared/auth.ts";

interface IncentiveProgram {
  id: string;
  program_name_en: string;
  program_name_fr: string;
  amount_cad: number;
  deadline: string;
  application_url: string;
}

interface Profile {
  id: string;
  email_notifications: { subsidy_reminders?: boolean } | null;
}

async function listAllUserEmails(
  supabase: ReturnType<typeof serviceRoleClient>,
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const perPage = 200;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) emails.set(user.id, user.email);
    }
    if (data.users.length < perPage) break;
  }
  return emails;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    requireCronSecret(req);

    console.log("Starting subsidy deadline notification check...");
    const supabase = serviceRoleClient();

    const now = new Date();
    const { data: programs, error: programsError } = await supabase
      .from("incentives_programs")
      .select("id, program_name_en, program_name_fr, amount_cad, deadline, application_url")
      .eq("status", "active")
      .not("deadline", "is", null);
    if (programsError) throw programsError;

    const programsToNotify: {
      program: IncentiveProgram;
      daysRemaining: number;
      isUrgent: boolean;
    }[] = [];
    (programs ?? []).forEach((program: IncentiveProgram) => {
      const deadline = new Date(program.deadline);
      const daysRemaining = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysRemaining === 7 || daysRemaining === 1) {
        programsToNotify.push({ program, daysRemaining, isUrgent: daysRemaining === 1 });
      }
    });
    console.log(`${programsToNotify.length} program(s) need notifications`);

    if (programsToNotify.length === 0) {
      return jsonResponse(req, {
        message: "No deadlines to notify about today",
        notificationsSent: 0,
      });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email_notifications")
      .not("email_notifications", "is", null);
    if (profilesError) throw profilesError;

    const usersToNotify = (profiles ?? []).filter(
      (p: Profile) => p.email_notifications?.subsidy_reminders === true,
    );
    console.log(`${usersToNotify.length} user(s) have subsidy reminders enabled`);

    const userEmailMap = await listAllUserEmails(supabase);

    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    if (!internalSecret) {
      throw new HttpError(500, "INTERNAL_FUNCTION_SECRET is not configured");
    }
    const sendEmailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;

    let notificationsSent = 0;
    let failures = 0;

    for (const user of usersToNotify) {
      const userEmail = userEmailMap.get(user.id);
      if (!userEmail) continue;

      for (const { program, daysRemaining, isUrgent } of programsToNotify) {
        try {
          const lang = "fr";
          const locale = "fr-CA";
          const deadline = new Date(program.deadline);
          const formattedDeadline = deadline.toLocaleDateString(locale, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const amount = new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "CAD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(program.amount_cad);
          const programName = program.program_name_fr;

          const response = await fetch(sendEmailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-internal-secret": internalSecret,
            },
            body: JSON.stringify({
              templateType: "subsidy_reminder",
              data: {
                to: userEmail,
                programName,
                amount,
                daysRemaining,
                deadline: formattedDeadline,
                applyUrl: program.application_url,
                isUrgent,
                lang,
              },
            }),
          });
          if (!response.ok) throw new Error(`send-email HTTP ${response.status}`);
          notificationsSent++;
          // Pas d'email ni d'identité en logs : identifiants techniques seulement.
          console.log(
            `Sent ${isUrgent ? "urgent " : ""}reminder for program ${program.id}`,
          );
        } catch (error) {
          failures++;
          console.error(
            `Failed to send reminder for program ${program.id}:`,
            error instanceof Error ? error.message : "unknown",
          );
        }
      }
    }

    console.log(`Notification job completed. Sent ${notificationsSent}, failed ${failures}.`);
    return jsonResponse(req, {
      message: "Notification job completed",
      notificationsSent,
      programsChecked: programsToNotify.length,
      usersChecked: usersToNotify.length,
      failures,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(req, { error: error.message }, error.status);
    }
    console.error("Error in notify-subsidy-deadlines:", error);
    return jsonResponse(req, { error: "Internal error" }, 500);
  }
});

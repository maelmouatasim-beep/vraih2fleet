"use server";

import { sql } from "drizzle-orm";
import { withActor } from "@leaseplace/db";
import { LEAD_CONSENT_VERSION } from "@leaseplace/domain";
import { appDb } from "@/lib/db";
import { echoValues, leadFormSchema, pgErrorCode, type LeadState } from "@/lib/leads";
import { logger } from "@/lib/logger";
import { requestContext } from "@/lib/request";

/** Dépôt d'une demande de contact ; la base valide et limite le débit. */
export async function submitLead(_prev: LeadState, formData: FormData): Promise<LeadState> {
  const raw = Object.fromEntries(formData);
  // Robot (champ piège rempli) : réponse identique, rien n'est enregistré.
  if (typeof raw.website === "string" && raw.website !== "") return { status: "success" };
  const parsed = leadFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      error: "invalid",
      fields: parsed.error.issues.map((i) => String(i.path[0])),
      values: echoValues(raw),
    };
  }
  const d = parsed.data;
  const ctx = await requestContext();
  try {
    await withActor(appDb(), { userId: null, ip: ctx.ip, userAgent: ctx.userAgent }, (tx) =>
      tx.execute(sql`
        select marketing.submit_lead(${d.kind}, ${d.organizationName}, ${d.contactName}, ${d.email},
          ${d.phone}, ${d.message}, ${d.locale}, ${LEAD_CONSENT_VERSION})
      `),
    );
    return { status: "success" };
  } catch (error) {
    const code = pgErrorCode(error);
    if (code === "P0429") return { status: "error", error: "tooMany", values: echoValues(raw) };
    if (code === "23514") return { status: "error", error: "invalid", values: echoValues(raw) };
    logger.error({ err: error }, "marketing.submit_lead a échoué");
    return { status: "error", error: "generic", values: echoValues(raw) };
  }
}

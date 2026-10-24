"use server";

import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { recordAudit, withActor } from "@leaseplace/db";
import {
  BUSINESS_SECTORS,
  HEADCOUNT_BANDS,
  LEGAL_FORMS,
  normalizeIce,
  REVENUE_BANDS,
} from "@leaseplace/domain";
import { getAuth } from "@/lib/auth";
import { pgCode, randomSlugSuffix } from "@/lib/company-actions";
import { appDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requestContext } from "@/lib/request";
import { getViewer } from "@/lib/viewer";
import { z } from "@/lib/zod";

export type OnboardingState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      error: "invalid" | "ice" | "ice_taken" | "already" | "generic";
      fields?: string[];
      values?: Record<string, string>;
    };

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(200),
  ice: z.string().trim(),
  legalForm: z.enum(LEGAL_FORMS),
  sector: z.enum(BUSINESS_SECTORS),
  city: z.string().trim().min(2).max(100),
  incorporationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  revenueBand: z
    .enum(REVENUE_BANDS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  headcountBand: z
    .enum(HEADCOUNT_BANDS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "entreprise"}-${randomSlugSuffix()}`;
}

/** Onboarding : crée l'entreprise et rattache l'utilisateur comme dirigeant. */
export async function createCompanyAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const raw = Object.fromEntries(
    [...formData].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
  const values = raw;
  const viewer = await getViewer();
  if (!viewer) return { status: "error", error: "generic" };
  if (viewer.membership) return { status: "error", error: "already" };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      error: "invalid",
      fields: parsed.error.issues.map((i) => String(i.path[0])),
      values,
    };
  }
  const d = parsed.data;
  const ice = normalizeIce(d.ice);
  if (!ice) return { status: "error", error: "ice", fields: ["ice"], values };
  const ctx = await requestContext();
  try {
    await getAuth().api.updateUser({ body: { name: d.fullName }, headers: await headers() });
    await withActor(
      appDb(),
      { userId: viewer.user.id, ip: ctx.ip, userAgent: ctx.userAgent },
      async (tx) => {
        const [row] = await tx.execute<{ id: string }>(sql`
        select kyc.create_company(${d.legalName}, ${slugify(d.legalName)}, ${ice}, ${d.legalForm}, ${d.sector},
          ${d.city}, ${d.incorporationDate ?? null}::date, ${d.revenueBand ?? null}, ${d.headcountBand ?? null}) as id
      `);
        await recordAudit(tx, {
          action: "company.created",
          entityType: "organization",
          entityId: row?.id ?? null,
          metadata: { legalForm: d.legalForm, sector: d.sector },
        });
      },
    );
    return { status: "success" };
  } catch (error) {
    const code = pgCode(error);
    if (code === "23505") {
      const detail = (error as { cause?: { detail?: string } }).cause?.detail ?? "";
      return detail.includes("ice")
        ? { status: "error", error: "ice_taken", fields: ["ice"], values }
        : { status: "error", error: "already" };
    }
    logger.error({ err: error }, "création d'entreprise");
    return { status: "error", error: "generic", values };
  }
}

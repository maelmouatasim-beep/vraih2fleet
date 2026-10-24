"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAudit, schema, withActor } from "@leaseplace/db";
import { BUSINESS_SECTORS, can, HEADCOUNT_BANDS, REVENUE_BANDS } from "@leaseplace/domain";
import {
  cancelRequest,
  companyViewer,
  createRequest,
  deleteDocument,
  detachDocument,
  saveDraft,
  submitRequest,
  uploadDocument,
  type DraftPatch,
  type SaveResult,
  type SubmitResult,
  type UploadResult,
} from "@/lib/company-actions";
import { getCompany } from "@/lib/company-data";
import { appDb } from "@/lib/db";
import { actorFor } from "@/lib/viewer";
import { z } from "@/lib/zod";

export async function uploadDocumentAction(
  _prev: UploadResult | null,
  formData: FormData,
): Promise<UploadResult> {
  const result = await uploadDocument(formData);
  revalidatePath("/[locale]/entreprise", "layout");
  return result;
}

export async function deleteDocumentAction(documentId: string) {
  const result = await deleteDocument(documentId);
  revalidatePath("/[locale]/entreprise", "layout");
  return result;
}

export async function createRequestAction(): Promise<string> {
  return createRequest();
}

export async function saveDraftAction(
  requestId: string,
  version: number,
  patch: DraftPatch,
): Promise<SaveResult> {
  return saveDraft(requestId, version, patch);
}

export async function detachDocumentAction(requestId: string, documentId: string) {
  await detachDocument(requestId, documentId);
  revalidatePath("/[locale]/entreprise", "layout");
}

export async function submitRequestAction(
  requestId: string,
  consent: boolean,
  locale: string,
): Promise<SubmitResult> {
  const result = await submitRequest(requestId, consent, locale);
  revalidatePath("/[locale]/entreprise", "layout");
  return result;
}

export async function cancelRequestAction(requestId: string): Promise<boolean> {
  const ok = await cancelRequest(requestId);
  revalidatePath("/[locale]/entreprise", "layout");
  return ok;
}

export type ProfileState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; fields?: string[] };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const profileSchema = z.object({
  tradeName: optionalText(200),
  rcNumber: optionalText(30),
  rcCourt: optionalText(100),
  taxId: optionalText(30),
  cnssNumber: optionalText(30),
  address: optionalText(300),
  city: z.string().trim().min(2).max(100),
  sector: z.enum(BUSINESS_SECTORS),
  incorporationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((v) => new Date(`${v}T00:00:00Z`))
    .or(z.literal("").transform(() => null)),
  revenueBand: z.enum(REVENUE_BANDS).or(z.literal("").transform(() => null)),
  headcountBand: z.enum(HEADCOUNT_BANDS).or(z.literal("").transform(() => null)),
});

/** Profil : modifiable par le dirigeant seulement (la RLS l'impose aussi). */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const viewer = await companyViewer();
  if (!can(viewer.membership.role, "organization.manage_members")) return { status: "error" };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { status: "error", fields: parsed.error.issues.map((i) => String(i.path[0])) };
  await withActor(appDb(), await actorFor(viewer), async (tx) => {
    const before = await getCompany(tx, viewer.membership.organizationId);
    await tx
      .update(schema.companies)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schema.companies.organizationId, viewer.membership.organizationId));
    await recordAudit(tx, {
      action: "company.updated",
      entityType: "organization",
      entityId: viewer.membership.organizationId,
      before: before
        ? {
            city: before.city,
            sector: before.sector,
            rcNumber: before.rcNumber,
            taxId: before.taxId,
          }
        : null,
      after: {
        city: parsed.data.city,
        sector: parsed.data.sector,
        rcNumber: parsed.data.rcNumber,
        taxId: parsed.data.taxId,
      },
    });
  });
  revalidatePath("/[locale]/entreprise", "layout");
  return { status: "saved" };
}

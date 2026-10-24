import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { recordAudit, schema, withActor, type Transaction } from "@leaseplace/db";
import {
  can,
  DOCUMENT_TYPES,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  MAX_DOCUMENT_BYTES,
  PERIODICITIES,
  REQUEST_STATUSES,
  requestMachine,
  sniffMimeType,
  submissionIssues,
  type DocumentType,
  type SubmissionIssue,
} from "@leaseplace/domain";
import { appDb } from "./db";
import {
  currentLegalText,
  draftOf,
  getCompany,
  getRequest,
  kycState,
  listDocuments,
  requestAttachments,
} from "./company-data";
import { logger } from "./logger";
import { documentStorage, malwareScanner } from "./storage";
import { getViewer, actorFor, type SpaceViewer } from "./viewer";
import { z } from "./zod";

const { documents, financingRequests, requestDocuments, consents } = schema;

export class ActionDenied extends Error {
  constructor() {
    super("Action refusée");
    this.name = "ActionDenied";
  }
}

/** Utilisateur connecté, membre d'une entreprise ; sinon refus. */
export async function companyViewer(): Promise<SpaceViewer> {
  const viewer = await getViewer();
  if (viewer?.membership?.organizationType !== "company") throw new ActionDenied();
  return viewer as SpaceViewer;
}

async function inCompany<T>(fn: (tx: Transaction, viewer: SpaceViewer) => Promise<T>): Promise<T> {
  const viewer = await companyViewer();
  return withActor(appDb(), await actorFor(viewer), (tx) => fn(tx, viewer));
}

export function pgCode(error: unknown): string | undefined {
  const e = error as { cause?: { code?: string }; code?: string };
  return e.cause?.code ?? e.code;
}

// ── Coffre-fort ──────────────────────────────────────────────────────────

export type UploadResult =
  | { status: "success"; quarantined: boolean }
  | { status: "error"; error: "type" | "empty" | "too_large" | "format" | "duplicate" | "generic" };

const uploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  issuedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  requestId: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const parsed = uploadSchema.safeParse({
    type: formData.get("type"),
    issuedOn: formData.get("issuedOn") ?? undefined,
    requestId: formData.get("requestId") ?? undefined,
  });
  if (!parsed.success) return { status: "error", error: "type" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", error: "empty" };
  if (file.size > MAX_DOCUMENT_BYTES) return { status: "error", error: "too_large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Type déterminé par la signature binaire, jamais par l'extension ou le navigateur.
  const mimeType = sniffMimeType(bytes);
  if (!mimeType) return { status: "error", error: "format" };
  const verdict = await malwareScanner().scan(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { type, issuedOn, requestId } = parsed.data;

  return inCompany(async (tx, viewer) => {
    const organizationId = viewer.membership.organizationId;
    const id = crypto.randomUUID();
    const storageKey = `${organizationId}/${id}`;
    // Un fichier infecté n'est jamais stocké : seule sa trace est conservée.
    if (verdict.clean) await documentStorage().put(storageKey, bytes);
    try {
      await tx.insert(documents).values({
        id,
        organizationId,
        type,
        status: verdict.clean ? "clean" : "quarantined",
        originalName: file.name.slice(0, 255) || "document",
        mimeType,
        sizeBytes: bytes.length,
        sha256,
        storageKey,
        issuedOn: issuedOn ? new Date(`${issuedOn}T00:00:00Z`) : null,
        scanResult: verdict.clean
          ? `clean:${malwareScanner().name}`
          : `infected:${verdict.signature}`,
        uploadedBy: viewer.user.id,
      });
      if (requestId && verdict.clean)
        await tx.insert(requestDocuments).values({ requestId, documentId: id });
      await recordAudit(tx, {
        action: "document.uploaded",
        entityType: "document",
        entityId: id,
        metadata: {
          type,
          status: verdict.clean ? "clean" : "quarantined",
          sizeBytes: bytes.length,
        },
      });
    } catch (error) {
      if (verdict.clean) await documentStorage().delete(storageKey);
      if (pgCode(error) === "23505") return { status: "error", error: "duplicate" } as const;
      logger.error({ err: error }, "dépôt de document");
      return { status: "error", error: "generic" } as const;
    }
    return { status: "success", quarantined: !verdict.clean } as const;
  });
}

export async function deleteDocument(
  documentId: string,
): Promise<{ ok: boolean; error?: "in_use" }> {
  return inCompany(async (tx) => {
    // Une pièce jointe à une demande soumise fait partie du dossier transmis.
    const [locked] = await tx
      .select({ id: financingRequests.id })
      .from(requestDocuments)
      .innerJoin(financingRequests, eq(financingRequests.id, requestDocuments.requestId))
      .where(
        and(
          eq(requestDocuments.documentId, documentId),
          inArray(financingRequests.status, ["submitted"]),
        ),
      );
    if (locked) return { ok: false, error: "in_use" as const };
    await tx.delete(requestDocuments).where(eq(requestDocuments.documentId, documentId));
    const updated = await tx
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, documentId))
      .returning({ id: documents.id });
    if (updated.length === 0) return { ok: false };
    await recordAudit(tx, {
      action: "document.deleted",
      entityType: "document",
      entityId: documentId,
    });
    return { ok: true };
  });
}

// ── Demandes ─────────────────────────────────────────────────────────────

export async function createRequest(): Promise<string> {
  return inCompany(async (tx, viewer) => {
    const id = crypto.randomUUID();
    await tx.insert(financingRequests).values({
      id,
      reference: sql`credit.next_request_reference()`,
      organizationId: viewer.membership.organizationId,
      createdBy: viewer.user.id,
      condition: "new",
      periodicity: "monthly",
      durationMonths: 60,
      firstRentPct: 10,
      residualPct: 1,
    });
    await recordAudit(tx, {
      action: "request.created",
      entityType: "financing_request",
      entityId: id,
    });
    return id;
  });
}

const draftSchema = z
  .object({
    equipmentCategory: z.enum(EQUIPMENT_CATEGORIES).nullable(),
    equipmentDescription: z.string().max(1000).nullable(),
    condition: z.enum(EQUIPMENT_CONDITIONS).nullable(),
    equipmentYear: z.number().int().min(1950).max(2100).nullable(),
    supplierName: z.string().max(200).nullable(),
    amountHt: z.number().positive().max(1e10).nullable(),
    firstRentPct: z.number().min(0).max(100).nullable(),
    durationMonths: z.number().int().min(1).max(120).nullable(),
    residualPct: z.number().min(0).max(100).nullable(),
    periodicity: z.enum(PERIODICITIES).nullable(),
  })
  .partial();

export type DraftPatch = z.infer<typeof draftSchema>;
export type SaveResult =
  | { status: "saved"; version: number }
  | { status: "conflict" }
  | { status: "invalid" };

/**
 * Sauvegarde automatique avec verrou optimiste : si la demande a été
 * modifiée ailleurs (autre appareil), le client recharge au lieu d'écraser.
 */
export async function saveDraft(
  requestId: string,
  version: number,
  patch: DraftPatch,
): Promise<SaveResult> {
  const parsed = draftSchema.safeParse(patch);
  if (!parsed.success) return { status: "invalid" };
  return inCompany(async (tx) => {
    const rows = await tx
      .update(financingRequests)
      .set(parsed.data)
      .where(
        and(
          eq(financingRequests.id, requestId),
          eq(financingRequests.version, version),
          eq(financingRequests.status, "draft"),
        ),
      )
      .returning({ version: financingRequests.version });
    const row = rows[0];
    return row ? { status: "saved", version: row.version } : { status: "conflict" };
  });
}

export async function detachDocument(requestId: string, documentId: string): Promise<void> {
  await inCompany((tx) =>
    tx
      .delete(requestDocuments)
      .where(
        and(eq(requestDocuments.requestId, requestId), eq(requestDocuments.documentId, documentId)),
      ),
  );
}

export type SubmitResult =
  | { status: "submitted" }
  | { status: "blocked"; issues: SubmissionIssue[] }
  | { status: "forbidden" };

export async function submitRequest(
  requestId: string,
  consentGiven: boolean,
  locale: string,
): Promise<SubmitResult> {
  return inCompany(async (tx, viewer) => {
    if (!can(viewer.membership.role, "consent.grant")) return { status: "forbidden" } as const;
    const request = await getRequest(tx, requestId);
    const company = await getCompany(tx, viewer.membership.organizationId);
    if (!request || !company || request.status !== "draft") {
      return { status: "forbidden" } as const;
    }
    const attachments = await requestAttachments(tx, requestId);
    const docs = await listDocuments(tx, company.organizationId);
    const issues = submissionIssues(draftOf(request), {
      hasQuote: attachments.some(
        ({ document: d }) => d.type === "quote" && d.status === "clean" && !d.deletedAt,
      ),
      kycComplete: kycState(company, docs).completeness.complete,
      consentGiven,
      now: new Date(),
    });
    if (issues.length > 0) return { status: "blocked", issues } as const;

    const text = await currentLegalText(tx, "consent_processing", locale);
    if (!text) throw new Error("Texte de consentement introuvable");
    const consentId = crypto.randomUUID();
    const ctx = await actorFor(viewer);
    await tx.insert(consents).values({
      id: consentId,
      organizationId: company.organizationId,
      requestId,
      purpose: "processing",
      legalTextId: text.id,
      grantedBy: viewer.user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    await tx
      .update(financingRequests)
      .set({ status: "submitted" })
      .where(eq(financingRequests.id, requestId));
    await recordAudit(tx, {
      action: "consent.granted",
      entityType: "consent",
      entityId: consentId,
      metadata: {
        purpose: "processing",
        legalTextVersion: text.version,
        locale: text.locale,
        requestId,
      },
    });
    await recordAudit(tx, {
      action: "request.submitted",
      entityType: "financing_request",
      entityId: requestId,
    });
    return { status: "submitted" } as const;
  });
}

export async function cancelRequest(requestId: string): Promise<boolean> {
  return inCompany(async (tx) => {
    const request = await getRequest(tx, requestId);
    if (
      !request ||
      !isRequestStatus(request.status) ||
      !requestMachine.can(request.status, "cancel")
    )
      return false;
    await tx
      .update(financingRequests)
      .set({ status: "cancelled" })
      .where(eq(financingRequests.id, requestId));
    await recordAudit(tx, {
      action: "request.cancelled",
      entityType: "financing_request",
      entityId: requestId,
      before: { status: request.status },
    });
    return true;
  });
}

function isRequestStatus(value: string): value is (typeof REQUEST_STATUSES)[number] {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}

export function randomSlugSuffix(): string {
  return randomBytes(4).toString("hex");
}

export type { DocumentType };

import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { recordAudit, schema, withActor, type Transaction } from "@leaseplace/db";
import { can, ERASURE_REJECT_REASONS, retentionIssues, type Permission } from "@leaseplace/domain";
import { appDb } from "../db";
import { logger } from "../logger";
import { documentStorage } from "../storage";
import { actorFor, getViewer, type SpaceViewer } from "../viewer";
import { companyPrivacy } from "./data";

const { privacyRequests, retentionSettings } = schema;

export type PrivacyResult =
  | { status: "done"; summary?: Record<string, number> }
  | { status: "invalid"; issues: string[] }
  | { status: "forbidden" };

async function asViewer<T>(
  permission: Permission,
  fn: (tx: Transaction, viewer: SpaceViewer) => Promise<T>,
): Promise<T | { status: "forbidden" }> {
  const viewer = await getViewer();
  const m = viewer?.membership;
  // Jamais pendant un accès support : la demande appartient au client.
  if (!viewer || !m || viewer.impersonation || !can(m.role, permission))
    return { status: "forbidden" };
  const full = { ...viewer, membership: m };
  return withActor(appDb(), await actorFor(full), (tx) => fn(tx, full));
}

/** Demande d'effacement déposée par le titulaire de l'entreprise. */
export async function requestErasure(note: string): Promise<PrivacyResult> {
  if (note.length > 2000) return { status: "invalid", issues: ["note_too_long"] };
  return asViewer("privacy.manage_own", async (tx, viewer) => {
    const state = await companyPrivacy(tx, viewer.membership.organizationId);
    if (state.pending) return { status: "invalid", issues: ["already_pending"] } as const;
    const id = randomUUID();
    await tx.insert(privacyRequests).values({
      id,
      organizationId: viewer.membership.organizationId,
      requestedBy: viewer.user.id,
      note: note.trim(),
      // Posée par la base (30 jours) ; valeur exigée par le schéma.
      dueOn: new Date(),
    });
    await recordAudit(tx, {
      action: "privacy.erasure_requested",
      entityType: "privacy_request",
      entityId: id,
      metadata: { blocked: state.issues },
    });
    return { status: "done" } as const;
  });
}

export async function cancelErasure(id: string): Promise<PrivacyResult> {
  return asViewer("privacy.manage_own", async (tx) => {
    const updated = await tx
      .update(privacyRequests)
      .set({ status: "cancelled" })
      .where(and(eq(privacyRequests.id, id), eq(privacyRequests.status, "pending")))
      .returning({ id: privacyRequests.id });
    if (updated.length === 0) return { status: "forbidden" } as const;
    await recordAudit(tx, {
      action: "privacy.erasure_cancelled",
      entityType: "privacy_request",
      entityId: id,
    });
    return { status: "done" } as const;
  });
}

export async function rejectErasure(
  id: string,
  reason: string,
  note: string,
): Promise<PrivacyResult> {
  if (!(ERASURE_REJECT_REASONS as readonly string[]).includes(reason))
    return { status: "invalid", issues: ["reason_invalid"] };
  if (reason === "other" && note.trim().length < 10)
    return { status: "invalid", issues: ["note_required"] };
  return asViewer("privacy.manage", async (tx) => {
    const updated = await tx
      .update(privacyRequests)
      .set({ status: "rejected", rejectReason: reason, rejectNote: note.trim() || null })
      .where(and(eq(privacyRequests.id, id), eq(privacyRequests.status, "pending")))
      .returning({ id: privacyRequests.id });
    if (updated.length === 0) return { status: "forbidden" } as const;
    await recordAudit(tx, {
      action: "privacy.erasure_rejected",
      entityType: "privacy_request",
      entityId: id,
      metadata: { reason },
    });
    return { status: "done" } as const;
  });
}

interface StoredFile {
  id: string;
  key: string;
}

/** Supprime les fichiers chiffrés puis marque la purge (idempotent). */
async function purgeFiles(viewer: SpaceViewer, files: readonly StoredFile[]): Promise<number> {
  const purged: string[] = [];
  for (const f of files) {
    try {
      await documentStorage().delete(f.key);
      purged.push(f.id);
    } catch (error) {
      // Reste à purger : la prochaine purge de conservation le reprendra.
      logger.error({ err: error, documentId: f.id }, "privacy.purge : fichier non supprimé");
    }
  }
  if (purged.length === 0) return 0;
  const ids = sql`array[${sql.join(
    purged.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;
  await withActor(appDb(), await actorFor(viewer), (tx) =>
    tx.execute(sql`select privacy.mark_purged(${ids})`),
  );
  return purged.length;
}

/** Exécute l'effacement (base) puis supprime les fichiers des pièces. */
export async function executeErasure(id: string): Promise<PrivacyResult> {
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m || viewer.impersonation || !can(m.role, "privacy.manage"))
    return { status: "forbidden" };
  const full = { ...viewer, membership: m };
  let result: { summary: Record<string, number>; storage: StoredFile[] };
  try {
    const [row] = await withActor(appDb(), await actorFor(full), (tx) =>
      tx.execute<{ r: typeof result }>(sql`select privacy.erase_organization(${id}) as r`),
    );
    if (!row) return { status: "forbidden" };
    result = row.r;
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23514") return { status: "invalid", issues: ["in_progress"] };
    throw error;
  }
  const files = await purgeFiles(full, result.storage);
  return { status: "done", summary: { ...result.summary, files } };
}

export async function saveRetention(key: string, days: number): Promise<PrivacyResult> {
  const issues = retentionIssues(key, days);
  if (issues.length > 0) return { status: "invalid", issues };
  return asViewer("privacy.manage", async (tx, viewer) => {
    await tx
      .insert(retentionSettings)
      .values({ key, days, updatedBy: viewer.user.id })
      .onConflictDoUpdate({
        target: retentionSettings.key,
        set: { days, updatedBy: viewer.user.id, updatedAt: new Date() },
      });
    await recordAudit(tx, {
      action: "retention.updated",
      entityType: "retention",
      entityId: key,
      after: { days },
    });
    return { status: "done" } as const;
  });
}

/** Purge immédiate (sinon : tâche planifiée `pnpm retention:run`). */
export async function runRetention(): Promise<PrivacyResult> {
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m || viewer.impersonation || !can(m.role, "privacy.manage"))
    return { status: "forbidden" };
  const full = { ...viewer, membership: m };
  const [row] = await withActor(appDb(), await actorFor(full), (tx) =>
    tx.execute<{ r: Record<string, number> & { storage: StoredFile[] } }>(
      sql`select privacy.apply_retention_as_admin() as r`,
    ),
  );
  if (!row) return { status: "forbidden" };
  const { storage, ...counts } = row.r;
  const files = await purgeFiles(full, storage);
  return { status: "done", summary: { ...counts, files } };
}

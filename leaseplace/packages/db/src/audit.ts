import { sql } from "drizzle-orm";
import type { AuditAction } from "@leaseplace/domain";
import type { Transaction } from "./client";

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
}

const json = (v: unknown) => (v === undefined || v === null ? null : JSON.stringify(v));

/**
 * Écrit une ligne dans le journal via `audit.record` (seule porte
 * d'écriture). L'acteur est celui du contexte de la transaction.
 */
export async function recordAudit(tx: Transaction, entry: AuditEntry): Promise<number> {
  const rows = await tx.execute<{ id: string }>(sql`
    select audit.record(
      ${entry.action},
      ${entry.entityType},
      ${entry.entityId ?? null},
      ${json(entry.before)}::jsonb,
      ${json(entry.after)}::jsonb,
      ${json(entry.metadata)}::jsonb
    ) as id
  `);
  const id = rows[0]?.id;
  if (id === undefined) throw new Error("audit.record n'a renvoyé aucun identifiant");
  return Number(id);
}

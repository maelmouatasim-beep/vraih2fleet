import { sql } from "drizzle-orm";
import type { Database, Transaction } from "./client";

/**
 * Contexte de sécurité d'une transaction. Les policies RLS lisent
 * `app.user_id` ; l'audit lit tout le reste. Les valeurs sont posées avec
 * set_config(..., true) : elles disparaissent à la fin de la transaction et
 * ne fuient jamais vers une autre requête du pool.
 */
export interface Actor {
  userId: string | null;
  organizationId?: string | null;
  impersonatorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  traceId?: string | null;
}

export async function applyActor(tx: Transaction, actor: Actor): Promise<void> {
  await tx.execute(sql`
    select
      set_config('app.user_id', ${actor.userId ?? ""}, true),
      set_config('app.organization_id', ${actor.organizationId ?? ""}, true),
      set_config('app.impersonator_id', ${actor.impersonatorId ?? ""}, true),
      set_config('app.ip', ${actor.ip ?? ""}, true),
      set_config('app.user_agent', ${actor.userAgent ?? ""}, true),
      set_config('app.trace_id', ${actor.traceId ?? ""}, true)
  `);
}

/** Toute lecture ou écriture applicative passe par ici. */
export function withActor<T>(
  db: Database,
  actor: Actor,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await applyActor(tx, actor);
    return fn(tx);
  });
}

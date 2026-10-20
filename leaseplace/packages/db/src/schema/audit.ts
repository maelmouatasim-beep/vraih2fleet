/**
 * Journal d'audit append-only. Écriture uniquement par la fonction SQL
 * `audit.record` (l'acteur vient du contexte de transaction, jamais d'un
 * paramètre) ; UPDATE, DELETE et TRUNCATE sont refusés par trigger ; chaque
 * ligne est chaînée à la précédente (SHA-256) pour rendre toute altération
 * détectable (`audit.verify_chain()`).
 */
import {
  bigint,
  customType,
  index,
  inet,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const audit = pgSchema("audit");

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const auditEvents = audit.table(
  "events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    actorUserId: uuid("actor_user_id"),
    actorOrganizationId: uuid("actor_organization_id"),
    impersonatorUserId: uuid("impersonator_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata"),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    traceId: text("trace_id"),
    prevHash: bytea("prev_hash"),
    hash: bytea("hash").notNull(),
  },
  (t) => [
    index("events_entity_idx").on(t.entityType, t.entityId),
    index("events_actor_idx").on(t.actorUserId),
    index("events_occurred_at_idx").on(t.occurredAt),
  ],
);

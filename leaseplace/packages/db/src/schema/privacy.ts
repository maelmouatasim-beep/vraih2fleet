/**
 * Phase 9 : droits des personnes (loi 09-08) et accès support tracé.
 * Demandes d'effacement traitées par la plateforme, durées de conservation
 * réglables, accès « en tant que » en lecture seule et limité dans le temps.
 */
import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./identity";

export const privacy = pgSchema("privacy");

export const privacyRequests = privacy.table(
  "requests",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    kind: text("kind").notNull().default("erasure"),
    status: text("status").notNull().default("pending"),
    note: text("note").notNull().default(""),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    dueOn: date("due_on", { mode: "date" }).notNull(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    rejectReason: text("reject_reason"),
    rejectNote: text("reject_note"),
    /** Comptes de ce qui a été effacé (aucune donnée personnelle). */
    summary: jsonb("summary"),
  },
  (t) => [
    uniqueIndex("privacy_requests_one_pending_idx")
      .on(t.organizationId, t.kind)
      .where(sql`status = 'pending'`),
  ],
);

export const retentionSettings = privacy.table("retention_settings", {
  key: text("key").primaryKey(),
  days: integer("days").notNull(),
  updatedBy: uuid("updated_by")
    .notNull()
    .references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const impersonations = privacy.table(
  "impersonations",
  {
    id: uuid("id").primaryKey(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    /** Session de l'agent : l'accès ne vaut que pour elle (historique gardé après déconnexion). */
    actorSessionId: uuid("actor_session_id").notNull(),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id),
    targetOrganizationId: uuid("target_organization_id")
      .notNull()
      .references(() => organizations.id),
    reason: text("reason").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("impersonations_session_idx").on(t.actorSessionId),
    uniqueIndex("impersonations_one_open_idx")
      .on(t.actorSessionId)
      .where(sql`ended_at is null`),
  ],
);

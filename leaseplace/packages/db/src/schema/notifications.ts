/**
 * Notifications (phase 7) : dans l'application pour chaque destinataire,
 * préférences de canaux par utilisateur (e-mail, SMS, WhatsApp). Écrites par
 * le serveur (rôle d'authentification), lues et marquées lues par leur seul
 * destinataire (RLS).
 */
import { boolean, index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { identity, organizations, users } from "./identity";

export const notifications = identity.table(
  "notifications",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id),
    kind: text("kind").notNull(),
    /** Paramètres du texte (référence, entreprise, bailleur…), jamais de pièce. */
    params: jsonb("params").notNull(),
    path: text("path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const notificationPreferences = identity.table("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  email: boolean("email").notNull().default(true),
  sms: boolean("sms").notNull().default(false),
  whatsapp: boolean("whatsapp").notNull().default(false),
  /** Mobile marocain en E.164 (+2126…, +2127…). */
  phone: text("phone"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

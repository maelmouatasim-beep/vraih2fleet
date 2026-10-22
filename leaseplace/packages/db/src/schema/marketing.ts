/**
 * Schéma `marketing` : demandes de contact du site public. Écriture
 * uniquement par `marketing.submit_lead` (validation et limitation de débit
 * en base) ; lecture réservée à l'équipe plateforme.
 */
import { index, inet, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { LEAD_KINDS, LEAD_STATUSES } from "@leaseplace/domain";

export const marketing = pgSchema("marketing");

export const leads = marketing.table(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: LEAD_KINDS }).notNull(),
    organizationName: text("organization_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message"),
    locale: text("locale").notNull(),
    consentVersion: text("consent_version").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    ip: inet("ip"),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_created_at_idx").on(t.createdAt), index("leads_ip_idx").on(t.ip)],
);

/**
 * Boîte d'envoi de développement et de démonstration : les courriels
 * (lien magique, code), SMS et messages WhatsApp y sont déposés quand aucun fournisseur réel n'est
 * configuré. Jamais lue en production (page refusée hors mode démo).
 */
import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const dev = pgSchema("dev");

export const outbox = dev.table("outbox", {
  id: uuid("id").primaryKey(),
  /** Canal : e-mail, SMS ou WhatsApp (destinataire = adresse ou numéro E.164). */
  channel: text("channel").notNull().default("email"),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

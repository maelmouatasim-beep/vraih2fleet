/**
 * Schéma `kyc` : profil des entreprises, coffre-fort de documents, textes
 * légaux versionnés et consentements (loi 09-08). Lecture et écriture sous
 * RLS par les membres de l'entreprise ; lecture par la plateforme.
 */
import {
  bigint,
  date,
  index,
  inet,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, users } from "./identity";

export const kyc = pgSchema("kyc");

export const companies = kyc.table("companies", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name"),
  ice: text("ice").notNull().unique(),
  rcNumber: text("rc_number"),
  rcCourt: text("rc_court"),
  taxId: text("tax_id"),
  cnssNumber: text("cnss_number"),
  legalForm: text("legal_form").notNull(),
  incorporationDate: date("incorporation_date", { mode: "date" }),
  sector: text("sector").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  revenueBand: text("revenue_band"),
  headcountBand: text("headcount_band"),
  kycStatus: text("kyc_status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

export const documents = kyc.table(
  "documents",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    status: text("status").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    issuedOn: date("issued_on", { mode: "date" }),
    scanResult: text("scan_result"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("documents_org_idx").on(t.organizationId),
    uniqueIndex("documents_org_sha_live_idx")
      .on(t.organizationId, t.sha256)
      .where(sql`deleted_at is null`),
  ],
);

export const legalTexts = kyc.table(
  "legal_texts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    version: text("version").notNull(),
    locale: text("locale").notNull(),
    body: text("body").notNull(),
    bodySha256: text("body_sha256").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("legal_texts_kind_version_locale_idx").on(t.kind, t.version, t.locale)],
);

export const consents = kyc.table(
  "consents",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestId: uuid("request_id"),
    purpose: text("purpose").notNull(),
    legalTextId: uuid("legal_text_id")
      .notNull()
      .references(() => legalTexts.id),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => users.id),
  },
  (t) => [
    index("consents_org_idx").on(t.organizationId),
    index("consents_request_idx").on(t.requestId),
  ],
);

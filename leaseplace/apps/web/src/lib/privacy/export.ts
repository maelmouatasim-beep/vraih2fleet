import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";
import type { SpaceViewer } from "../viewer";

/** Version du format d'export (portabilité, loi 09-08). */
export const EXPORT_FORMAT = "leaseplace-export/1";

const {
  organizations,
  memberships,
  users,
  companies,
  documents,
  financingRequests,
  requestEvents,
  consents,
  consentRecipients,
  offers,
  deals,
  dealEvents,
  threads,
  messages,
  notifications,
  notificationPreferences,
  privacyRequests,
} = schema;

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);
const none = "00000000-0000-0000-0000-000000000000";
const inIds = (list: string[]) => (list.length > 0 ? list : [none]);

/**
 * Toutes les données de l'entreprise et de l'utilisateur, lues sous RLS :
 * l'export ne contient que ce que le titulaire peut déjà voir. Les pièces
 * sont listées (métadonnées) ; leur contenu se télécharge au coffre-fort.
 */
export async function buildExport(tx: Transaction, viewer: SpaceViewer) {
  const orgId = viewer.membership.organizationId;
  const [organization] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
  const [company] = await tx.select().from(companies).where(eq(companies.organizationId, orgId));
  const members = await tx
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      since: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, orgId))
    .orderBy(asc(memberships.createdAt));
  const docs = await tx
    .select({
      id: documents.id,
      type: documents.type,
      originalName: documents.originalName,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      sha256: documents.sha256,
      issuedOn: documents.issuedOn,
      reviewStatus: documents.reviewStatus,
      createdAt: documents.createdAt,
      deletedAt: documents.deletedAt,
    })
    .from(documents)
    .where(eq(documents.organizationId, orgId));
  const requests = await tx
    .select()
    .from(financingRequests)
    .where(eq(financingRequests.organizationId, orgId))
    .orderBy(asc(financingRequests.createdAt));
  const requestIds = inIds(ids(requests));
  const [events, consentRows, offerRows, dealRows, threadRows] = await Promise.all([
    tx
      .select()
      .from(requestEvents)
      .where(inArray(requestEvents.requestId, requestIds))
      .orderBy(asc(requestEvents.occurredAt)),
    tx.select().from(consents).where(eq(consents.organizationId, orgId)),
    tx.select().from(offers).where(inArray(offers.requestId, requestIds)),
    tx.select().from(deals).where(eq(deals.companyOrganizationId, orgId)),
    tx.select().from(threads).where(inArray(threads.requestId, requestIds)),
  ]);
  const [recipients, dealHistory, messageRows] = await Promise.all([
    tx
      .select({
        consentId: consentRecipients.consentId,
        lessor: organizations.name,
      })
      .from(consentRecipients)
      .innerJoin(organizations, eq(organizations.id, consentRecipients.lessorOrganizationId))
      .where(inArray(consentRecipients.consentId, inIds(ids(consentRows)))),
    tx
      .select()
      .from(dealEvents)
      .where(inArray(dealEvents.dealId, inIds(ids(dealRows)))),
    tx
      .select()
      .from(messages)
      .where(inArray(messages.threadId, inIds(ids(threadRows))))
      .orderBy(asc(messages.createdAt)),
  ]);
  const [myNotifications, preferences, privacy, myActions] = await Promise.all([
    tx.select().from(notifications).where(eq(notifications.userId, viewer.user.id)),
    tx
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, viewer.user.id)),
    tx.select().from(privacyRequests).where(eq(privacyRequests.organizationId, orgId)),
    tx.execute(sql`select * from privacy.my_audit_events()`),
  ]);
  return {
    format: EXPORT_FORMAT,
    generatedAt: new Date().toISOString(),
    requestedBy: { id: viewer.user.id, name: viewer.user.name, email: viewer.user.email },
    organization,
    company: company ?? null,
    members,
    documents: docs,
    requests: requests.map((r) => ({
      ...r,
      events: events.filter((e) => e.requestId === r.id),
      offers: offerRows.filter((o) => o.requestId === r.id),
      threads: threadRows
        .filter((th) => th.requestId === r.id)
        .map((th) => ({ ...th, messages: messageRows.filter((m) => m.threadId === th.id) })),
    })),
    consents: consentRows.map((c) => ({
      ...c,
      recipients: recipients.filter((x) => x.consentId === c.id).map((x) => x.lessor),
    })),
    deals: dealRows.map((d) => ({ ...d, events: dealHistory.filter((e) => e.dealId === d.id) })),
    notifications: myNotifications,
    notificationPreferences: preferences[0] ?? null,
    privacyRequests: privacy,
    myActions: [...myActions],
  };
}

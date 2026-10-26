import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";

const { threads, messages, threadReads, financingRequests, organizations } = schema;

export type MessageRow = typeof messages.$inferSelect;

/**
 * Messages de l'autre partie arrivés après la dernière lecture de
 * l'utilisateur. La colonne du fil est écrite en clair (`threads.id`) :
 * interpolée, drizzle la rendrait sans table, et `id` désignerait alors le
 * message dans la sous-requête.
 */
function unreadSql(userId: string, organizationId: string) {
  return sql<number>`(
    select count(*)::int from market.messages m
    where m.thread_id = threads.id
      and m.author_organization_id <> ${organizationId}
      and m.created_at > coalesce(
        (select r.last_read_at from market.thread_reads r
         where r.thread_id = threads.id and r.user_id = ${userId}),
        '-infinity'::timestamptz))`;
}

export interface ThreadSummary {
  id: string;
  requestId: string;
  reference: string;
  lessorId: string;
  lessorName: string;
  lastMessageAt: Date | null;
  lastBody: string | null;
  unread: number;
}

/** Fils de l'entreprise (un par bailleur destinataire), les plus récents d'abord. */
export async function companyThreads(
  tx: Transaction,
  userId: string,
  organizationId: string,
): Promise<ThreadSummary[]> {
  return tx
    .select({
      id: threads.id,
      requestId: threads.requestId,
      reference: financingRequests.reference,
      lessorId: threads.lessorOrganizationId,
      lessorName: organizations.name,
      lastMessageAt: threads.lastMessageAt,
      lastBody: sql<string | null>`(
        select m.body from market.messages m where m.thread_id = threads.id
        order by m.created_at desc limit 1)`,
      unread: unreadSql(userId, organizationId),
    })
    .from(threads)
    .innerJoin(financingRequests, eq(financingRequests.id, threads.requestId))
    .innerJoin(organizations, eq(organizations.id, threads.lessorOrganizationId))
    .where(eq(financingRequests.organizationId, organizationId))
    .orderBy(sql`${threads.lastMessageAt} desc nulls last`, desc(threads.createdAt));
}

/** Non-lus par demande, pour la boîte de réception d'un bailleur. */
export async function lessorUnreadByRequest(
  tx: Transaction,
  userId: string,
  organizationId: string,
): Promise<Map<string, number>> {
  const rows = await tx
    .select({ requestId: threads.requestId, unread: unreadSql(userId, organizationId) })
    .from(threads)
    .where(eq(threads.lessorOrganizationId, organizationId));
  return new Map(rows.filter((r) => r.unread > 0).map((r) => [r.requestId, r.unread]));
}

/** Total des messages non lus de l'utilisateur (menu). */
export async function unreadMessagesTotal(
  tx: Transaction,
  userId: string,
  organizationId: string,
): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${unreadSql(userId, organizationId)}), 0)::int` })
    .from(threads);
  return row?.total ?? 0;
}

export interface ThreadView {
  thread: typeof threads.$inferSelect;
  reference: string;
  companyId: string;
  companyName: string;
  lessorName: string;
  messages: MessageRow[];
}

export async function threadView(tx: Transaction, threadId: string): Promise<ThreadView | null> {
  const [row] = await tx
    .select({
      thread: threads,
      reference: financingRequests.reference,
      companyId: financingRequests.organizationId,
      lessorName: organizations.name,
    })
    .from(threads)
    .innerJoin(financingRequests, eq(financingRequests.id, threads.requestId))
    .innerJoin(organizations, eq(organizations.id, threads.lessorOrganizationId))
    .where(eq(threads.id, threadId));
  if (!row) return null;
  const [company] = await tx
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, row.companyId));
  const list = await tx
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.createdAt));
  return { ...row, companyName: company?.name ?? "", messages: list };
}

/** Fil d'un bailleur sur une demande (créé s'il manque : demandes transmises avant la phase 7). */
export async function ensureLessorThread(
  tx: Transaction,
  requestId: string,
  lessorOrganizationId: string,
): Promise<string | null> {
  await tx
    .insert(threads)
    .values({ id: crypto.randomUUID(), requestId, lessorOrganizationId })
    .onConflictDoNothing();
  const [row] = await tx
    .select({ id: threads.id })
    .from(threads)
    .where(
      sql`${threads.requestId} = ${requestId} and ${threads.lessorOrganizationId} = ${lessorOrganizationId}`,
    );
  return row?.id ?? null;
}

/** Accusé de lecture : les messages reçus jusqu'ici sont lus. */
export async function markThreadRead(tx: Transaction, threadId: string, userId: string) {
  const now = new Date();
  await tx
    .insert(threadReads)
    .values({ threadId, userId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [threadReads.threadId, threadReads.userId],
      set: { lastReadAt: now },
    });
}

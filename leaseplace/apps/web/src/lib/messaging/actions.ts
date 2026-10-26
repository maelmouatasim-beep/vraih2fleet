import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { recordAudit, schema, withActor } from "@leaseplace/db";
import {
  can,
  contactDetails,
  messageIssues,
  shouldNotifyMessage,
  type MessageIssue,
} from "@leaseplace/domain";
import { appDb } from "../db";
import { notify } from "../notify";
import { actorFor, getViewer } from "../viewer";
import { threadView } from "./data";

const { messages, deals, routingTargets } = schema;

export type SendResult =
  | { status: "sent" }
  | { status: "invalid"; issues: MessageIssue[] }
  | { status: "forbidden" };

/**
 * Message de l'entreprise ou du bailleur sur un fil. Coordonnées signalées
 * (jamais bloquées) tant qu'aucune offre de ce bailleur n'est acceptée ;
 * l'autre partie est prévenue, sans rafale.
 */
export async function sendMessage(threadId: string, body: string): Promise<SendResult> {
  const issues = messageIssues(body);
  if (issues.length > 0) return { status: "invalid", issues };
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m || !can(m.role, "message.send")) return { status: "forbidden" };
  const outcome = await withActor(
    appDb(),
    await actorFor({ ...viewer, membership: m }),
    async (tx) => {
      const view = await threadView(tx, threadId);
      if (!view) return { status: "forbidden" } as const;
      const lessorId = view.thread.lessorOrganizationId;
      const side =
        m.organizationId === lessorId
          ? "lessor"
          : m.organizationId === view.companyId
            ? "company"
            : null;
      if (!side) return { status: "forbidden" } as const;
      const [deal] = await tx
        .select({ id: deals.id })
        .from(deals)
        .where(
          and(
            eq(deals.requestId, view.thread.requestId),
            eq(deals.lessorOrganizationId, lessorId),
            ne(deals.status, "cancelled"),
          ),
        );
      const flags = deal ? [] : contactDetails(body);
      const [previous] = await tx
        .select({
          authorOrganizationId: messages.authorOrganizationId,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const messageId = randomUUID();
      await tx.insert(messages).values({
        id: messageId,
        threadId,
        authorUserId: viewer.user.id,
        authorOrganizationId: m.organizationId,
        body: body.trim(),
        contactFlags: flags,
      });
      await recordAudit(tx, {
        action: "message.sent",
        entityType: "message",
        entityId: messageId,
        metadata: { threadId, contactFlags: flags },
      });
      const [target] = await tx
        .select({ id: routingTargets.id })
        .from(routingTargets)
        .where(
          and(
            eq(routingTargets.requestId, view.thread.requestId),
            eq(routingTargets.lessorOrganizationId, lessorId),
          ),
        );
      return {
        status: "sent",
        side,
        notifyOther: shouldNotifyMessage(previous ?? null, m.organizationId, new Date()),
        reference: view.reference,
        companyId: view.companyId,
        lessorId,
        lessorName: view.lessorName,
        targetId: target?.id ?? "",
      } as const;
    },
  );
  if (outcome.status !== "sent") return outcome;
  if (outcome.notifyOther) {
    if (outcome.side === "company") {
      await notify("message_from_company", outcome.lessorId, {
        reference: outcome.reference,
        path: `/bailleur/dossiers/${outcome.targetId}`,
      });
    } else {
      await notify("message_from_lessor", outcome.companyId, {
        reference: outcome.reference,
        path: `/entreprise/messages/${threadId}`,
        lessor: outcome.lessorName,
      });
    }
  }
  return { status: "sent" };
}

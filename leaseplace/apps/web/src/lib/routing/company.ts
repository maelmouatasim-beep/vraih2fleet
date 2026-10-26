import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { recordAudit, schema, type Transaction } from "@leaseplace/db";
import { can, selectionIssues, type RoutingCandidate } from "@leaseplace/domain";
import { companyViewer } from "../company-actions";
import { currentLegalText } from "../company-data";
import { appDb } from "../db";
import { notify } from "../notify";
import { actorFor } from "../viewer";
import { withActor } from "@leaseplace/db";
import { track } from "../analytics";

const {
  routingDecisions,
  routingTargets,
  organizations,
  offers,
  financingRequests,
  consents,
  consentRecipients,
  threads,
} = schema;

export interface CompanyTarget {
  id: string;
  lessorId: string;
  lessorName: string;
  status: string;
  rank: number | null;
  proposed: boolean;
  sentAt: Date | null;
  /** Motifs d'exclusion (vides pour un bailleur éligible). */
  exclusions: unknown;
}

export interface CompanyRouting {
  maxTargets: number;
  targets: CompanyTarget[];
  offerCount: number;
}

/** Bailleurs éligibles (et leur statut) de la dernière orientation d'une demande. */
export async function companyRouting(
  tx: Transaction,
  requestId: string,
): Promise<CompanyRouting | null> {
  const [decision] = await tx
    .select()
    .from(routingDecisions)
    .where(eq(routingDecisions.requestId, requestId))
    .orderBy(desc(routingDecisions.createdAt))
    .limit(1);
  if (!decision) return null;
  const targets = await tx
    .select({
      id: routingTargets.id,
      lessorId: routingTargets.lessorOrganizationId,
      lessorName: organizations.name,
      status: routingTargets.status,
      rank: routingTargets.rank,
      proposed: routingTargets.proposed,
      sentAt: routingTargets.sentAt,
      exclusions: routingTargets.exclusions,
    })
    .from(routingTargets)
    .innerJoin(organizations, eq(organizations.id, routingTargets.lessorOrganizationId))
    .where(eq(routingTargets.decisionId, decision.id))
    .orderBy(asc(routingTargets.rank));
  // Offres reçues : en cours, acceptée ou non retenue (jamais une offre retirée).
  const received = await tx
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.requestId, requestId), ne(offers.status, "withdrawn")));
  return { maxTargets: decision.maxTargets, targets, offerCount: received.length };
}

export type SendResult =
  | { status: "sent"; count: number }
  | { status: "invalid"; issues: string[] }
  | { status: "forbidden" };

/**
 * Transmission nominative : consentement de transmission qui nomme chaque
 * bailleur choisi, envoi aux seules cibles nommées, demande « orientée »,
 * bailleurs prévenus. Dirigeant seulement.
 */
export async function sendToLessors(
  requestId: string,
  lessorIds: readonly string[],
  consentGiven: boolean,
  locale: string,
): Promise<SendResult> {
  const viewer = await companyViewer();
  if (!can(viewer.membership.role, "consent.grant")) return { status: "forbidden" };
  if (!consentGiven) return { status: "invalid", issues: ["consent_missing"] };
  const outcome = await withActor(appDb(), await actorFor(viewer), async (tx) => {
    const [request] = await tx
      .select()
      .from(financingRequests)
      .where(eq(financingRequests.id, requestId));
    if (request?.status !== "qualified") return { status: "forbidden" } as const;
    const routing = await companyRouting(tx, requestId);
    if (!routing) return { status: "forbidden" } as const;
    const candidates: RoutingCandidate[] = routing.targets.map((t) => ({
      lessorId: t.lessorId,
      eligible: t.status === "eligible",
      exclusions: [],
      rank: t.rank,
      proposed: t.proposed,
    }));
    const chosen = [...new Set(lessorIds)];
    const issues = selectionIssues(candidates, chosen, routing.maxTargets);
    if (issues.length > 0) return { status: "invalid", issues } as const;
    const text = await currentLegalText(tx, "consent_routing", locale);
    if (!text) throw new Error("Texte de consentement de transmission introuvable");
    const consentId = randomUUID();
    await tx.insert(consents).values({
      id: consentId,
      organizationId: request.organizationId,
      requestId,
      purpose: "routing",
      legalTextId: text.id,
      grantedBy: viewer.user.id,
      ip: (await actorFor(viewer)).ip,
      userAgent: (await actorFor(viewer)).userAgent,
    });
    await tx
      .insert(consentRecipients)
      .values(chosen.map((lessorOrganizationId) => ({ consentId, lessorOrganizationId })));
    const targetIds = routing.targets.filter((t) => chosen.includes(t.lessorId)).map((t) => t.id);
    await tx
      .update(routingTargets)
      .set({ status: "sent" })
      .where(inArray(routingTargets.id, targetIds));
    // Un fil de questions-réponses par bailleur destinataire.
    await tx
      .insert(threads)
      .values(
        chosen.map((lessorOrganizationId) => ({
          id: randomUUID(),
          requestId,
          lessorOrganizationId,
        })),
      )
      .onConflictDoNothing();
    await tx
      .update(financingRequests)
      .set({ status: "routed" })
      .where(eq(financingRequests.id, requestId));
    await recordAudit(tx, {
      action: "consent.granted",
      entityType: "consent",
      entityId: consentId,
      metadata: {
        purpose: "routing",
        legalTextVersion: text.version,
        locale: text.locale,
        requestId,
        recipients: chosen,
      },
    });
    await recordAudit(tx, {
      action: "request.routed",
      entityType: "financing_request",
      entityId: requestId,
      metadata: { recipients: chosen },
    });
    track("request_routed", request.organizationId, { targets: chosen.length });
    return {
      status: "sent",
      count: chosen.length,
      reference: request.reference,
      targets: routing.targets.filter((t) => chosen.includes(t.lessorId)),
    } as const;
  });
  if (outcome.status !== "sent") return outcome;
  for (const t of outcome.targets) {
    await notify("request_received", t.lessorId, {
      reference: outcome.reference,
      path: `/bailleur/dossiers/${t.id}`,
    });
  }
  return { status: "sent", count: outcome.count };
}

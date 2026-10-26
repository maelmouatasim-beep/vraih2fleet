import "server-only";
import { randomUUID } from "node:crypto";
import { recordAudit, schema, type Transaction } from "@leaseplace/db";
import {
  isGrade,
  routeRequest,
  TARGET_LIMITS,
  type Appetite,
  type BusinessSector,
  type EquipmentCategory,
  type Grade,
  type RoutingProfile,
} from "@leaseplace/domain";

const { lessorAppetites, routingDecisions, routingTargets } = schema;

/**
 * Calcule l'orientation d'une demande qualifiée : chaque bailleur ayant
 * déclaré un appétit est évalué ; la décision et les cibles (éligibles ou
 * exclues, avec motifs) sont enregistrées. Exécuté par la plateforme.
 */
export async function computeRouting(
  tx: Transaction,
  userId: string,
  request: {
    id: string;
    amountHt: number | null;
    durationMonths: number | null;
    equipmentCategory: string | null;
  },
  company: { sector: string },
  grade: Grade,
  maxTargets: number = TARGET_LIMITS.default,
) {
  const rows = await tx.select().from(lessorAppetites);
  const appetites: Appetite[] = rows.map((r) => ({
    lessorId: r.organizationId,
    active: r.active,
    minAmountHt: r.minAmountHt,
    maxAmountHt: r.maxAmountHt,
    minDurationMonths: r.minDurationMonths,
    maxDurationMonths: r.maxDurationMonths,
    sectors: r.sectors as BusinessSector[],
    categories: r.categories as EquipmentCategory[],
    minGrade: isGrade(r.minGrade) ? r.minGrade : "A",
  }));
  const profile: RoutingProfile = {
    requestId: request.id,
    amountHt: request.amountHt ?? 0,
    durationMonths: request.durationMonths ?? 0,
    sector: company.sector as BusinessSector,
    category: (request.equipmentCategory ?? "other") as EquipmentCategory,
    grade,
  };
  const candidates = routeRequest(profile, appetites, maxTargets);
  const decisionId = randomUUID();
  await tx.insert(routingDecisions).values({
    id: decisionId,
    requestId: request.id,
    grade,
    maxTargets,
    profile,
    appetites,
    createdBy: userId,
  });
  if (candidates.length > 0) {
    await tx.insert(routingTargets).values(
      candidates.map((c) => ({
        id: randomUUID(),
        decisionId,
        requestId: request.id,
        lessorOrganizationId: c.lessorId,
        status: c.eligible ? "eligible" : "excluded",
        exclusions: c.exclusions,
        rank: c.rank,
        proposed: c.proposed,
      })),
    );
  }
  await recordAudit(tx, {
    action: "routing.computed",
    entityType: "financing_request",
    entityId: request.id,
    metadata: {
      grade,
      maxTargets,
      eligible: candidates.filter((c) => c.eligible).length,
      excluded: candidates.filter((c) => !c.eligible).length,
    },
  });
  return { decisionId, candidates };
}

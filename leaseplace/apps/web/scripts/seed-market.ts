/**
 * Démonstration des phases 6 et 7 : deux demandes d'Atlas déjà passées par
 * la revue. L'une est transmise à quatre bailleurs (trois offres à comparer,
 * un fil de questions-réponses), l'autre a une offre acceptée et un contrat
 * signé (pipeline de Cèdre). Données de démonstration écrites par le
 * propriétaire, triggers désactivés : les chemins réels sont couverts par
 * les tests de base et les e2e. Idempotent (repère : description).
 */
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { schema, type Database } from "@leaseplace/db";
import {
  assess,
  priceOffer,
  referenceAnnualRent,
  type EquipmentCategory,
  type OfferInput,
} from "@leaseplace/domain";

const DAY = 86_400_000;

interface Ids {
  atlas: string;
  owner: string;
  ops: string;
  lessors: Record<string, string>;
  lessorUsers: Record<string, string>;
}

interface DemoRequest {
  description: string;
  category: EquipmentCategory;
  amountHt: number;
  durationMonths: number;
  sentTo: readonly string[];
  offers: readonly { lessor: string; rate: number; fees: number; residualPct: number }[];
}

const COMPARE: DemoRequest = {
  description: "Deux semi-remorques frigorifiques pour la ligne Agadir–Casablanca",
  category: "trailer",
  amountHt: 1_480_000,
  durationMonths: 60,
  sentTo: ["cedre", "argane", "oasis", "sahel"],
  offers: [
    { lessor: "cedre", rate: 0.084, fees: 3_000, residualPct: 0.01 },
    { lessor: "oasis", rate: 0.079, fees: 6_500, residualPct: 0.02 },
    { lessor: "sahel", rate: 0.088, fees: 0, residualPct: 0.01 },
  ],
};

const ACCEPTED: DemoRequest = {
  description: "Trois véhicules utilitaires pour la livraison urbaine à Casablanca",
  category: "light_vehicle",
  amountHt: 420_000,
  durationMonths: 48,
  sentTo: ["cedre", "medina"],
  offers: [
    { lessor: "cedre", rate: 0.081, fees: 2_000, residualPct: 0.01 },
    { lessor: "medina", rate: 0.086, fees: 1_500, residualPct: 0.01 },
  ],
};

const FISCAL_YEARS = [
  {
    year: 2025,
    revenue: 24_800_000,
    netIncome: 1_350_000,
    depreciation: 1_900_000,
    equity: 7_400_000,
    financialDebt: 5_200_000,
    cash: 2_100_000,
  },
  {
    year: 2024,
    revenue: 22_100_000,
    netIncome: 1_120_000,
    depreciation: 1_750_000,
    equity: 6_300_000,
    financialDebt: 5_900_000,
    cash: 1_700_000,
  },
];

export async function seedMarket(
  db: Database,
  ids: Ids,
  legalTexts: { processing: string; routing: string },
) {
  const [existing] = await db
    .select({ id: schema.financingRequests.id })
    .from(schema.financingRequests)
    .where(sql`equipment_description = ${COMPARE.description}`);
  if (existing) return;
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    const now = Date.now();

    async function request(r: DemoRequest, daysAgo: number, status: "routed" | "accepted") {
      const requestId = uuidv7();
      const at = (d: number) => new Date(now - (daysAgo - d) * DAY);
      await tx.insert(schema.financingRequests).values({
        id: requestId,
        reference: sql`credit.next_request_reference()`,
        organizationId: ids.atlas,
        createdBy: ids.owner,
        status,
        equipmentCategory: r.category,
        equipmentDescription: r.description,
        condition: "new",
        supplierName: "Fournisseur de démonstration",
        amountHt: r.amountHt,
        durationMonths: r.durationMonths,
        firstRentPct: 10,
        residualPct: 1,
        periodicity: "monthly",
        submittedAt: at(0),
      });
      const steps = [
        "draft",
        "submitted",
        "in_review",
        "qualified",
        "routed",
        ...(status === "accepted" ? ["accepted"] : []),
      ];
      for (const [i, to] of steps.entries())
        await tx.insert(schema.requestEvents).values({
          requestId,
          fromStatus: i === 0 ? null : steps[i - 1],
          toStatus: to,
          actorUserId: to === "in_review" || to === "qualified" ? ids.ops : ids.owner,
          occurredAt: at(Math.min(i, 3)),
        });
      for (const purpose of ["processing", "routing"] as const)
        await tx.insert(schema.consents).values({
          id: uuidv7(),
          organizationId: ids.atlas,
          requestId,
          purpose,
          legalTextId: legalTexts[purpose],
          grantedBy: ids.owner,
          grantedAt: at(purpose === "processing" ? 0 : 3),
        });
      const [routingConsent] = await tx
        .select({ id: schema.consents.id })
        .from(schema.consents)
        .where(sql`request_id = ${requestId} and purpose = 'routing'`);
      for (const l of r.sentTo)
        await tx.insert(schema.consentRecipients).values({
          consentId: routingConsent?.id ?? "",
          lessorOrganizationId: ids.lessors[l] ?? "",
        });

      // Indice et note validée : calculés par le moteur, comme en revue.
      const assessment = assess({
        now: new Date(now),
        incorporationDate: new Date("2015-03-02T00:00:00Z"),
        sector: "transport",
        equipmentCategory: r.category,
        condition: "new",
        equipmentYear: null,
        amountHt: r.amountHt,
        annualRentHt: referenceAnnualRent({
          amountHt: r.amountHt,
          durationMonths: r.durationMonths,
          periodicity: "monthly",
          firstRentPct: 10,
          residualPct: 1,
        }),
        fiscalYears: FISCAL_YEARS,
        consistencyFailures: 0,
      });
      const assessmentId = uuidv7();
      await tx.insert(schema.riskAssessments).values({
        id: assessmentId,
        requestId,
        organizationId: ids.atlas,
        modelVersion: assessment.modelVersion,
        inputs: { fiscalYears: FISCAL_YEARS },
        ratios: assessment.ratios,
        factors: assessment.factors,
        flags: assessment.flags,
        score: assessment.score,
        grade: assessment.grade,
        uncappedGrade: assessment.uncappedGrade,
        createdBy: ids.ops,
        createdAt: at(2),
      });
      await tx.insert(schema.creditMemos).values({
        id: uuidv7(),
        requestId,
        assessmentId,
        status: "approved",
        content: {
          sections: [
            {
              key: "presentation",
              paragraphs: [
                {
                  text: "Atlas Transports Logistique SARL, transporteur routier basé à Casablanca, en activité depuis 2015.",
                  sources: ["PROFILE"],
                },
              ],
            },
            {
              key: "need",
              paragraphs: [
                {
                  text: `Financement en crédit-bail : ${r.description.toLowerCase()}.`,
                  sources: ["REQUEST"],
                },
              ],
            },
            {
              key: "financials",
              paragraphs: [
                {
                  text: "Chiffre d'affaires en croissance sur les deux derniers exercices, résultat positif, endettement maîtrisé.",
                  sources: ["FINANCIALS"],
                },
              ],
            },
            {
              key: "strengths",
              paragraphs: [
                {
                  text: "Clientèle récurrente de chargeurs, flotte récente, aucun incident de paiement relevé.",
                  sources: ["SCORE"],
                },
              ],
            },
            {
              key: "risks",
              paragraphs: [
                {
                  text: "Exposition au secteur du transport, sensible au prix du gazole.",
                  sources: ["SCORE"],
                },
              ],
            },
          ],
        },
        sourceMap: {},
        createdBy: ids.ops,
        decidedBy: ids.ops,
        decidedAt: at(3),
        createdAt: at(3),
      });

      const decisionId = uuidv7();
      await tx.insert(schema.routingDecisions).values({
        id: decisionId,
        requestId,
        grade: assessment.grade,
        maxTargets: 4,
        profile: { demo: true },
        appetites: [],
        createdBy: ids.ops,
        createdAt: at(3),
      });
      const targets = new Map<string, string>();
      for (const [i, l] of r.sentTo.entries()) {
        const id = uuidv7();
        targets.set(l, id);
        const offered = r.offers.some((o) => o.lessor === l);
        await tx.insert(schema.routingTargets).values({
          id,
          decisionId,
          requestId,
          lessorOrganizationId: ids.lessors[l] ?? "",
          status: offered ? "offered" : "viewed",
          exclusions: [],
          rank: i + 1,
          proposed: true,
          sentAt: at(3),
          slaDueAt: new Date(at(3).getTime() + 3 * DAY),
          firstViewedAt: at(3.2),
          respondedAt: offered ? at(4) : null,
        });
        await tx
          .insert(schema.threads)
          .values({ id: uuidv7(), requestId, lessorOrganizationId: ids.lessors[l] ?? "" });
      }
      const offerIds = new Map<string, string>();
      for (const o of r.offers) {
        const amount = r.amountHt;
        const input: OfferInput = {
          financedAmountHt: amount,
          durationMonths: r.durationMonths,
          periodicity: "monthly",
          timing: "advance",
          annualRate: o.rate,
          firstRentHt: Math.round(amount * 0.1),
          residualValueHt: Math.round(amount * o.residualPct),
          fileFeesHt: o.fees,
          insurancePerPeriodHt: 0,
          insuranceRequired: false,
          validUntil: new Date(now + 20 * DAY),
          conditions: o.lessor === "oasis" ? "Caution personnelle du dirigeant." : "",
        };
        const priced = priceOffer(input);
        const id = uuidv7();
        offerIds.set(o.lessor, id);
        await tx.insert(schema.offers).values({
          id,
          targetId: targets.get(o.lessor) ?? "",
          requestId,
          lessorOrganizationId: ids.lessors[o.lessor] ?? "",
          status:
            status === "accepted"
              ? o.lessor === "cedre"
                ? "accepted"
                : "not_retained"
              : "submitted",
          financedAmountHt: amount,
          durationMonths: input.durationMonths,
          periodicity: input.periodicity,
          timing: input.timing,
          annualRate: input.annualRate,
          firstRentHt: priced.firstRentHt,
          rentHt: priced.rentHt,
          residualValueHt: input.residualValueHt,
          fileFeesHt: input.fileFeesHt,
          insurancePerPeriodHt: 0,
          insuranceRequired: false,
          vatRate: 0.2,
          financingCostHt: priced.normalized.totals.financingCostHt,
          paidTtc: priced.normalized.totals.paidTtc,
          effectiveRate: Math.round(priced.normalized.rates.annualEffectiveRate * 1e6) / 1e6,
          validUntil: input.validUntil,
          conditions: input.conditions,
          submittedBy: ids.lessorUsers[o.lessor] ?? ids.lessorUsers.cedre ?? "",
          createdAt: at(4),
        });
      }
      return { requestId, offerIds, at };
    }

    // 1. Trois offres à comparer, une question de Cèdre et la réponse d'Atlas.
    const compare = await request(COMPARE, 6, "routed");
    const [thread] = await tx
      .select({ id: schema.threads.id })
      .from(schema.threads)
      .where(
        sql`request_id = ${compare.requestId} and lessor_organization_id = ${ids.lessors.cedre ?? ""}`,
      );
    if (thread) {
      await tx.insert(schema.messages).values([
        {
          id: uuidv7(),
          threadId: thread.id,
          authorUserId: ids.lessorUsers.cedre ?? "",
          authorOrganizationId: ids.lessors.cedre ?? "",
          body: "Bonjour, les groupes frigorifiques sont-ils compris dans le devis du fournisseur ?",
          createdAt: compare.at(4.1),
        },
        {
          id: uuidv7(),
          threadId: thread.id,
          authorUserId: ids.owner,
          authorOrganizationId: ids.atlas,
          body: "Bonjour, oui : le devis inclut les deux groupes frigorifiques et leur mise en service.",
          createdAt: compare.at(4.3),
        },
      ]);
      await tx
        .update(schema.threads)
        .set({ lastMessageAt: compare.at(4.3) })
        .where(sql`id = ${thread.id}`);
    }

    // 2. Offre de Cèdre acceptée, contrat signé : la livraison est attendue.
    const accepted = await request(ACCEPTED, 20, "accepted");
    const dealId = uuidv7();
    const acceptedAt = accepted.at(6);
    const signedOn = new Date(
      Date.UTC(acceptedAt.getUTCFullYear(), acceptedAt.getUTCMonth(), acceptedAt.getUTCDate() + 4),
    );
    await tx.insert(schema.deals).values({
      id: dealId,
      requestId: accepted.requestId,
      offerId: accepted.offerIds.get("cedre") ?? "",
      companyOrganizationId: ids.atlas,
      lessorOrganizationId: ids.lessors.cedre ?? "",
      status: "signed",
      financedAmountHt: ACCEPTED.amountHt,
      acceptedAt,
      acceptedBy: ids.owner,
      signedOn,
    });
    await tx.insert(schema.dealEvents).values([
      {
        dealId,
        fromStatus: null,
        toStatus: "accepted",
        occurredOn: acceptedAt,
        actorUserId: ids.owner,
      },
      {
        dealId,
        fromStatus: "accepted",
        toStatus: "signed",
        occurredOn: signedOn,
        actorUserId: ids.lessorUsers.cedre ?? null,
      },
    ]);
  });
}

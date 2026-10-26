import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BUSINESS_SECTORS,
  DECLINE_REASONS,
  EQUIPMENT_CATEGORIES,
  OFFER_STATUSES,
  TARGET_STATUSES,
  targetMachine,
} from "@leaseplace/domain";
import type { Transaction } from "../client";
import {
  consentRecipients,
  consents,
  creditMemos,
  documents,
  financingRequests,
  legalTexts,
  offers,
  requestDocuments,
  riskAssessments,
  routingDecisions,
  routingTargets,
  targetDeclines,
  companies,
} from "../schema";
import { asApp, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;
const texts: Record<string, string> = {};
const tag = Number.parseInt(uuidv7().slice(-6), 16);
const hex = (n: number) => n.toString(16).padStart(64, "0");

beforeAll(async () => {
  f = await createFixture(db, {
    pme: {
      type: "company",
      members: { dirigeant: "company_owner", collaborateur: "company_member" },
    },
    bailleurA: { type: "lessor", members: { adminA: "lessor_admin", analysteA: "lessor_analyst" } },
    bailleurB: { type: "lessor", members: { analysteB: "lessor_analyst" } },
    plateforme: { type: "platform", members: { ops: "platform_ops" } },
  });
  for (const kind of ["consent_processing", "consent_routing"]) {
    const [t] = await db
      .select()
      .from(legalTexts)
      .where(sql`kind = ${kind} and locale = 'fr'`);
    texts[kind] = t?.id ?? "";
  }
  await db.insert(companies).values({
    organizationId: org("pme"),
    legalName: "PME Routage SARL",
    ice: `7${String(tag).padStart(14, "0")}`.slice(0, 15),
    legalForm: "sarl",
    sector: "transport",
    city: "Fès",
  });
});

afterAll(async () => {
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      const o = org("pme");
      const reqs = sql`(select id from credit.financing_requests where organization_id = ${o})`;
      await tx.execute(sql`delete from market.offers where request_id in ${reqs}`);
      await tx.execute(
        sql`delete from credit.target_declines where target_id in (select id from credit.routing_targets where request_id in ${reqs})`,
      );
      await tx.execute(sql`delete from credit.routing_targets where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.routing_decisions where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.credit_memos where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.risk_assessments where request_id in ${reqs}`);
      await tx.execute(
        sql`delete from kyc.consent_recipients where consent_id in (select id from kyc.consents where organization_id = ${o})`,
      );
      await tx.execute(sql`delete from kyc.consents where organization_id = ${o}`);
      await tx.execute(sql`delete from credit.financing_requests where organization_id = ${o}`);
      await tx.execute(sql`delete from kyc.documents where organization_id = ${o}`);
      await tx.execute(sql`delete from kyc.companies where organization_id = ${o}`);
    })
    .catch(() => undefined);
  await f.cleanup().catch(() => undefined);
  await close();
});

function org(key: string) {
  return f.orgs[key] ?? "";
}
const user = (key: string) => f.users[key] ?? "";
const as = (key: string) => ({ userId: f.users[key] ?? null });

function newDocument(tx: Transaction, n: number, type: string) {
  const id = uuidv7();
  return tx
    .insert(documents)
    .values({
      id,
      organizationId: org("pme"),
      type,
      status: "clean",
      originalName: `${type}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 10,
      sha256: hex(tag * 100 + n),
      storageKey: `${org("pme")}/${id}`,
      uploadedBy: user("dirigeant"),
    })
    .returning();
}

interface Routed {
  requestId: string;
  targetA: string;
  targetB: string;
  docs: { kyc: string; quote: string; otherQuote: string };
}

/** Demande qualifiée, décision d'orientation calculée (A et B éligibles). */
async function qualifiedRequest(n: number): Promise<Routed> {
  const requestId = uuidv7();
  const docs = await asApp(db, as("dirigeant"), async (tx) => {
    await tx.insert(financingRequests).values({
      id: requestId,
      reference: sql`credit.next_request_reference()`,
      organizationId: org("pme"),
      createdBy: user("dirigeant"),
      equipmentCategory: "truck",
      amountHt: 800_000,
    });
    const [kyc] = await newDocument(tx, n * 10 + 1, "rc_extract");
    const [quote] = await newDocument(tx, n * 10 + 2, "quote");
    const [otherQuote] = await newDocument(tx, n * 10 + 3, "quote");
    await tx.insert(requestDocuments).values({ requestId, documentId: quote?.id ?? "" });
    await tx.insert(consents).values({
      id: uuidv7(),
      organizationId: org("pme"),
      requestId,
      purpose: "processing",
      legalTextId: texts.consent_processing ?? "",
      grantedBy: user("dirigeant"),
    });
    await tx
      .update(financingRequests)
      .set({ status: "submitted" })
      .where(sql`id = ${requestId}`);
    return { kyc: kyc?.id ?? "", quote: quote?.id ?? "", otherQuote: otherQuote?.id ?? "" };
  });
  return asApp(db, as("ops"), async (tx) => {
    await tx
      .update(financingRequests)
      .set({ status: "in_review" })
      .where(sql`id = ${requestId}`);
    const assessmentId = uuidv7();
    await tx.insert(riskAssessments).values({
      id: assessmentId,
      requestId,
      organizationId: org("pme"),
      modelVersion: "1.0.0",
      inputs: {},
      ratios: {},
      factors: [],
      flags: [],
      score: 70,
      grade: "B",
      uncappedGrade: "B",
      createdBy: user("ops"),
    });
    const memoId = uuidv7();
    await tx.insert(creditMemos).values({
      id: memoId,
      requestId,
      assessmentId,
      content: { sections: [] },
      sourceMap: {},
      createdBy: user("ops"),
    });
    await tx
      .update(creditMemos)
      .set({ status: "approved", decidedBy: user("ops") })
      .where(sql`id = ${memoId}`);
    await tx
      .update(financingRequests)
      .set({ status: "qualified" })
      .where(sql`id = ${requestId}`);
    const decisionId = uuidv7();
    await tx.insert(routingDecisions).values({
      id: decisionId,
      requestId,
      grade: "B",
      maxTargets: 4,
      profile: {},
      appetites: [],
      createdBy: user("ops"),
    });
    const targetA = uuidv7();
    const targetB = uuidv7();
    await tx.insert(routingTargets).values([
      {
        id: targetA,
        decisionId,
        requestId,
        lessorOrganizationId: org("bailleurA"),
        status: "eligible",
        exclusions: [],
        rank: 1,
        proposed: true,
      },
      {
        id: targetB,
        decisionId,
        requestId,
        lessorOrganizationId: org("bailleurB"),
        status: "eligible",
        exclusions: [],
        rank: 2,
        proposed: true,
      },
    ]);
    return { requestId, targetA, targetB, docs };
  });
}

/** Consentement de transmission nommant `lessors`, puis envoi aux cibles correspondantes. */
async function consentAndSend(r: Routed, lessors: string[], targets: string[]) {
  return asApp(db, as("dirigeant"), async (tx) => {
    const consentId = uuidv7();
    await tx.insert(consents).values({
      id: consentId,
      organizationId: org("pme"),
      requestId: r.requestId,
      purpose: "routing",
      legalTextId: texts.consent_routing ?? "",
      grantedBy: user("dirigeant"),
    });
    for (const l of lessors)
      await tx.insert(consentRecipients).values({ consentId, lessorOrganizationId: org(l) });
    for (const t of targets)
      await tx
        .update(routingTargets)
        .set({ status: "sent" })
        .where(sql`id = ${t}`);
    return consentId;
  });
}

function offerValues(r: Routed, targetId: string, lessorKey: string, userKey: string) {
  return {
    id: uuidv7(),
    targetId,
    requestId: r.requestId,
    lessorOrganizationId: org(lessorKey),
    financedAmountHt: 800_000,
    durationMonths: 60,
    periodicity: "monthly",
    timing: "advance",
    annualRate: 0.085,
    firstRentHt: 80_000,
    rentHt: 14_200,
    residualValueHt: 8_000,
    fileFeesHt: 2_000,
    insurancePerPeriodHt: 0,
    insuranceRequired: false,
    vatRate: 0.2,
    financingCostHt: 170_000,
    paidTtc: 1_164_000,
    effectiveRate: 0.0912,
    validUntil: new Date(Date.now() + 30 * 86_400_000),
    submittedBy: user(userKey),
  };
}

describe("listes de valeurs : domaine ≡ contraintes SQL", () => {
  async function checkValues(constraint: string) {
    const [row] = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${constraint}`,
    );
    return new Set([...(row?.def ?? "").matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]));
  }
  it.each([
    ["routing_targets_status_check", TARGET_STATUSES],
    ["target_declines_reason_check", DECLINE_REASONS],
    ["offers_status_check", OFFER_STATUSES],
    ["appetites_sectors_check", BUSINESS_SECTORS],
    ["appetites_categories_check", EQUIPMENT_CATEGORIES],
  ] as const)("%s", async (name, values) => {
    expect(await checkValues(name)).toEqual(new Set(values));
  });

  it("transitions SQL des cibles ≡ targetMachine", async () => {
    const [row] = await db.execute<{ src: string }>(
      sql`select prosrc as src from pg_proc where proname = 'guard_routing_target'`,
    );
    const pairs = [...(row?.src ?? "").matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(pairs).toEqual(targetMachine.edges().map(([a, b]) => [a, b]));
  });
});

describe("transmission nominative", () => {
  it("l'entreprise voit les bailleurs éligibles ; aucun bailleur ne voit rien avant l'envoi", async () => {
    const r = await qualifiedRequest(1);
    const seen = await asApp(db, as("collaborateur"), (tx) =>
      tx
        .select()
        .from(routingTargets)
        .where(sql`request_id = ${r.requestId}`),
    );
    expect(seen).toHaveLength(2);
    for (const key of ["analysteA", "analysteB"]) {
      const view = await asApp(db, as(key), async (tx) => ({
        request: await tx
          .select()
          .from(financingRequests)
          .where(sql`id = ${r.requestId}`),
        targets: await tx
          .select()
          .from(routingTargets)
          .where(sql`request_id = ${r.requestId}`),
      }));
      expect(view, key).toEqual({ request: [], targets: [] });
    }
  });

  it("envoi : consentement du dirigeant nommant le bailleur, jamais au-delà", async () => {
    const r = await qualifiedRequest(2);
    // Sans consentement : refusé.
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx
            .update(routingTargets)
            .set({ status: "sent" })
            .where(sql`id = ${r.targetA}`),
        ),
      ),
    ).toBe("42501");
    // Consentement qui ne nomme que A : envoi à B refusé.
    expect(await pgError(consentAndSend(r, ["bailleurA"], [r.targetA, r.targetB]))).toBe("42501");
    // Un collaborateur ne peut pas envoyer.
    expect(
      await asApp(db, as("collaborateur"), (tx) =>
        tx
          .update(routingTargets)
          .set({ status: "sent" })
          .where(sql`id = ${r.targetA}`)
          .returning(),
      ),
    ).toEqual([]);
    await consentAndSend(r, ["bailleurA"], [r.targetA]);
    const [sent] = await db
      .select()
      .from(routingTargets)
      .where(sql`id = ${r.targetA}`);
    expect(sent?.sentAt).toBeInstanceOf(Date);
    expect((sent?.slaDueAt?.getTime() ?? 0) - (sent?.sentAt?.getTime() ?? 0)).toBe(72 * 3_600_000);
    await asApp(db, as("dirigeant"), (tx) =>
      tx
        .update(financingRequests)
        .set({ status: "routed" })
        .where(sql`id = ${r.requestId}`),
    );
  });

  it("le bailleur destinataire lit le dossier ; l'autre bailleur ne lit rien", async () => {
    const r = await qualifiedRequest(3);
    await consentAndSend(r, ["bailleurA"], [r.targetA]);
    const read = (key: string) =>
      asApp(db, as(key), async (tx) => ({
        request: (
          await tx
            .select()
            .from(financingRequests)
            .where(sql`id = ${r.requestId}`)
        ).length,
        company: (
          await tx
            .select()
            .from(companies)
            .where(sql`organization_id = ${org("pme")}`)
        ).length,
        docs: (
          await tx
            .select()
            .from(documents)
            .where(sql`organization_id = ${org("pme")}`)
        )
          .map((d) => d.id)
          .sort(),
        memos: (
          await tx
            .select()
            .from(creditMemos)
            .where(sql`request_id = ${r.requestId}`)
        ).length,
        assessments: (
          await tx
            .select()
            .from(riskAssessments)
            .where(sql`request_id = ${r.requestId}`)
        ).length,
        targets: (
          await tx
            .select()
            .from(routingTargets)
            .where(sql`request_id = ${r.requestId}`)
        ).length,
      }));
    const a = await read("analysteA");
    expect(a.request).toBe(1);
    expect(a.company).toBe(1);
    expect(a.memos).toBe(1);
    expect(a.assessments).toBe(1);
    expect(a.targets).toBe(1);
    // Pièces du coffre-fort et devis de CETTE demande ; jamais le devis d'une autre demande.
    expect(a.docs).toContain(r.docs.kyc);
    expect(a.docs).toContain(r.docs.quote);
    expect(a.docs).not.toContain(r.docs.otherQuote);
    expect(await read("analysteB")).toEqual({
      request: 0,
      company: 0,
      docs: [],
      memos: 0,
      assessments: 0,
      targets: 0,
    });
  });

  it("retrait du consentement : le bailleur perd l'accès", async () => {
    const r = await qualifiedRequest(4);
    const consentId = await consentAndSend(r, ["bailleurA"], [r.targetA]);
    await asApp(db, as("dirigeant"), (tx) =>
      tx
        .update(consents)
        .set({ revokedAt: new Date(), revokedBy: user("dirigeant") })
        .where(sql`id = ${consentId}`),
    );
    const view = await asApp(db, as("analysteA"), (tx) =>
      tx
        .select()
        .from(financingRequests)
        .where(sql`id = ${r.requestId}`),
    );
    expect(view).toEqual([]);
  });
});

describe("réponse du bailleur", () => {
  it("consultation, offre unique, retrait ; l'entreprise voit l'offre, pas l'autre bailleur", async () => {
    const r = await qualifiedRequest(5);
    await consentAndSend(r, ["bailleurA", "bailleurB"], [r.targetA, r.targetB]);

    // Seul le bailleur marque « consulté ».
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx
            .update(routingTargets)
            .set({ status: "viewed" })
            .where(sql`id = ${r.targetA}`),
        ),
      ),
    ).toBe("42501");
    await asApp(db, as("analysteA"), (tx) =>
      tx
        .update(routingTargets)
        .set({ status: "viewed" })
        .where(sql`id = ${r.targetA}`),
    );

    // B ne peut pas déposer sur la cible de A.
    expect(
      await pgError(
        asApp(db, as("analysteB"), (tx) =>
          tx.insert(offers).values(offerValues(r, r.targetA, "bailleurA", "analysteB")),
        ),
      ),
    ).toBe("42501");

    const offer = offerValues(r, r.targetA, "bailleurA", "analysteA");
    await asApp(db, as("analysteA"), async (tx) => {
      await tx.insert(offers).values(offer);
      await tx
        .update(routingTargets)
        .set({ status: "offered" })
        .where(sql`id = ${r.targetA}`);
    });
    // Une seule offre active par cible (et plus de dépôt une fois l'offre faite).
    expect(
      await pgError(
        asApp(db, as("analysteA"), (tx) =>
          tx.insert(offers).values(offerValues(r, r.targetA, "bailleurA", "analysteA")),
        ),
      ),
    ).toBe("23514");

    const company = await asApp(db, as("dirigeant"), (tx) =>
      tx
        .select()
        .from(offers)
        .where(sql`request_id = ${r.requestId}`),
    );
    expect(company.map((o) => o.id)).toEqual([offer.id]);
    const other = await asApp(db, as("analysteB"), (tx) =>
      tx
        .select()
        .from(offers)
        .where(sql`request_id = ${r.requestId}`),
    );
    expect(other).toEqual([]);

    // Offre figée : seul le retrait est permis.
    expect(
      await pgError(
        asApp(db, as("analysteA"), (tx) =>
          tx
            .update(offers)
            .set({ rentHt: 1 })
            .where(sql`id = ${offer.id}`),
        ),
      ),
    ).toBe("42501");
    await asApp(db, as("analysteA"), async (tx) => {
      await tx
        .update(offers)
        .set({ status: "withdrawn" })
        .where(sql`id = ${offer.id}`);
      await tx
        .update(routingTargets)
        .set({ status: "viewed" })
        .where(sql`id = ${r.targetA}`);
    });
    const after = await asApp(db, as("dirigeant"), (tx) =>
      tx
        .select()
        .from(offers)
        .where(sql`request_id = ${r.requestId}`),
    );
    expect(after).toEqual([]);
  });

  it("refus motivé : visible du bailleur et de la plateforme, pas de l'entreprise", async () => {
    const r = await qualifiedRequest(6);
    await consentAndSend(r, ["bailleurB"], [r.targetB]);
    await asApp(db, as("analysteB"), async (tx) => {
      await tx.insert(targetDeclines).values({
        targetId: r.targetB,
        reason: "sector_exposure",
        declinedBy: user("analysteB"),
      });
      await tx
        .update(routingTargets)
        .set({ status: "declined" })
        .where(sql`id = ${r.targetB}`);
    });
    const seen = async (key: string) =>
      (
        await asApp(db, as(key), (tx) =>
          tx
            .select()
            .from(targetDeclines)
            .where(sql`target_id = ${r.targetB}`),
        )
      ).length;
    expect(await seen("analysteB")).toBe(1);
    expect(await seen("ops")).toBe(1);
    expect(await seen("dirigeant")).toBe(0);
    expect(
      await pgError(
        asApp(db, as("analysteB"), (tx) =>
          tx
            .update(routingTargets)
            .set({ status: "offered" })
            .where(sql`id = ${r.targetB}`),
        ),
      ),
    ).toBe("23514");
  });
});

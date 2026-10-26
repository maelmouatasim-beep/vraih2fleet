import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CONTACT_FLAGS,
  DEAL_CANCEL_REASONS,
  DEAL_STATUSES,
  NOTIFICATION_KIND_LIST,
  REQUEST_STATUSES,
  dealMachine,
  offerMachine,
} from "@leaseplace/domain";
import {
  dealEvents,
  deals,
  financingRequests,
  messages,
  notificationPreferences,
  notifications,
  offers,
  threadReads,
  threads,
} from "../schema";
import { asApp, asAuth, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;
let consentText = "";

const org = (key: string) => f.orgs[key] ?? "";
const user = (key: string) => f.users[key] ?? "";
const as = (key: string) => ({ userId: f.users[key] ?? null });
const today = () => new Date(new Date().toISOString().slice(0, 10));
const daysAgo = (n: number) => new Date(today().getTime() - n * 86_400_000);

beforeAll(async () => {
  f = await createFixture(db, {
    pme: {
      type: "company",
      members: { dirigeant: "company_owner", collaborateur: "company_member" },
    },
    autrePme: { type: "company", members: { autreDirigeant: "company_owner" } },
    bailleurA: {
      type: "lessor",
      members: { adminA: "lessor_admin", analysteA: "lessor_analyst", lecteurA: "lessor_viewer" },
    },
    bailleurB: { type: "lessor", members: { analysteB: "lessor_analyst" } },
    bailleurC: { type: "lessor", members: { analysteC: "lessor_analyst" } },
    plateforme: { type: "platform", members: { ops: "platform_ops" } },
  });
  const [t] = await db.execute<{ id: string }>(
    sql`select id from kyc.legal_texts where kind = 'consent_routing' and locale = 'fr' limit 1`,
  );
  consentText = t?.id ?? "";
  // Mandats en vigueur (sinon la mise en loyer est refusée) : écrits par le
  // propriétaire, triggers désactivés ; les règles des mandats sont testées
  // dans billing.test.ts.
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    for (const l of ["bailleurA", "bailleurB"])
      await tx.execute(sql`insert into billing.mandates
        (id, lessor_organization_id, status, contract_version, signed_on, grid, activated_at, created_by)
        values (${uuidv7()}, ${org(l)}, 'active', 'TEST-1', now()::date - 30,
          '[{"from":0,"rate":0.015},{"from":500000,"rate":0.012}]', now() - interval '30 days', ${user("ops")})`);
  });
});

afterAll(async () => {
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      const reqs = sql`(select id from credit.financing_requests where organization_id = ${org("pme")})`;
      await tx.execute(
        sql`delete from market.messages where thread_id in (select id from market.threads where request_id in ${reqs})`,
      );
      await tx.execute(
        sql`delete from market.thread_reads where thread_id in (select id from market.threads where request_id in ${reqs})`,
      );
      await tx.execute(sql`delete from market.threads where request_id in ${reqs}`);
      await tx.execute(
        sql`delete from market.deal_events where deal_id in (select id from market.deals where request_id in ${reqs})`,
      );
      await tx.execute(sql`delete from market.deals where request_id in ${reqs}`);
      await tx.execute(sql`delete from billing.commissions where request_id in ${reqs}`);
      await tx.execute(sql`delete from market.offers where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.routing_targets where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.routing_decisions where request_id in ${reqs}`);
      await tx.execute(
        sql`delete from kyc.consent_recipients where consent_id in (select id from kyc.consents where organization_id = ${org("pme")})`,
      );
      await tx.execute(sql`delete from kyc.consents where organization_id = ${org("pme")}`);
      await tx.execute(sql`delete from credit.request_events where request_id in ${reqs}`);
      await tx.execute(
        sql`delete from credit.financing_requests where organization_id = ${org("pme")}`,
      );
      await tx.execute(
        sql`delete from billing.mandates where lessor_organization_id in (${org("bailleurA")}, ${org("bailleurB")})`,
      );
      await tx.execute(
        sql`delete from identity.notifications where user_id in (${sql.join(
          Object.values(f.users).map((u) => sql`${u}`),
          sql`, `,
        )})`,
      );
    })
    .catch(() => undefined);
  await f.cleanup().catch(() => undefined);
  await close();
});

interface Routed {
  requestId: string;
  targets: Record<"A" | "B" | "C", string>;
  offerA: string;
  offerB: string;
}

/**
 * Demande transmise à A et B (C éligible, non choisi) avec une offre de
 * chacun. Créée par le propriétaire, triggers désactivés : les chemins de
 * la phase 6 sont testés dans routing.test.ts.
 */
async function routedWithOffers(options: { expiredB?: boolean } = {}): Promise<Routed> {
  const requestId = uuidv7();
  const decisionId = uuidv7();
  const consentId = uuidv7();
  const targets = { A: uuidv7(), B: uuidv7(), C: uuidv7() };
  const offerA = uuidv7();
  const offerB = uuidv7();
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.insert(financingRequests).values({
      id: requestId,
      reference: sql`credit.next_request_reference()`,
      organizationId: org("pme"),
      createdBy: user("dirigeant"),
      status: "routed",
      equipmentCategory: "truck",
      amountHt: 800_000,
      durationMonths: 60,
    });
    await tx.execute(sql`insert into kyc.consents (id, organization_id, request_id, purpose, legal_text_id, granted_by)
      values (${consentId}, ${org("pme")}, ${requestId}, 'routing', ${consentText}, ${user("dirigeant")})`);
    await tx.execute(sql`insert into kyc.consent_recipients (consent_id, lessor_organization_id)
      values (${consentId}, ${org("bailleurA")}), (${consentId}, ${org("bailleurB")})`);
    await tx.execute(sql`insert into credit.routing_decisions (id, request_id, grade, max_targets, profile, appetites, created_by)
      values (${decisionId}, ${requestId}, 'B', 4, '{}', '[]', ${user("ops")})`);
    for (const [k, status] of [
      ["A", "offered"],
      ["B", "offered"],
      ["C", "eligible"],
    ] as const)
      await tx.execute(sql`insert into credit.routing_targets (id, decision_id, request_id, lessor_organization_id, status, exclusions, proposed)
        values (${targets[k]}, ${decisionId}, ${requestId}, ${org(`bailleur${k}`)}, ${status}, '[]', true)`);
    for (const [id, k, valid] of [
      [offerA, "A", 30],
      [offerB, "B", options.expiredB ? -1 : 30],
    ] as const)
      await tx.insert(offers).values({
        id,
        targetId: targets[k],
        requestId,
        lessorOrganizationId: org(`bailleur${k}`),
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
        validUntil: new Date(Date.now() + valid * 86_400_000),
        submittedBy: user(k === "A" ? "analysteA" : "analysteB"),
      });
  });
  return { requestId, targets, offerA, offerB };
}

const accept = (who: string, r: Routed, offerId: string) =>
  asApp(db, as(who), (tx) =>
    tx
      .insert(deals)
      .values({
        id: uuidv7(),
        requestId: r.requestId,
        offerId,
        companyOrganizationId: org("pme"),
        lessorOrganizationId: org("bailleurA"),
        financedAmountHt: 1,
        acceptedBy: user(who),
      })
      .returning(),
  );

const statusOf = async (r: Routed) => {
  const [req] = await db
    .select()
    .from(financingRequests)
    .where(sql`id = ${r.requestId}`);
  const rows = await db
    .select()
    .from(offers)
    .where(sql`request_id = ${r.requestId}`);
  const byId = Object.fromEntries(rows.map((o) => [o.id, o.status]));
  return { request: req?.status, A: byId[r.offerA], B: byId[r.offerB] };
};

const update = (who: string, dealId: string, set: Partial<typeof deals.$inferInsert>) =>
  asApp(db, as(who), (tx) =>
    tx
      .update(deals)
      .set(set)
      .where(sql`id = ${dealId}`)
      .returning(),
  );

describe("listes et transitions : domaine ≡ SQL", () => {
  async function values(constraint: string) {
    const [row] = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${constraint}`,
    );
    return new Set([...(row?.def ?? "").matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]));
  }
  it.each([
    ["requests_status_check", REQUEST_STATUSES],
    ["deals_status_check", DEAL_STATUSES],
    ["deals_cancel_reason_check", DEAL_CANCEL_REASONS],
    ["messages_flags_check", CONTACT_FLAGS],
    ["notifications_kind_check", NOTIFICATION_KIND_LIST],
  ] as const)("%s", async (name, list) => {
    expect(await values(name)).toEqual(new Set(list));
  });

  it.each([
    ["guard_deal", dealMachine],
    ["guard_offer", offerMachine],
  ] as const)("%s", async (fn, machine) => {
    const [row] = await db.execute<{ src: string }>(
      sql`select prosrc as src from pg_proc where proname = ${fn}`,
    );
    const pairs = [...(row?.src ?? "").matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(pairs).toEqual(machine.edges().map(([a, b]) => [a, b]));
  });
});

describe("acceptation", () => {
  it("le dirigeant accepte : autres offres non retenues, demande acceptée, historique", async () => {
    const r = await routedWithOffers();
    expect(await pgError(accept("collaborateur", r, r.offerA))).toBe("42501");
    expect(await pgError(accept("analysteA", r, r.offerA))).toBe("42501");
    const [deal] = await accept("dirigeant", r, r.offerA);
    // Les champs dérivés viennent de l'offre et de la demande, pas de l'appelant.
    expect(deal).toMatchObject({
      status: "accepted",
      financedAmountHt: 800_000,
      lessorOrganizationId: org("bailleurA"),
      acceptedBy: user("dirigeant"),
    });
    expect(await statusOf(r)).toEqual({ request: "accepted", A: "accepted", B: "not_retained" });
    const events = await asApp(db, as("analysteA"), (tx) =>
      tx
        .select()
        .from(dealEvents)
        .where(sql`deal_id = ${deal?.id ?? ""}`),
    );
    expect(events.map((e) => e.toStatus)).toEqual(["accepted"]);
    // Une seule opération en cours par demande.
    expect(await pgError(accept("dirigeant", r, r.offerB))).toBe("23514");
  });

  it("une offre expirée ne s'accepte pas", async () => {
    const r = await routedWithOffers({ expiredB: true });
    expect(await pgError(accept("dirigeant", r, r.offerB))).toBe("23514");
  });

  it("cloisonnement : chaque partie voit son opération, les autres rien", async () => {
    const r = await routedWithOffers();
    const [deal] = await accept("dirigeant", r, r.offerA);
    const read = (who: string) =>
      asApp(db, as(who), (tx) =>
        tx
          .select()
          .from(deals)
          .where(sql`id = ${deal?.id ?? ""}`),
      );
    for (const who of ["dirigeant", "collaborateur", "analysteA", "lecteurA", "ops"])
      expect(await read(who), who).toHaveLength(1);
    for (const who of ["analysteB", "analysteC", "autreDirigeant"])
      expect(await read(who), who).toHaveLength(0);
    // L'entreprise voit l'offre acceptée et celle non retenue ; B ne voit que la sienne.
    const seen = (who: string) =>
      asApp(db, as(who), (tx) =>
        tx
          .select()
          .from(offers)
          .where(sql`request_id = ${r.requestId}`),
      );
    expect((await seen("dirigeant")).map((o) => o.status).sort()).toEqual([
      "accepted",
      "not_retained",
    ]);
    expect((await seen("analysteB")).map((o) => o.id)).toEqual([r.offerB]);
    // Une offre ne s'accepte pas « à la main ».
    expect(
      await pgError(
        asApp(db, as("analysteB"), (tx) =>
          tx
            .update(offers)
            .set({ status: "submitted" })
            .where(sql`id = ${r.offerB}`),
        ),
      ),
    ).toBe("42501");
  });
});

describe("étapes datées par le bailleur", () => {
  it("signature, livraison, mise en loyer : dates valides, demande financée", async () => {
    const r = await routedWithOffers();
    const [deal] = await accept("dirigeant", r, r.offerA);
    const id = deal?.id ?? "";
    expect(await pgError(update("dirigeant", id, { status: "signed", signedOn: today() }))).toBe(
      "42501",
    );
    // Lecteur : aucune ligne modifiable (RLS).
    expect(await update("lecteurA", id, { status: "signed", signedOn: today() })).toEqual([]);
    expect(
      await pgError(update("analysteA", id, { status: "signed", signedOn: daysAgo(-2) })),
    ).toBe("23514");
    expect(await pgError(update("analysteA", id, { status: "signed", signedOn: daysAgo(3) }))).toBe(
      "23514",
    );
    expect(
      await pgError(update("analysteA", id, { status: "delivered", deliveredOn: today() })),
    ).toBe("23514");
    await update("analysteA", id, { status: "signed", signedOn: today() });
    expect(
      await pgError(
        update("analysteA", id, {
          status: "delivered",
          deliveredOn: today(),
          signedOn: daysAgo(1),
        }),
      ),
    ).toBe("23514");
    expect(
      await pgError(
        update("analysteA", id, { status: "delivered", deliveredOn: today(), financedAmountHt: 5 }),
      ),
    ).toBe("23514");
    await update("adminA", id, { status: "delivered", deliveredOn: today() });
    expect((await statusOf(r)).request).toBe("accepted");
    const [active] = await update("analysteA", id, {
      status: "active",
      activatedOn: today(),
      financedAmountHt: 795_000,
    });
    expect(active).toMatchObject({ status: "active", financedAmountHt: 795_000 });
    expect((await statusOf(r)).request).toBe("financed");
    expect(
      await pgError(
        update("analysteA", id, {
          status: "cancelled",
          cancelSide: "lessor",
          cancelReason: "credit_refused",
        }),
      ),
    ).toBe("23514");
    const events = await asApp(db, as("dirigeant"), (tx) =>
      tx
        .select()
        .from(dealEvents)
        .where(sql`deal_id = ${id}`)
        .orderBy(dealEvents.id),
    );
    expect(events.map((e) => e.toStatus)).toEqual(["accepted", "signed", "delivered", "active"]);
    expect(
      await pgError(
        db.execute(sql`update market.deal_events set to_status = 'x' where deal_id = ${id}`),
      ),
    ).toBe("42501");
    expect(await pgError(db.execute(sql`delete from market.deals where id = ${id}`))).toBe("42501");
  });
});

describe("annulation", () => {
  it("par l'entreprise avant signature : demande rouverte, autres offres de nouveau disponibles", async () => {
    const r = await routedWithOffers();
    const [deal] = await accept("dirigeant", r, r.offerA);
    const id = deal?.id ?? "";
    expect(
      await pgError(
        update("dirigeant", id, {
          status: "cancelled",
          cancelSide: "company",
          cancelReason: "credit_refused",
        }),
      ),
    ).toBe("42501");
    expect(
      await pgError(
        update("dirigeant", id, {
          status: "cancelled",
          cancelSide: "company",
          cancelReason: "other",
          cancelNote: "court",
        }),
      ),
    ).toBe("23514");
    const [cancelled] = await update("dirigeant", id, {
      status: "cancelled",
      cancelSide: "company",
      cancelReason: "financed_elsewhere",
    });
    expect(cancelled).toMatchObject({ status: "cancelled", cancelledBy: user("dirigeant") });
    expect(await statusOf(r)).toEqual({ request: "routed", A: "accepted", B: "submitted" });
    const [second] = await accept("dirigeant", r, r.offerB);
    expect(second?.lessorOrganizationId).toBe(org("bailleurB"));
    expect(await statusOf(r)).toEqual({ request: "accepted", A: "accepted", B: "accepted" });
  });

  it("après signature, seul le bailleur annule, avec un motif de bailleur", async () => {
    const r = await routedWithOffers();
    const [deal] = await accept("dirigeant", r, r.offerA);
    const id = deal?.id ?? "";
    await update("analysteA", id, { status: "signed", signedOn: today() });
    expect(
      await pgError(
        update("dirigeant", id, {
          status: "cancelled",
          cancelSide: "company",
          cancelReason: "project_abandoned",
        }),
      ),
    ).toBe("42501");
    expect(
      await pgError(
        update("analysteA", id, {
          status: "cancelled",
          cancelSide: "lessor",
          cancelReason: "project_abandoned",
        }),
      ),
    ).toBe("42501");
    await update("analysteA", id, {
      status: "cancelled",
      cancelSide: "lessor",
      cancelReason: "credit_refused",
    });
    expect((await statusOf(r)).request).toBe("routed");
  });
});

describe("messagerie", () => {
  async function openThread(who: string, r: Routed, lessor: string) {
    const id = uuidv7();
    await asApp(db, as(who), (tx) =>
      tx.insert(threads).values({ id, requestId: r.requestId, lessorOrganizationId: org(lessor) }),
    );
    return id;
  }
  const send = (who: string, threadId: string, authorOrg: string, authorUser = who) =>
    asApp(db, as(who), (tx) =>
      tx
        .insert(messages)
        .values({
          id: uuidv7(),
          threadId,
          authorUserId: user(authorUser),
          authorOrganizationId: org(authorOrg),
          body: `Message de ${who}`,
        })
        .returning(),
    );
  const readMessages = (who: string, threadId: string) =>
    asApp(db, as(who), (tx) =>
      tx
        .select()
        .from(messages)
        .where(sql`thread_id = ${threadId}`),
    );

  it("un fil par bailleur destinataire, lisible par les deux parties seulement", async () => {
    const r = await routedWithOffers();
    // C n'a pas reçu la demande : aucun fil possible, ni par l'entreprise ni par C.
    expect(await pgError(openThread("dirigeant", r, "bailleurC"))).toBe("42501");
    expect(await pgError(openThread("analysteC", r, "bailleurC"))).toBe("42501");
    // B ne peut pas ouvrir le fil de A.
    expect(await pgError(openThread("analysteB", r, "bailleurA"))).toBe("42501");
    const threadA = await openThread("dirigeant", r, "bailleurA");
    expect(await pgError(openThread("analysteA", r, "bailleurA"))).toBe("23505");

    await send("collaborateur", threadA, "pme");
    await send("analysteA", threadA, "bailleurA");
    expect(await pgError(send("lecteurA", threadA, "bailleurA"))).toBe("42501");
    expect(await pgError(send("analysteA", threadA, "pme"))).toBe("42501");
    expect(await pgError(send("analysteA", threadA, "bailleurA", "adminA"))).toBe("42501");
    expect(await pgError(send("analysteB", threadA, "bailleurB"))).toBe("42501");

    for (const who of ["dirigeant", "collaborateur", "analysteA", "lecteurA", "ops"])
      expect(await readMessages(who, threadA), who).toHaveLength(2);
    for (const who of ["analysteB", "analysteC", "autreDirigeant"])
      expect(await readMessages(who, threadA), who).toHaveLength(0);

    const [thread] = await db
      .select()
      .from(threads)
      .where(sql`id = ${threadA}`);
    expect(thread?.lastMessageAt).not.toBeNull();
    expect(
      await pgError(
        db.execute(sql`update market.messages set body = 'x' where thread_id = ${threadA}`),
      ),
    ).toBe("42501");

    // Accusé de lecture : le sien seulement.
    await asApp(db, as("dirigeant"), (tx) =>
      tx
        .insert(threadReads)
        .values({ threadId: threadA, userId: user("dirigeant"), lastReadAt: new Date() }),
    );
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx
            .insert(threadReads)
            .values({ threadId: threadA, userId: user("collaborateur"), lastReadAt: new Date() }),
        ),
      ),
    ).toBe("42501");
    expect(
      await asApp(db, as("analysteA"), (tx) =>
        tx
          .select()
          .from(threadReads)
          .where(sql`thread_id = ${threadA}`),
      ),
    ).toEqual([]);
  });
});

describe("notifications", () => {
  const push = async (to: string, kind = "offer_received") => {
    const id = uuidv7();
    await asAuth(db, (tx) =>
      tx.insert(notifications).values({
        id,
        userId: user(to),
        kind,
        params: { reference: "LP-TEST" },
        path: "/entreprise",
      }),
    );
    return id;
  };

  it("écrites par le serveur, lues et marquées lues par leur seul destinataire", async () => {
    const id = await push("dirigeant");
    expect(await pgError(push("dirigeant", "inconnu"))).toBe("23514");
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx.insert(notifications).values({
            id: uuidv7(),
            userId: user("dirigeant"),
            kind: "offer_received",
            params: {},
            path: "/",
          }),
        ),
      ),
    ).toBe("42501");
    const mine = (who: string) =>
      asApp(db, as(who), (tx) =>
        tx
          .select()
          .from(notifications)
          .where(sql`id = ${id}`),
      );
    expect(await mine("dirigeant")).toHaveLength(1);
    expect(await mine("collaborateur")).toHaveLength(0);
    await asApp(db, as("dirigeant"), (tx) =>
      tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(sql`id = ${id}`),
    );
    expect((await mine("dirigeant"))[0]?.readAt).not.toBeNull();
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx
            .update(notifications)
            .set({ kind: "deal_signed" })
            .where(sql`id = ${id}`),
        ),
      ),
    ).toBe("42501");
  });

  it("préférences : les siennes, mobile marocain exigé pour SMS et WhatsApp", async () => {
    const save = (who: string, values: Partial<typeof notificationPreferences.$inferInsert>) =>
      asApp(db, as(who), (tx) =>
        tx
          .insert(notificationPreferences)
          .values({ userId: user(who), ...values })
          .onConflictDoUpdate({ target: notificationPreferences.userId, set: values }),
      );
    expect(await pgError(save("analysteA", { sms: true }))).toBe("23514");
    expect(await pgError(save("analysteA", { phone: "0612345678" }))).toBe("23514");
    await save("analysteA", { sms: true, phone: "+212612345678" });
    expect(
      await pgError(
        asApp(db, as("analysteB"), (tx) =>
          tx.insert(notificationPreferences).values({ userId: user("analysteA"), email: false }),
        ),
      ),
    ).toBe("42501");
    expect(
      await asApp(db, as("analysteB"), (tx) =>
        tx
          .select()
          .from(notificationPreferences)
          .where(sql`user_id = ${user("analysteA")}`),
      ),
    ).toEqual([]);
  });
});

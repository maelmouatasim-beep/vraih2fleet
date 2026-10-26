import fc from "fast-check";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COMMISSION_CANCEL_REASONS,
  COMMISSION_STATUSES,
  DEFAULT_COMMISSION_GRID,
  MANDATE_STATUSES,
  commissionMachine,
  computeCommission,
  gridIssues,
  mandateMachine,
} from "@leaseplace/domain";
import { commissions, deals, invoices, mandates } from "../schema";
import { asApp, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;
const org = (key: string) => f.orgs[key] ?? "";
const user = (key: string) => f.users[key] ?? "";
const as = (key: string) => ({ userId: f.users[key] ?? null });
const grid = JSON.stringify(DEFAULT_COMMISSION_GRID);
const today = () => new Date(new Date().toISOString().slice(0, 10));

beforeAll(async () => {
  f = await createFixture(db, {
    pme: { type: "company", members: { dirigeant: "company_owner" } },
    bailleurA: {
      type: "lessor",
      members: { adminA: "lessor_admin", analysteA: "lessor_analyst" },
    },
    bailleurB: { type: "lessor", members: { adminB: "lessor_admin" } },
    plateforme: { type: "platform", members: { admin: "platform_admin", ops: "platform_ops" } },
  });
});

afterAll(async () => {
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      const reqs = sql`(select id from credit.financing_requests where organization_id = ${org("pme")})`;
      await tx.execute(sql`delete from billing.commissions where request_id in ${reqs}`);
      await tx.execute(
        sql`delete from billing.invoices where lessor_organization_id in (${org("bailleurA")}, ${org("bailleurB")})`,
      );
      await tx.execute(
        sql`delete from market.deal_events where deal_id in (select id from market.deals where request_id in ${reqs})`,
      );
      await tx.execute(sql`delete from market.deals where request_id in ${reqs}`);
      await tx.execute(sql`delete from market.offers where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.routing_targets where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.routing_decisions where request_id in ${reqs}`);
      await tx.execute(sql`delete from credit.request_events where request_id in ${reqs}`);
      await tx.execute(
        sql`delete from credit.financing_requests where organization_id = ${org("pme")}`,
      );
      await tx.execute(
        sql`delete from billing.mandates where lessor_organization_id in (${org("bailleurA")}, ${org("bailleurB")})`,
      );
    })
    .catch(() => undefined);
  await f.cleanup().catch(() => undefined);
  await close();
});

const newMandate = (
  who: string,
  lessor: string,
  values: Partial<typeof mandates.$inferInsert> = {},
) =>
  asApp(db, as(who), (tx) =>
    tx
      .insert(mandates)
      .values({
        id: uuidv7(),
        lessorOrganizationId: org(lessor),
        grid: DEFAULT_COMMISSION_GRID,
        createdBy: user(who),
        ...values,
      })
      .returning(),
  );
const updateMandate = (who: string, id: string, set: Partial<typeof mandates.$inferInsert>) =>
  asApp(db, as(who), (tx) =>
    tx
      .update(mandates)
      .set(set)
      .where(sql`id = ${id}`)
      .returning(),
  );

/** Opération livrée chez le bailleur A (créée par le propriétaire, triggers désactivés). */
async function deliveredDeal(amount: number) {
  const requestId = uuidv7();
  const decisionId = uuidv7();
  const targetId = uuidv7();
  const offerId = uuidv7();
  const dealId = uuidv7();
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.execute(sql`insert into credit.financing_requests (id, reference, organization_id, created_by, status, amount_ht)
      values (${requestId}, credit.next_request_reference(), ${org("pme")}, ${user("dirigeant")}, 'accepted', ${amount})`);
    await tx.execute(sql`insert into credit.routing_decisions (id, request_id, grade, max_targets, profile, appetites, created_by)
      values (${decisionId}, ${requestId}, 'B', 4, '{}', '[]', ${user("ops")})`);
    await tx.execute(sql`insert into credit.routing_targets (id, decision_id, request_id, lessor_organization_id, status, exclusions, proposed)
      values (${targetId}, ${decisionId}, ${requestId}, ${org("bailleurA")}, 'offered', '[]', true)`);
    await tx.execute(sql`insert into market.offers (id, target_id, request_id, lessor_organization_id, status, financed_amount_ht,
        duration_months, periodicity, timing, annual_rate, first_rent_ht, rent_ht, residual_value_ht, file_fees_ht,
        insurance_per_period_ht, insurance_required, vat_rate, financing_cost_ht, paid_ttc, effective_rate, valid_until, submitted_by)
      values (${offerId}, ${targetId}, ${requestId}, ${org("bailleurA")}, 'accepted', ${amount}, 60, 'monthly', 'advance',
        0.085, 0, 1, 0, 0, 0, false, 0.2, 1, 1, 0.09, now() + interval '30 days', ${user("analysteA")})`);
    await tx.execute(sql`insert into market.deals (id, request_id, offer_id, company_organization_id, lessor_organization_id,
        status, financed_amount_ht, accepted_at, accepted_by, signed_on, delivered_on)
      values (${dealId}, ${requestId}, ${offerId}, ${org("pme")}, ${org("bailleurA")}, 'delivered', ${amount},
        now() - interval '10 days', ${user("dirigeant")}, now()::date - 8, now()::date - 2)`);
  });
  return { requestId, dealId };
}

/** Le mandat de A est en vigueur depuis 60 jours (avant toute acceptation des tests). */
const backdateMandate = () =>
  db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.execute(
      sql`update billing.mandates set activated_at = now() - interval '60 days' where lessor_organization_id = ${org("bailleurA")}`,
    );
  });

const activate = (dealId: string, amount?: number) =>
  asApp(db, as("analysteA"), (tx) =>
    tx
      .update(deals)
      .set({
        status: "active",
        activatedOn: today(),
        ...(amount ? { financedAmountHt: amount } : {}),
      })
      .where(sql`id = ${dealId}`),
  );

describe("listes, transitions et calcul : domaine ≡ SQL", () => {
  async function values(constraint: string) {
    const [row] = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${constraint}`,
    );
    return new Set([...(row?.def ?? "").matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]));
  }
  it.each([
    ["mandates_status_check", MANDATE_STATUSES],
    ["commissions_status_check", COMMISSION_STATUSES],
    ["commissions_cancel_reason_check", COMMISSION_CANCEL_REASONS],
  ] as const)("%s", async (name, list) => {
    expect(await values(name)).toEqual(new Set(list));
  });

  it.each([
    ["guard_mandate", mandateMachine],
    ["guard_commission", commissionMachine],
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

  it("commission calculée par la base ≡ computeCommission (montants tirés au hasard)", async () => {
    const amounts = fc
      .sample(fc.integer({ min: 1, max: 60_000_000 }), 200)
      .concat([500_000, 1_000_000, 1_150_000, 6_000_000]);
    const rows = await db.execute<{ amount: string; commission: string }>(sql`
      select a::text as amount, billing.commission_amount(a, ${grid}::jsonb)::text as commission
      from unnest(${`{${amounts.join(",")}}`}::numeric[]) as a`);
    for (const r of rows)
      expect(Number(r.commission), r.amount).toBe(
        computeCommission(Number(r.amount), DEFAULT_COMMISSION_GRID).amountHt,
      );
  });

  it("validité d'une grille ≡ gridIssues", async () => {
    const grids = [
      DEFAULT_COMMISSION_GRID,
      [{ from: 0, rate: 0.01 }],
      [{ from: 100, rate: 0.01 }],
      [
        { from: 0, rate: 0.01 },
        { from: 0, rate: 0.01 },
      ],
      [
        { from: 0, rate: 0.01 },
        { from: 10, rate: 0.02 },
      ],
      [{ from: 0, rate: 0.2 }],
      [],
    ];
    for (const g of grids) {
      const [row] = await db.execute<{ ok: boolean }>(
        sql`select billing.valid_grid(${JSON.stringify(g)}::jsonb) as ok`,
      );
      expect(row?.ok, JSON.stringify(g)).toBe(gridIssues(g).length === 0);
    }
  });
});

describe("mandats", () => {
  it("l'administration de la plateforme seule les gère ; le bailleur lit le sien", async () => {
    expect(await pgError(newMandate("ops", "bailleurA"))).toBe("42501");
    expect(await pgError(newMandate("adminA", "bailleurA"))).toBe("42501");
    const [m] = await newMandate("admin", "bailleurA", { contractVersion: "MANDAT-2026-01" });
    const id = m?.id ?? "";
    expect(m?.status).toBe("draft");
    // Activation : signature requise, puis contenu figé.
    expect(await pgError(updateMandate("admin", id, { status: "active" }))).toBe("23514");
    await updateMandate("admin", id, { signedOn: today() });
    const [active] = await updateMandate("admin", id, { status: "active" });
    expect(active?.activatedAt).not.toBeNull();
    expect(await pgError(updateMandate("admin", id, { grid: [{ from: 0, rate: 0.01 }] }))).toBe(
      "23514",
    );
    await updateMandate("admin", id, { note: "Contrat original archivé." });
    // Un seul mandat actif par bailleur.
    const [second] = await newMandate("admin", "bailleurA", {
      contractVersion: "V2",
      signedOn: today(),
    });
    expect(await pgError(updateMandate("admin", second?.id ?? "", { status: "active" }))).toBe(
      "23505",
    );
    // Lecture cloisonnée.
    const read = (who: string) =>
      asApp(db, as(who), (tx) =>
        tx
          .select()
          .from(mandates)
          .where(sql`id = ${id}`),
      );
    expect(await read("analysteA")).toHaveLength(1);
    expect(await read("adminB")).toHaveLength(0);
    expect(await read("dirigeant")).toHaveLength(0);
    // Suspension, reprise, fin ; jamais supprimé.
    await updateMandate("admin", id, { status: "suspended" });
    await updateMandate("admin", id, { status: "active" });
    expect(await pgError(db.execute(sql`delete from billing.mandates where id = ${id}`))).toBe(
      "42501",
    );
    expect(
      await pgError(newMandate("admin", "bailleurB", { grid: [{ from: 0, rate: 0.5 }] })),
    ).toBe("23514");
  });
});

describe("commission à la mise en loyer, facture, paiement", () => {
  it("calculée selon le mandat, lisible par l'administrateur du bailleur, facturée puis payée", async () => {
    await backdateMandate();
    const { dealId } = await deliveredDeal(1_000_000);
    await activate(dealId, 1_150_000);
    const [c] = await db
      .select()
      .from(commissions)
      .where(sql`deal_id = ${dealId}`);
    expect(c).toMatchObject({
      status: "due",
      financedAmountHt: 1_150_000,
      amountHt: 14_850,
      vat: 2_970,
      amountTtc: 17_820,
    });
    const read = (who: string) =>
      asApp(db, as(who), (tx) =>
        tx
          .select()
          .from(commissions)
          .where(sql`id = ${c?.id ?? ""}`),
      );
    for (const who of ["adminA", "admin", "ops"]) expect(await read(who), who).toHaveLength(1);
    for (const who of ["analysteA", "adminB", "dirigeant"])
      expect(await read(who), who).toHaveLength(0);

    const issue = (who: string, amountHt: number) =>
      asApp(db, as(who), async (tx) => {
        const id = uuidv7();
        await tx.insert(invoices).values({
          id,
          number: "provisoire",
          lessorOrganizationId: org("bailleurA"),
          issuedOn: today(),
          dueOn: new Date(today().getTime() + 30 * 86_400_000),
          amountHt,
          vatRate: 0.2,
          vat: Math.round(amountHt * 20) / 100,
          amountTtc: Math.round(amountHt * 120) / 100,
          createdBy: user(who),
        });
        await tx
          .update(commissions)
          .set({ status: "invoiced", invoiceId: id })
          .where(sql`id = ${c?.id ?? ""}`);
        return id;
      });
    expect(await pgError(issue("ops", 14_850))).toBe("42501");
    expect(await pgError(issue("admin", 14_000))).toBe("23514");
    const invoiceId = await issue("admin", 14_850);
    const [inv] = await db
      .select()
      .from(invoices)
      .where(sql`id = ${invoiceId}`);
    expect(inv?.number).toMatch(/^LP-F-\d{4}-\d{6}$/);
    expect(
      await pgError(
        db.execute(sql`update billing.invoices set amount_ht = 1 where id = ${invoiceId}`),
      ),
    ).toBe("42501");

    const pay = (set: Partial<typeof commissions.$inferInsert>) =>
      asApp(db, as("admin"), (tx) =>
        tx
          .update(commissions)
          .set({ status: "paid", ...set })
          .where(sql`id = ${c?.id ?? ""}`),
      );
    expect(await pgError(pay({ paidOn: today() }))).toBe("23514");
    await pay({ paidOn: today(), paymentReference: "VIR-2026-0042" });
    const [paid] = await read("adminA");
    expect(paid?.status).toBe("paid");
    expect(
      await pgError(
        asApp(db, as("admin"), (tx) =>
          tx
            .update(commissions)
            .set({ status: "cancelled", cancelReason: "billing_error" })
            .where(sql`id = ${c?.id ?? ""}`),
        ),
      ),
    ).toBe("23514");
  });

  it("sans mandat en vigueur à l'acceptation, la mise en loyer est refusée", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.execute(
        sql`update billing.mandates set activated_at = now() where lessor_organization_id = ${org("bailleurA")}`,
      );
    });
    const { dealId } = await deliveredDeal(300_000);
    expect(await pgError(activate(dealId))).toBe("23514");
  });

  it("avoir motivé sur une commission due", async () => {
    await backdateMandate();
    const { dealId } = await deliveredDeal(300_000);
    await activate(dealId);
    const cancel = (set: Partial<typeof commissions.$inferInsert>) =>
      asApp(db, as("admin"), (tx) =>
        tx
          .update(commissions)
          .set({ status: "cancelled", ...set })
          .where(sql`deal_id = ${dealId}`)
          .returning(),
      );
    expect(await pgError(cancel({ cancelReason: "other", cancelNote: "court" }))).toBe("23514");
    const [c] = await cancel({ cancelReason: "deal_unwound" });
    expect(c).toMatchObject({ status: "cancelled", amountHt: 4_500 });
  });
});

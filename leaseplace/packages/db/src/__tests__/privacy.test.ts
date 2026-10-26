import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ERASURE_REJECT_REASONS,
  PRIVACY_REQUEST_STATUSES,
  RETENTION_KEYS,
  RETENTION_RULES,
  privacyRequestMachine,
} from "@leaseplace/domain";
import { withActor } from "../context";
import { impersonations, notifications, privacyRequests, retentionSettings } from "../schema";
import { asApp, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;
const org = (key: string) => f.orgs[key] ?? "";
const user = (key: string) => f.users[key] ?? "";
const as = (key: string) => ({ userId: f.users[key] ?? null });
const allOrgs = () =>
  sql.join(
    Object.values(f.orgs).map((id) => sql`${id}`),
    sql`, `,
  );
const allUsers = () =>
  sql.join(
    Object.values(f.users).map((id) => sql`${id}`),
    sql`, `,
  );

beforeAll(async () => {
  f = await createFixture(db, {
    pme: { type: "company", members: { dirigeant: "company_owner", employe: "company_member" } },
    pme2: { type: "company", members: { dirigeant2: "company_owner" } },
    bailleur: { type: "lessor", members: { analyste: "lessor_analyst" } },
    plateforme: {
      type: "platform",
      members: { admin: "platform_admin", ops: "platform_ops", support: "platform_support" },
    },
  });
});

afterAll(async () => {
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.execute(
        sql`delete from privacy.impersonations where actor_user_id in (${allUsers()})`,
      );
      await tx.execute(sql`delete from privacy.requests where organization_id in (${allOrgs()})`);
      await tx.execute(sql`delete from privacy.retention_settings`);
      await tx.execute(
        sql`delete from kyc.document_extractions where document_id in (select id from kyc.documents where organization_id in (${allOrgs()}))`,
      );
      await tx.execute(sql`delete from kyc.consents where organization_id in (${allOrgs()})`);
      await tx.execute(
        sql`delete from credit.financing_requests where organization_id in (${allOrgs()})`,
      );
      await tx.execute(sql`delete from kyc.documents where organization_id in (${allOrgs()})`);
      await tx.execute(sql`delete from identity.sessions where user_id in (${allUsers()})`);
    })
    .catch(() => undefined);
  await f.cleanup().catch(() => undefined);
  await close();
});

/** Données posées par le propriétaire (triggers désactivés). */
const asOwner = (
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<unknown>,
) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await fn(tx);
  });

async function addDocument(orgKey: string, uploader: string, deletedDaysAgo?: number) {
  const id = uuidv7();
  await asOwner((tx) =>
    tx.execute(sql`insert into kyc.documents (id, organization_id, type, status, original_name, mime_type,
        size_bytes, sha256, storage_key, uploaded_by, deleted_at)
      values (${id}, ${org(orgKey)}, 'quote', 'clean', 'cin-dirigeant.pdf', 'application/pdf', 10,
        ${createHash("sha256").update(id).digest("hex")}, ${`${org(orgKey)}/${id}`}, ${user(uploader)},
        ${deletedDaysAgo === undefined ? null : sql`now() - make_interval(days => ${deletedDaysAgo})`})`),
  );
  return id;
}

async function addExtraction(documentId: string) {
  await asOwner((tx) =>
    tx.execute(sql`insert into kyc.document_extractions (id, document_id, organization_id, prompt_version,
        readable, fields, sources, warnings)
      values (${uuidv7()}, ${documentId}, (select organization_id from kyc.documents where id = ${documentId}),
        'test', true, '{}', '{}', '[]')`),
  );
}

async function addRequest(orgKey: string, status: string, updatedDaysAgo = 0, submitted = true) {
  const id = uuidv7();
  await asOwner((tx) =>
    tx.execute(sql`insert into credit.financing_requests (id, reference, organization_id, created_by, status, amount_ht,
        submitted_at, updated_at)
      values (${id}, credit.next_request_reference(), ${org(orgKey)}, ${user(orgKey === "pme" ? "dirigeant" : "dirigeant2")},
        ${status}, 100000, ${submitted ? sql`now()` : null}, now() - make_interval(days => ${updatedDaysAgo}))`),
  );
  return id;
}

const request = (who: string, orgKey: string) =>
  asApp(db, as(who), (tx) =>
    tx
      .insert(privacyRequests)
      .values({
        id: uuidv7(),
        organizationId: org(orgKey),
        requestedBy: user(who),
        dueOn: new Date("2000-01-01"),
      })
      .returning(),
  );

const setStatus = (who: string, id: string, set: Partial<typeof privacyRequests.$inferInsert>) =>
  asApp(db, as(who), (tx) =>
    tx
      .update(privacyRequests)
      .set(set)
      .where(sql`id = ${id}`)
      .returning(),
  );

const erase = (who: string, requestId: string) =>
  asApp(db, as(who), (tx) =>
    tx.execute<{ r: { summary: Record<string, number>; storage: { id: string; key: string }[] } }>(
      sql`select privacy.erase_organization(${requestId}) as r`,
    ),
  );

describe("listes et transitions : domaine ≡ SQL", () => {
  async function values(constraint: string) {
    const [row] = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${constraint}`,
    );
    return new Set([...(row?.def ?? "").matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]));
  }
  it.each([
    ["privacy_requests_status_check", PRIVACY_REQUEST_STATUSES],
    ["privacy_requests_reject_reason_check", ERASURE_REJECT_REASONS],
    ["retention_settings_key_check", RETENTION_KEYS],
  ] as const)("%s", async (name, list) => {
    expect(await values(name)).toEqual(new Set(list));
  });

  it("guard_request ≡ privacyRequestMachine", async () => {
    const [row] = await db.execute<{ src: string }>(
      sql`select prosrc as src from pg_proc where proname = 'guard_request'`,
    );
    const pairs = [...(row?.src ?? "").matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(pairs).toEqual(privacyRequestMachine.edges().map(([a, b]) => [a, b]));
  });

  it("règles de conservation SQL ≡ RETENTION_RULES", async () => {
    for (const key of RETENTION_KEYS) {
      const [row] = await db.execute<{ d: number; mn: number; mx: number }>(
        sql`select default_days as d, min_days as mn, max_days as mx from privacy.retention_rule(${key})`,
      );
      const rule = RETENTION_RULES[key];
      expect(row).toEqual({ d: rule.defaultDays, mn: rule.minDays, mx: rule.maxDays });
    }
  });
});

describe("demande d'effacement", () => {
  it("déposée par le titulaire seulement ; échéance posée par la base", async () => {
    expect(await pgError(request("employe", "pme"))).toBe("42501");
    expect(await pgError(request("analyste", "pme"))).toBe("42501");
    const [r] = await request("dirigeant2", "pme2");
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    expect(r?.status).toBe("pending");
    expect(r?.dueOn.toISOString().slice(0, 10)).toBe(due);
    // Une seule demande en attente par entreprise.
    expect(await pgError(request("dirigeant2", "pme2"))).toBe("23505");
    // Lisible par le titulaire et l'administrateur, pas par un tiers.
    const seen = (who: string) =>
      asApp(db, as(who), (tx) =>
        tx
          .select()
          .from(privacyRequests)
          .where(sql`id = ${r?.id ?? ""}`),
      );
    expect(await seen("admin")).toHaveLength(1);
    expect(await seen("dirigeant")).toHaveLength(0);
    expect(await seen("ops")).toHaveLength(0);
  });

  it("retrait par le titulaire, refus motivé par l'administrateur, exécution par la fonction seule", async () => {
    const [r] = await asApp(db, as("dirigeant2"), (tx) =>
      tx
        .select()
        .from(privacyRequests)
        .where(sql`organization_id = ${org("pme2")}`),
    );
    const id = r?.id ?? "";
    expect(await pgError(setStatus("admin", id, { status: "completed" }))).toBe("42501");
    expect(await pgError(setStatus("dirigeant2", id, { note: "autre texte" }))).toBe("42501");
    expect(
      await pgError(
        setStatus("dirigeant2", id, { status: "rejected", rejectReason: "legal_hold" }),
      ),
    ).toBe("42501");
    expect(
      await pgError(setStatus("admin", id, { status: "rejected", rejectReason: "other" })),
    ).toBe("23514");
    const [rejected] = await setStatus("admin", id, {
      status: "rejected",
      rejectReason: "identity_unverified",
    });
    expect(rejected?.decidedBy).toBe(user("admin"));
    expect(await pgError(setStatus("dirigeant2", id, { status: "cancelled" }))).toBe("23514");
    expect(
      await pgError(
        asApp(db, as("admin"), (tx) => tx.delete(privacyRequests).where(sql`id = ${id}`)),
      ),
    ).toBe("42501");
    const [again] = await request("dirigeant2", "pme2");
    const [cancelled] = await setStatus("dirigeant2", again?.id ?? "", { status: "cancelled" });
    expect(cancelled?.status).toBe("cancelled");
  });

  it("bloquée tant qu'un dossier est en cours ; réservée aux administrateurs", async () => {
    const live = await addRequest("pme", "routed");
    const [r] = await request("dirigeant", "pme");
    expect(await pgError(erase("ops", r?.id ?? ""))).toBe("42501");
    expect(await pgError(erase("admin", r?.id ?? ""))).toBe("23514");
    await asOwner((tx) =>
      tx.execute(sql`update credit.financing_requests set status = 'cancelled' where id = ${live}`),
    );
  });

  it("efface comptes, pièces et extractions ; conserve demandes et journal", async () => {
    const doc = await addDocument("pme", "dirigeant");
    await addExtraction(doc);
    await asOwner(async (tx) => {
      await tx.execute(sql`insert into identity.sessions (id, token, user_id, expires_at)
        values (${uuidv7()}, ${uuidv7()}, ${user("employe")}, now() + interval '1 day')`);
      await tx.insert(notifications).values({
        id: uuidv7(),
        userId: user("dirigeant"),
        kind: "offer_received",
        params: {},
        path: "/entreprise",
      });
    });
    const [r] = await asApp(db, as("dirigeant"), (tx) =>
      tx
        .select()
        .from(privacyRequests)
        .where(sql`organization_id = ${org("pme")}`),
    );
    const [out] = await erase("admin", r?.id ?? "");
    expect(out?.r.summary).toMatchObject({
      users: 2,
      memberships: 2,
      documents: 1,
      extractions: 1,
    });
    expect(out?.r.storage).toEqual([{ id: doc, key: `${org("pme")}/${doc}` }]);

    const [u] = await db.execute<{ name: string; email: string }>(
      sql`select name, email from identity.users where id = ${user("dirigeant")}`,
    );
    expect(u).toEqual({
      name: "Compte effacé",
      email: `efface-${user("dirigeant")}@leaseplace.invalid`,
    });
    const count = async (q: ReturnType<typeof sql>) =>
      Number((await db.execute<{ n: string }>(q))[0]?.n ?? 0);
    expect(
      await count(
        sql`select count(*) as n from identity.sessions where user_id = ${user("employe")}`,
      ),
    ).toBe(0);
    expect(
      await count(
        sql`select count(*) as n from identity.memberships where organization_id = ${org("pme")}`,
      ),
    ).toBe(0);
    expect(
      await count(
        sql`select count(*) as n from kyc.document_extractions where document_id = ${doc}`,
      ),
    ).toBe(0);
    const [d] = await db.execute<{ name: string; deleted: boolean }>(
      sql`select original_name as name, deleted_at is not null as deleted from kyc.documents where id = ${doc}`,
    );
    expect(d).toEqual({ name: "piece-effacee", deleted: true });
    // Les demandes restent (obligation de preuve), le journal trace l'effacement.
    expect(
      await count(
        sql`select count(*) as n from credit.financing_requests where organization_id = ${org("pme")}`,
      ),
    ).toBe(1);
    expect(
      await count(sql`select count(*) as n from audit.events where action = 'privacy.erasure_completed'
        and entity_id = ${org("pme")}`),
    ).toBe(1);
    const [done] = await db.execute<{ status: string }>(
      sql`select status from privacy.requests where id = ${r?.id ?? ""}`,
    );
    expect(done?.status).toBe("completed");

    // Fichier supprimé du stockage par l'application : purge marquée par un administrateur.
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) =>
          tx.execute(sql`select privacy.mark_purged(array[${doc}]::uuid[])`),
        ),
      ),
    ).toBe("42501");
    const [m] = await asApp(db, as("admin"), (tx) =>
      tx.execute<{ n: number }>(sql`select privacy.mark_purged(array[${doc}]::uuid[]) as n`),
    );
    expect(m?.n).toBe(1);
  });

  it("le mode effacement ne s'ouvre pas depuis l'application", async () => {
    const doc = await addDocument("pme2", "dirigeant2");
    await addExtraction(doc);
    const forged = (q: ReturnType<typeof sql>) =>
      asApp(db, as("admin"), async (tx) => {
        await tx.execute(sql`select set_config('app.erasure', 'on', true)`);
        return tx.execute(q);
      });
    expect(
      await pgError(forged(sql`delete from kyc.document_extractions where document_id = ${doc}`)),
    ).toBe("42501");
    expect(
      await pgError(forged(sql`update kyc.documents set original_name = 'x' where id = ${doc}`)),
    ).toBe("42501");
    expect(await pgError(forged(sql`select privacy.apply_retention()`))).toBe("42501");
  });
});

describe("conservation", () => {
  it("réglage par un administrateur, dans les bornes", async () => {
    const set = (who: string, key: string, days: number) =>
      asApp(db, as(who), (tx) =>
        tx.insert(retentionSettings).values({ key, days, updatedBy: user(who) }),
      );
    expect(await pgError(set("ops", "outbox_messages", 10))).toBe("42501");
    expect(await pgError(set("admin", "outbox_messages", 0))).toBe("23514");
    expect(await pgError(set("admin", "audit", 10))).toBe("23514");
    await set("admin", "draft_requests", 30);
    const rows = await asApp(db, as("ops"), (tx) => tx.select().from(retentionSettings));
    expect(rows.map((r) => [r.key, r.days])).toEqual([["draft_requests", 30]]);
  });

  it("purge : brouillons, notifications lues, pièces supprimées ; le reste est gardé", async () => {
    const oldDraft = await addRequest("pme2", "draft", 40, false);
    const recentDraft = await addRequest("pme2", "draft", 5, false);
    const oldCancelled = await addRequest("pme2", "cancelled", 400);
    // Brouillon avec un consentement déjà donné : supprimé avec lui.
    await asOwner((tx) =>
      tx.execute(sql`insert into kyc.consents (id, organization_id, request_id, purpose, legal_text_id, granted_by)
        values (${uuidv7()}, ${org("pme2")}, ${oldDraft}, 'processing',
          (select id from kyc.legal_texts where kind = 'consent_processing' limit 1), ${user("dirigeant2")})`),
    );
    const oldRead = uuidv7();
    const unread = uuidv7();
    await asOwner((tx) =>
      tx.insert(notifications).values([
        {
          id: oldRead,
          userId: user("dirigeant2"),
          kind: "offer_received",
          params: {},
          path: "/entreprise",
          readAt: new Date(Date.now() - 200 * 86_400_000),
        },
        {
          id: unread,
          userId: user("dirigeant2"),
          kind: "offer_received",
          params: {},
          path: "/entreprise",
          createdAt: new Date(Date.now() - 400 * 86_400_000),
        },
      ]),
    );
    const oldDeleted = await addDocument("pme2", "dirigeant2", 45);
    const recentDeleted = await addDocument("pme2", "dirigeant2", 2);

    expect(
      await pgError(
        asApp(db, as("ops"), (tx) => tx.execute(sql`select privacy.apply_retention_as_admin()`)),
      ),
    ).toBe("42501");
    const [res] = await asApp(db, as("admin"), (tx) =>
      tx.execute<{ r: { drafts: number; storage: { id: string }[] } }>(
        sql`select privacy.apply_retention_as_admin() as r`,
      ),
    );
    expect(res?.r.drafts).toBeGreaterThanOrEqual(1);
    const ids = res?.r.storage.map((s) => s.id) ?? [];
    expect(ids).toContain(oldDeleted);
    expect(ids).not.toContain(recentDeleted);

    const exists = async (table: ReturnType<typeof sql>, id: string) =>
      (await db.execute(sql`select 1 from ${table} where id = ${id}`)).length === 1;
    expect(await exists(sql`credit.financing_requests`, oldDraft)).toBe(false);
    expect(await exists(sql`credit.financing_requests`, recentDraft)).toBe(true);
    expect(await exists(sql`credit.financing_requests`, oldCancelled)).toBe(true);
    expect(await exists(sql`identity.notifications`, oldRead)).toBe(false);
    expect(await exists(sql`identity.notifications`, unread)).toBe(true);
    const [audit] = await db.execute<{ n: string }>(
      sql`select count(*) as n from audit.events where action = 'retention.applied'`,
    );
    expect(Number(audit?.n)).toBeGreaterThanOrEqual(1);
  });

  it("droit d'accès : seules les actions de l'utilisateur", async () => {
    const rows = await asApp(db, as("admin"), (tx) =>
      tx.execute<{ action: string }>(sql`select action from privacy.my_audit_events()`),
    );
    expect(rows.map((r) => r.action)).toContain("retention.applied");
    const none = await asApp(db, as("dirigeant2"), (tx) =>
      tx.execute<{ action: string }>(
        sql`select action from privacy.my_audit_events() where action = 'retention.applied'`,
      ),
    );
    expect(none).toHaveLength(0);
  });
});

describe("accès support", () => {
  const sessionOf = async (who: string) => {
    const id = uuidv7();
    await asOwner((tx) =>
      tx.execute(sql`insert into identity.sessions (id, token, user_id, expires_at)
        values (${id}, ${uuidv7()}, ${user(who)}, now() + interval '1 day')`),
    );
    return id;
  };
  const start = (who: string, session: string, target: string, targetOrg: string, reason: string) =>
    asApp(db, as(who), (tx) =>
      tx
        .insert(impersonations)
        .values({
          id: uuidv7(),
          actorUserId: user(who),
          actorSessionId: session,
          targetUserId: user(target),
          targetOrganizationId: org(targetOrg),
          reason,
          expiresAt: new Date(Date.now() + 10 * 86_400_000),
        })
        .returning(),
    );
  const reason = "Ticket 42 : le dirigeant ne voit pas ses offres";

  it("réservé au support, motivé, sur sa propre session, jamais vers la plateforme", async () => {
    const s = await sessionOf("support");
    const other = await sessionOf("ops");
    expect(await pgError(start("ops", other, "dirigeant2", "pme2", reason))).toBe("42501");
    expect(await pgError(start("support", other, "dirigeant2", "pme2", reason))).toBe("42501");
    expect(await pgError(start("support", s, "admin", "plateforme", reason))).toBe("42501");
    expect(await pgError(start("support", s, "dirigeant2", "pme", reason))).toBe("42501");
    expect(await pgError(start("support", s, "dirigeant2", "pme2", "court"))).toBe("23514");
    const [row] = await start("support", s, "dirigeant2", "pme2", reason);
    // Durée posée par la base, pas par l'appelant.
    const minutes = ((row?.expiresAt.getTime() ?? 0) - (row?.startedAt.getTime() ?? 0)) / 60_000;
    expect(minutes).toBeCloseTo(30, 5);
    // Un seul accès ouvert par session.
    expect(await pgError(start("support", s, "dirigeant2", "pme2", reason))).toBe("23505");
    const end = (who: string, set: Partial<typeof impersonations.$inferInsert>) =>
      asApp(db, as(who), (tx) =>
        tx
          .update(impersonations)
          .set(set)
          .where(sql`id = ${row?.id ?? ""}`)
          .returning(),
      );
    expect(await pgError(end("support", { reason: `${reason} (modifié)` }))).toBe("42501");
    const [ended] = await end("support", { endedAt: new Date() });
    expect(ended?.endedAt).not.toBeNull();
    expect(await pgError(end("support", { endedAt: new Date() }))).toBe("42501");
    expect(
      await pgError(
        asApp(db, as("support"), (tx) =>
          tx.delete(impersonations).where(sql`id = ${row?.id ?? ""}`),
        ),
      ),
    ).toBe("42501");
  });

  it("pendant l'accès, la base refuse toute écriture", async () => {
    const write = withActor(
      db,
      { userId: user("dirigeant2"), impersonatorId: user("support") },
      async (tx) => {
        await tx.execute(sql`set local role lp_app`);
        return tx.insert(privacyRequests).values({
          id: uuidv7(),
          organizationId: org("pme2"),
          requestedBy: user("dirigeant2"),
          dueOn: new Date(),
        });
      },
    );
    expect(await pgError(write)).toBe("25006");
    const read = await withActor(
      db,
      { userId: user("dirigeant2"), impersonatorId: user("support") },
      async (tx) => {
        await tx.execute(sql`set local role lp_app`);
        return tx
          .select()
          .from(privacyRequests)
          .where(sql`organization_id = ${org("pme2")}`);
      },
    );
    expect(read.length).toBeGreaterThan(0);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { memberships, organizations, users } from "../schema";
import { asApp, asAuth, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;

beforeAll(async () => {
  f = await createFixture(db, {
    bailleurA: { type: "lessor", members: { analysteA: "lessor_analyst", adminA: "lessor_admin" } },
    bailleurB: { type: "lessor", members: { analysteB: "lessor_analyst" } },
    pme: { type: "company", members: { dirigeant: "company_owner" } },
    plateforme: { type: "platform", members: { ops: "platform_ops" } },
  });
});
afterAll(async () => {
  await f.cleanup();
  await close();
});

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
const actor = (key: string) => ({ userId: f.users[key] ?? null });

describe("RLS — isolation des organisations", () => {
  it("sans contexte, l'application ne voit rien", async () => {
    const r = await asApp(db, { userId: null }, async (tx) => ({
      orgs: await tx.select().from(organizations),
      users: await tx.select().from(users),
      members: await tx.select().from(memberships),
    }));
    expect(r).toEqual({ orgs: [], users: [], members: [] });
  });

  it("un bailleur A ne voit ni le bailleur B ni la PME", async () => {
    const r = await asApp(db, actor("analysteA"), async (tx) => ({
      orgs: await tx.select().from(organizations),
      users: await tx.select().from(users),
      members: await tx.select().from(memberships),
    }));
    expect(ids(r.orgs)).toEqual([f.orgs.bailleurA]);
    expect(ids(r.users)).toEqual([f.users.adminA, f.users.analysteA].sort());
    expect(new Set(r.members.map((m) => m.organizationId))).toEqual(new Set([f.orgs.bailleurA]));
  });

  it("filtrer explicitement sur le bailleur B ne renvoie rien", async () => {
    const r = await asApp(db, actor("analysteA"), (tx) =>
      tx
        .select()
        .from(organizations)
        .where(sql`id = ${f.orgs.bailleurB}`),
    );
    expect(r).toEqual([]);
  });

  it("une PME ne voit que sa propre organisation", async () => {
    const r = await asApp(db, actor("dirigeant"), (tx) => tx.select().from(organizations));
    expect(ids(r)).toEqual([f.orgs.pme]);
  });

  it("l'équipe plateforme voit toutes les organisations", async () => {
    const r = await asApp(db, actor("ops"), (tx) => tx.select().from(organizations));
    const vus = new Set(r.map((o) => o.id));
    for (const id of Object.values(f.orgs)) expect(vus.has(id)).toBe(true);
  });

  it("un identifiant d'organisation forgé dans le contexte n'ouvre aucun accès", async () => {
    const r = await asApp(
      db,
      { userId: f.users.analysteA ?? null, organizationId: f.orgs.bailleurB ?? null },
      (tx) => tx.select().from(organizations),
    );
    expect(ids(r)).toEqual([f.orgs.bailleurA]);
  });

  it("le contexte ne fuit pas d'une transaction à l'autre (même connexion)", async () => {
    await asApp(db, actor("ops"), (tx) => tx.select().from(organizations));
    const r = await asApp(db, { userId: null }, (tx) => tx.select().from(organizations));
    expect(r).toEqual([]);
  });
});

describe("RLS — privilèges", () => {
  it("l'application ne lit jamais les sessions, comptes, secrets 2FA ni vérifications", async () => {
    for (const table of ["sessions", "accounts", "two_factors", "verifications", "rate_limits"]) {
      const code = await pgError(
        asApp(db, actor("ops"), (tx) => tx.execute(sql.raw(`select * from identity.${table}`))),
      );
      expect(code, table).toBe("42501");
    }
  });

  it("l'application ne peut ni créer ni modifier une organisation ou une adhésion", async () => {
    expect(
      await pgError(
        asApp(db, actor("adminA"), (tx) =>
          tx
            .insert(organizations)
            .values({ id: uuidv7(), name: "x", slug: uuidv7(), type: "lessor" }),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgError(
        asApp(db, actor("adminA"), (tx) =>
          tx
            .update(memberships)
            .set({ role: "lessor_admin" })
            .where(sql`user_id = ${f.users.analysteA}`),
        ),
      ),
    ).toBe("42501");
  });

  it("Better-Auth (lp_auth) n'accède pas au journal d'audit", async () => {
    expect(await pgError(asAuth(db, (tx) => tx.execute(sql`select * from audit.events`)))).toBe(
      "42501",
    );
  });

  it("un rôle étranger au type d'organisation est refusé", async () => {
    const code = await pgError(
      asAuth(db, (tx) =>
        tx.insert(memberships).values({
          id: uuidv7(),
          organizationId: f.orgs.bailleurA ?? "",
          userId: f.users.dirigeant ?? "",
          role: "company_owner",
        }),
      ),
    );
    expect(code).toBe("23514");
  });
});

describe("garde-fous transverses (audit de sécurité, phase 9)", () => {
  const SCHEMAS = sql`('identity', 'audit', 'dev', 'marketing', 'kyc', 'credit', 'market', 'billing', 'privacy')`;

  it("chaque table applicative a la RLS activée", async () => {
    const rows = await db.execute<{ t: string }>(sql`
      select n.nspname || '.' || c.relname as t
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname in ${SCHEMAS} and not c.relrowsecurity`);
    expect(rows.map((r) => r.t)).toEqual([]);
  });

  it("aucun privilège de table accordé à PUBLIC", async () => {
    const rows = await db.execute<{ t: string }>(sql`
      select table_schema || '.' || table_name || ' ' || privilege_type as t
      from information_schema.role_table_grants
      where grantee = 'PUBLIC' and table_schema in ${SCHEMAS}`);
    expect(rows.map((r) => r.t)).toEqual([]);
  });

  it("chaque fonction SECURITY DEFINER fige son search_path", async () => {
    const rows = await db.execute<{ f: string }>(sql`
      select n.nspname || '.' || p.proname as f
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and n.nspname in ${SCHEMAS} or (p.prosecdef and n.nspname = 'app')
      group by 1, p.proconfig
      having not coalesce(bool_or(p.proconfig::text like '%search_path=%'), false)`);
    expect(rows.map((r) => r.f)).toEqual([]);
  });

  it("les rôles applicatifs ne contournent pas la RLS et ne possèdent rien", async () => {
    const roles = await db.execute<{ rolname: string; bypass: boolean; superuser: boolean }>(sql`
      select rolname, rolbypassrls as bypass, rolsuper as superuser
      from pg_roles where rolname in ('lp_app', 'lp_auth') order by rolname`);
    expect(roles).toEqual([
      { rolname: "lp_app", bypass: false, superuser: false },
      { rolname: "lp_auth", bypass: false, superuser: false },
    ]);
    const owned = await db.execute<{ n: string }>(sql`
      select count(*) as n from pg_class c join pg_roles r on r.oid = c.relowner
      where r.rolname in ('lp_app', 'lp_auth')`);
    expect(Number(owned[0]?.n)).toBe(0);
  });
});

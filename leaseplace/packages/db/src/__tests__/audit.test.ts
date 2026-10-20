import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ROLES_BY_ORGANIZATION_TYPE, can } from "@leaseplace/domain";
import { recordAudit } from "../audit";
import { auditEvents } from "../schema";
import { asApp, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;

beforeAll(async () => {
  f = await createFixture(db, {
    bailleur: { type: "lessor", members: { analyste: "lessor_analyst" } },
    plateforme: {
      type: "platform",
      members: { admin: "platform_admin", ops: "platform_ops", support: "platform_support" },
    },
  });
});
afterAll(async () => {
  await f.cleanup();
  await close();
});

describe("journal d'audit", () => {
  it("l'acteur, l'IP et l'agent viennent du contexte, pas de l'appelant", async () => {
    const id = await asApp(
      db,
      {
        userId: f.users.analyste ?? null,
        organizationId: f.orgs.bailleur ?? null,
        ip: "196.200.1.2",
        userAgent: "vitest",
      },
      (tx) =>
        recordAudit(tx, {
          action: "auth.sign_in",
          entityType: "user",
          entityId: f.users.analyste ?? null,
          metadata: { method: "password" },
        }),
    );
    const [row] = await db
      .select()
      .from(auditEvents)
      .where(sql`id = ${id}`);
    expect(row?.actorUserId).toBe(f.users.analyste);
    expect(row?.actorOrganizationId).toBe(f.orgs.bailleur);
    expect(row?.ip).toBe("196.200.1.2");
    expect(row?.userAgent).toBe("vitest");
    expect(row?.metadata).toEqual({ method: "password" });
  });

  it("refuse une action mal nommée", async () => {
    const code = await pgError(
      asApp(db, { userId: f.users.ops ?? null }, (tx) =>
        tx.execute(sql`select audit.record('SignIn', 'user')`),
      ),
    );
    expect(code).toBe("23514");
  });

  it("l'application ne peut pas insérer directement dans le journal", async () => {
    const code = await pgError(
      asApp(db, { userId: f.users.admin ?? null }, (tx) =>
        tx.execute(
          sql`insert into audit.events (occurred_at, action, entity_type, hash) values (now(), 'auth.sign_in', 'user', '\\x00')`,
        ),
      ),
    );
    expect(code).toBe("42501");
  });

  it("lecture réservée aux rôles portant audit.read", async () => {
    await asApp(db, { userId: f.users.ops ?? null }, (tx) =>
      recordAudit(tx, { action: "space.access_denied", entityType: "space", entityId: "admin" }),
    );
    for (const role of ROLES_BY_ORGANIZATION_TYPE.platform) {
      const key = role.replace("platform_", "");
      const rows = await asApp(db, { userId: f.users[key] ?? null }, (tx) =>
        tx.select().from(auditEvents).limit(1),
      );
      expect(rows.length > 0, role).toBe(can(role, "audit.read"));
    }
    const lessor = await asApp(db, { userId: f.users.analyste ?? null }, (tx) =>
      tx.select().from(auditEvents),
    );
    expect(lessor).toEqual([]);
  });

  it("UPDATE, DELETE et TRUNCATE sont refusés, même au propriétaire", async () => {
    expect(await pgError(db.execute(sql`update audit.events set action = 'auth.sign_out'`))).toBe(
      "42501",
    );
    expect(await pgError(db.execute(sql`delete from audit.events`))).toBe("42501");
    expect(await pgError(db.execute(sql`truncate audit.events`))).toBe("42501");
  });

  it("la chaîne de hachage est intacte et détecte une altération", async () => {
    const [ok] = await db.execute<{ broken: string | null }>(
      sql`select audit.verify_chain() as broken`,
    );
    expect(ok?.broken).toBeNull();

    // Altération simulée (trigger désactivé dans la transaction), puis annulée.
    let detecte: string | null | undefined;
    await db
      .transaction(async (tx) => {
        await tx.execute(sql`alter table audit.events disable trigger events_no_update_delete`);
        await tx.execute(
          sql`update audit.events set entity_id = 'falsifié' where id = (select max(id) from audit.events)`,
        );
        const [r] = await tx.execute<{ broken: string | null }>(
          sql`select audit.verify_chain() as broken`,
        );
        const [last] = await tx.execute<{ id: string }>(
          sql`select max(id)::text as id from audit.events`,
        );
        detecte = r?.broken === last?.id ? "derniere-ligne" : (r?.broken ?? null);
        tx.rollback();
      })
      .catch((e: unknown) => {
        if (!(e instanceof Error && e.message.includes("Rollback"))) throw e;
      });
    expect(detecte).toBe("derniere-ligne");
    const [apres] = await db.execute<{ broken: string | null }>(
      sql`select audit.verify_chain() as broken`,
    );
    expect(apres?.broken).toBeNull();
  });
});

describe("vérification de la chaîne par l'application", () => {
  it("autorisée pour platform_admin, refusée à un bailleur", async () => {
    const [r] = await asApp(db, { userId: f.users.admin ?? null }, (tx) =>
      tx.execute<{ broken: string | null }>(sql`select audit.verify_chain() as broken`),
    );
    expect(r?.broken).toBeNull();
    expect(
      await pgError(
        asApp(db, { userId: f.users.analyste ?? null }, (tx) =>
          tx.execute(sql`select audit.verify_chain()`),
        ),
      ),
    ).toBe("42501");
  });
});

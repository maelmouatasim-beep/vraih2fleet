import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { OrganizationType, Role } from "@leaseplace/domain";
import { createDatabase, type Database, type Transaction } from "../client";
import { applyActor, type Actor } from "../context";
import { memberships, organizations, users } from "../schema";

export function testDatabase() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST manquant : lancer `pnpm db:local` puis exporter " +
        "DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/leaseplace_test",
    );
  }
  return createDatabase(url, { max: 1 });
}

/** Exécute `fn` comme l'application : rôle lp_app + contexte d'acteur. */
export function asApp<T>(db: Database, actor: Actor, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role lp_app`);
    await applyActor(tx, actor);
    return fn(tx);
  });
}

export function asAuth<T>(db: Database, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role lp_auth`);
    return fn(tx);
  });
}

/** Attend une erreur Postgres (la transaction est annulée). */
export async function pgError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as { cause?: { code?: string }; code?: string };
    return err.cause?.code ?? err.code ?? "unknown";
  }
  throw new Error("une erreur était attendue");
}

export interface Fixture {
  orgs: Record<string, string>;
  users: Record<string, string>;
  cleanup: () => Promise<void>;
}

/** Organisations et membres créés par le propriétaire (hors RLS). */
export async function createFixture(
  db: Database,
  spec: Record<string, { type: OrganizationType; members: Record<string, Role> }>,
): Promise<Fixture> {
  const tag = uuidv7().slice(-8);
  const orgs: Record<string, string> = {};
  const userIds: Record<string, string> = {};
  for (const [orgKey, { type, members }] of Object.entries(spec)) {
    const orgId = uuidv7();
    orgs[orgKey] = orgId;
    await db
      .insert(organizations)
      .values({ id: orgId, name: orgKey, slug: `${orgKey}-${tag}`, type });
    for (const [userKey, role] of Object.entries(members)) {
      const userId = uuidv7();
      userIds[userKey] = userId;
      await db.insert(users).values({
        id: userId,
        name: userKey,
        email: `${userKey}-${tag}@test.invalid`.toLowerCase(),
      });
      await db.insert(memberships).values({ id: uuidv7(), organizationId: orgId, userId, role });
    }
  }
  return {
    orgs,
    users: userIds,
    cleanup: async () => {
      for (const id of Object.values(userIds)) await db.delete(users).where(sql`id = ${id}`);
      for (const id of Object.values(orgs)) await db.delete(organizations).where(sql`id = ${id}`);
    },
  };
}

/**
 * Jeu de démonstration de la phase 1 : 4 organisations fictives et leurs
 * comptes (src/lib/demo-accounts.ts). Idempotent : ne crée que ce qui
 * manque. Connexion propriétaire (DATABASE_URL_ADMIN).
 *
 * Les secrets TOTP sont chiffrés exactement comme Better-Auth le fait
 * (symmetricEncrypt avec BETTER_AUTH_SECRET) : le seed doit utiliser le
 * même secret que l'application.
 */
import { hashPassword, symmetricEncrypt } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, schema } from "@leaseplace/db";
import { DEMO_ACCOUNTS, DEMO_ORGANIZATIONS, DEMO_PASSWORD } from "../src/lib/demo-accounts";

const { users, accounts, organizations, memberships, twoFactors } = schema;

const url = process.env.DATABASE_URL_ADMIN;
const secret = process.env.BETTER_AUTH_SECRET;
if (!url || !secret) {
  console.error("DATABASE_URL_ADMIN et BETTER_AUTH_SECRET sont requis.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && process.env.LP_DEMO_MODE !== "true") {
  console.error("Refus : jeu de démonstration en production hors LP_DEMO_MODE=true.");
  process.exit(1);
}

const { db, close } = createDatabase(url, { max: 1 });

try {
  const orgIds = new Map<string, string>();
  for (const org of DEMO_ORGANIZATIONS) {
    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, org.slug));
    const id = existing?.id ?? uuidv7();
    if (!existing) {
      await db.insert(organizations).values({ id, name: org.name, slug: org.slug, type: org.type });
    }
    orgIds.set(org.key, id);
  }

  for (const account of DEMO_ACCOUNTS) {
    const [existing] = await db.select().from(users).where(eq(users.email, account.email));
    const userId = existing?.id ?? uuidv7();
    if (!existing) {
      await db.insert(users).values({
        id: userId,
        name: account.name,
        email: account.email,
        emailVerified: true,
        twoFactorEnabled: Boolean(account.totpSecret),
      });
    }

    if (account.password) {
      const [credential] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")));
      if (!credential) {
        await db.insert(accounts).values({
          id: uuidv7(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(DEMO_PASSWORD),
        });
      }
    }

    if (account.totpSecret) {
      const [tf] = await db.select().from(twoFactors).where(eq(twoFactors.userId, userId));
      if (!tf) {
        await db.insert(twoFactors).values({
          id: uuidv7(),
          userId,
          secret: await symmetricEncrypt({ key: secret, data: account.totpSecret }),
          backupCodes: await symmetricEncrypt({ key: secret, data: JSON.stringify([]) }),
          verified: true,
        });
      }
    }

    const organizationId = orgIds.get(account.organization);
    if (!organizationId) throw new Error(`Organisation inconnue : ${account.organization}`);
    const [member] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)));
    if (!member) {
      await db
        .insert(memberships)
        .values({ id: uuidv7(), organizationId, userId, role: account.role });
    }
  }
  console.warn(`Jeu de démonstration prêt : ${String(DEMO_ACCOUNTS.length)} comptes.`);
} finally {
  await close();
}

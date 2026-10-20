/**
 * Avant les tests : remet à zéro la limitation de débit et la boîte
 * d'envoi, et recrée un compte bailleur SANS 2FA pour tester l'enrôlement.
 * Base locale ou de CI uniquement (DATABASE_URL_ADMIN).
 */
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, schema } from "@leaseplace/db";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";
import { ENROLMENT_EMAIL } from "./fixtures";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) throw new Error("DATABASE_URL_ADMIN requis pour les tests e2e");
  if (!/localhost|127\.0\.0\.1/.test(url))
    throw new Error("Refus : e2e uniquement contre une base locale");
  const { db, close } = createDatabase(url, { max: 1 });
  try {
    await db.delete(schema.rateLimits);
    await db.delete(schema.outbox);
    await db.delete(schema.users).where(eq(schema.users.email, ENROLMENT_EMAIL));
    const [lessor] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, "cedre-leasing"));
    if (!lessor) throw new Error("Jeu de démonstration absent : pnpm db:seed");
    const userId = uuidv7();
    await db
      .insert(schema.users)
      .values({ id: userId, name: "Omar Nouveau", email: ENROLMENT_EMAIL, emailVerified: true });
    await db.insert(schema.accounts).values({
      id: uuidv7(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: await hashPassword(DEMO_PASSWORD),
    });
    await db
      .insert(schema.memberships)
      .values({ id: uuidv7(), organizationId: lessor.id, userId, role: "lessor_analyst" });
  } finally {
    await close();
  }
}

/**
 * Jeu de démonstration : 4 organisations fictives et leurs comptes
 * (src/lib/demo-accounts.ts), plus le profil KYC de l'entreprise de
 * démonstration et un dossier soumis avec ses pièces (PDF fictifs chiffrés),
 * pour que la file de revue de la phase 5 ne soit pas vide.
 * Idempotent : ne crée que ce qui manque. Connexion propriétaire
 * (DATABASE_URL_ADMIN).
 *
 * Les secrets TOTP sont chiffrés exactement comme Better-Auth le fait
 * (symmetricEncrypt avec BETTER_AUTH_SECRET) : le seed doit utiliser le
 * même secret que l'application.
 */
import { createHash } from "node:crypto";
import { hashPassword, symmetricEncrypt } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, schema, withActor } from "@leaseplace/db";
import { MAX_AGE_MONTHS, requiredDocuments, type LegalForm } from "@leaseplace/domain";
import { createFileStorage, encryptedStorage } from "@leaseplace/integrations/storage";
import { DEMO_ACCOUNTS, DEMO_ORGANIZATIONS, DEMO_PASSWORD } from "../src/lib/demo-accounts";

const { users, accounts, organizations, memberships, twoFactors, companies } = schema;

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
  // Profil de l'entreprise de démonstration (ICE fictif, 15 chiffres).
  const atlasId = orgIds.get("atlas");
  if (atlasId) {
    const [profile] = await db
      .select()
      .from(companies)
      .where(eq(companies.organizationId, atlasId));
    if (!profile) {
      await db.insert(companies).values({
        organizationId: atlasId,
        legalName: "Atlas Transports Logistique SARL",
        ice: "000123456000078",
        legalForm: "sarl",
        incorporationDate: new Date("2015-03-02T00:00:00Z"),
        sector: "transport",
        city: "Casablanca",
        revenueBand: "10m_50m",
        headcountBand: "10_49",
      });
    }
  }
  // Dossier soumis de démonstration : pièces exigées, devis, consentement.
  const ownerAccount = DEMO_ACCOUNTS.find((a) => a.key === "entreprise");
  const [owner] = ownerAccount
    ? await db.select().from(users).where(eq(users.email, ownerAccount.email))
    : [];
  const storageKey = process.env.LP_STORAGE_KEY;
  const [anyRequest] = atlasId
    ? await db
        .select({ id: schema.financingRequests.id })
        .from(schema.financingRequests)
        .where(eq(schema.financingRequests.organizationId, atlasId))
        .limit(1)
    : [];
  if (atlasId && owner && storageKey && !anyRequest) {
    const storage = encryptedStorage(
      createFileStorage(process.env.LP_STORAGE_DIR ?? ".storage"),
      new Uint8Array(Buffer.from(storageKey, "base64")),
    );
    const now = new Date();
    const recent = new Date(now.getTime() - 12 * 86_400_000);
    await withActor(db, { userId: owner.id, organizationId: atlasId }, async (tx) => {
      async function addDocument(type: string, name: string) {
        const id = uuidv7();
        const bytes = new TextEncoder().encode(
          `%PDF-1.4\n% Document fictif de démonstration : ${name}\n%%EOF\n`,
        );
        const key = `${atlasId ?? ""}/${id}`;
        await storage.put(key, bytes);
        await tx.insert(schema.documents).values({
          id,
          organizationId: atlasId ?? "",
          type,
          status: "clean",
          originalName: name,
          mimeType: "application/pdf",
          sizeBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          storageKey: key,
          issuedOn: MAX_AGE_MONTHS[type as keyof typeof MAX_AGE_MONTHS] ? recent : null,
          scanResult: "clean:eicar-test",
          uploadedBy: owner?.id ?? "",
        });
        return id;
      }
      const required = requiredDocuments(
        "sarl" as LegalForm,
        new Date("2015-03-02T00:00:00Z"),
        now,
      );
      for (const type of required) await addDocument(type, `${type}.pdf`);
      const requestId = uuidv7();
      await tx.insert(schema.financingRequests).values({
        id: requestId,
        reference: sql`credit.next_request_reference()`,
        organizationId: atlasId,
        createdBy: owner.id,
        equipmentCategory: "truck",
        equipmentDescription: "Tracteur routier 4x2 neuf pour la ligne Casablanca–Tanger Med",
        condition: "new",
        supplierName: "Atlas Poids Lourds",
        amountHt: 1_150_000,
        durationMonths: 60,
        firstRentPct: 10,
        residualPct: 1,
        periodicity: "monthly",
      });
      const quoteId = await addDocument("quote", "devis-tracteur.pdf");
      await tx.insert(schema.requestDocuments).values({ requestId, documentId: quoteId });
      const [text] = await tx
        .select()
        .from(schema.legalTexts)
        .where(
          and(eq(schema.legalTexts.kind, "consent_processing"), eq(schema.legalTexts.locale, "fr")),
        );
      await tx.insert(schema.consents).values({
        id: uuidv7(),
        organizationId: atlasId,
        requestId,
        purpose: "processing",
        legalTextId: text?.id ?? "",
        grantedBy: owner.id,
      });
      await tx
        .update(schema.financingRequests)
        .set({ status: "submitted" })
        .where(eq(schema.financingRequests.id, requestId));
    });
  }
  console.warn(`Jeu de démonstration prêt : ${String(DEMO_ACCOUNTS.length)} comptes.`);
} finally {
  await close();
}

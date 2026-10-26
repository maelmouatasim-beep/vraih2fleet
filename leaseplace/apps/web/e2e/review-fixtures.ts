/**
 * Dossiers de revue créés directement en base (propriétaire) pour les tests
 * e2e : une entreprise fictive, ses pièces (PDF fictifs chiffrés), un devis,
 * un consentement et une demande soumise. Base locale ou de CI uniquement.
 */
import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { createDatabase, schema, withActor } from "@leaseplace/db";
import { requiredDocuments } from "@leaseplace/domain";
import { createFileStorage, encryptedStorage } from "@leaseplace/integrations/storage";
import { demoPdf } from "../src/lib/watermark";

export interface ReviewCase {
  requestId: string;
  reference: string;
  companyName: string;
  ownerEmail: string;
}

export async function createReviewCase(options: { anomaly?: boolean } = {}): Promise<ReviewCase> {
  const url = process.env.DATABASE_URL_ADMIN ?? "";
  const key = process.env.LP_STORAGE_KEY ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("e2e : base locale uniquement");
  const storage = encryptedStorage(
    createFileStorage(process.env.LP_STORAGE_DIR ?? ".storage"),
    new Uint8Array(Buffer.from(key, "base64")),
  );
  const tag = randomBytes(3).toString("hex");
  const companyName = `Revue ${tag} SARL`;
  const ownerEmail = `dirigeant.${tag}@revue-e2e.example`;
  const { db, close } = createDatabase(url, { max: 1 });
  try {
    const orgId = uuidv7();
    const ownerId = uuidv7();
    await db
      .insert(schema.organizations)
      .values({ id: orgId, name: companyName, slug: `revue-${tag}`, type: "company" });
    await db
      .insert(schema.users)
      .values({ id: ownerId, name: "Karima Ziani", email: ownerEmail, emailVerified: true });
    await db
      .insert(schema.memberships)
      .values({ id: uuidv7(), organizationId: orgId, userId: ownerId, role: "company_owner" });
    await db.insert(schema.companies).values({
      organizationId: orgId,
      legalName: companyName,
      ice: `00${String(Date.now()).slice(-13)}`,
      legalForm: "sarl",
      incorporationDate: new Date("2016-04-11T00:00:00Z"),
      sector: "construction",
      city: "Rabat",
      revenueBand: "3m_10m",
      headcountBand: "10_49",
    });
    return await withActor(db, { userId: ownerId, organizationId: orgId }, async (tx) => {
      const recent = new Date(Date.now() - 10 * 86_400_000);
      async function addDocument(type: string, name: string) {
        const id = uuidv7();
        const bytes = await demoPdf(`${companyName} : ${name}`, [`e2e ${tag}`]);
        await storage.put(`${orgId}/${id}`, bytes);
        await tx.insert(schema.documents).values({
          id,
          organizationId: orgId,
          type,
          status: "clean",
          originalName: name,
          mimeType: "application/pdf",
          sizeBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          storageKey: `${orgId}/${id}`,
          issuedOn: recent,
          uploadedBy: ownerId,
        });
        return id;
      }
      for (const type of requiredDocuments("sarl", new Date("2016-04-11T00:00:00Z"), new Date())) {
        await addDocument(
          type,
          options.anomaly && type === "rc_extract" ? "rc-autre-ice.pdf" : `${type}.pdf`,
        );
      }
      const requestId = uuidv7();
      const [row] = await tx
        .insert(schema.financingRequests)
        .values({
          id: requestId,
          reference: sql`credit.next_request_reference()`,
          organizationId: orgId,
          createdBy: ownerId,
          equipmentCategory: "construction_machine",
          equipmentDescription: "Mini-pelle 5 tonnes pour chantiers de voirie",
          condition: "new",
          supplierName: "Engins du Bouregreg",
          amountHt: 650_000,
          durationMonths: 48,
          firstRentPct: 10,
          residualPct: 1,
          periodicity: "monthly",
        })
        .returning({ reference: schema.financingRequests.reference });
      const quoteId = await addDocument("quote", "devis-minipelle.pdf");
      await tx.insert(schema.requestDocuments).values({ requestId, documentId: quoteId });
      const [text] = await tx
        .select()
        .from(schema.legalTexts)
        .where(sql`kind = 'consent_processing' and locale = 'fr'`);
      await tx.insert(schema.consents).values({
        id: uuidv7(),
        organizationId: orgId,
        requestId,
        purpose: "processing",
        legalTextId: text?.id ?? "",
        grantedBy: ownerId,
      });
      await tx
        .update(schema.financingRequests)
        .set({ status: "submitted" })
        .where(eq(schema.financingRequests.id, requestId));
      return { requestId, reference: row?.reference ?? "", companyName, ownerEmail };
    });
  } finally {
    await close();
  }
}

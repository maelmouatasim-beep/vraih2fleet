import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import {
  BUSINESS_SECTORS,
  DOCUMENT_TYPES,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  HEADCOUNT_BANDS,
  LEGAL_FORMS,
  PERIODICITIES,
  REQUEST_STATUSES,
  REVENUE_BANDS,
  requestMachine,
} from "@leaseplace/domain";
import type { Transaction } from "../client";
import {
  companies,
  consents,
  documents,
  financingRequests,
  legalTexts,
  requestDocuments,
  requestEvents,
  users,
} from "../schema";
import { asApp, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;
let legalTextId: string;
const tag = uuidv7().slice(-10);
const hex = (n: number) => n.toString(16).padStart(64, "0");

beforeAll(async () => {
  f = await createFixture(db, {
    pmeA: {
      type: "company",
      members: { dirigeantA: "company_owner", collaborateurA: "company_member" },
    },
    pmeB: { type: "company", members: { dirigeantB: "company_owner" } },
    bailleur: { type: "lessor", members: { analyste: "lessor_analyst" } },
    plateforme: { type: "platform", members: { ops: "platform_ops" } },
  });
  const [text] = await db
    .select()
    .from(legalTexts)
    .where(sql`kind = 'consent_processing' and locale = 'fr'`);
  legalTextId = text?.id ?? "";
});
afterAll(async () => {
  await db
    .execute(
      sql`delete from credit.financing_requests where organization_id in (${f.orgs.pmeA}, ${f.orgs.pmeB})`,
    )
    .catch(() => undefined);
  await f.cleanup().catch(() => undefined);
  await close();
});

const as = (key: string) => ({ userId: f.users[key] ?? null });
const org = (key: string) => f.orgs[key] ?? "";
const user = (key: string) => f.users[key] ?? "";

function newDocument(tx: Transaction, orgKey: string, userKey: string, n: number, type = "quote") {
  const id = uuidv7();
  return tx
    .insert(documents)
    .values({
      id,
      organizationId: org(orgKey),
      type,
      status: "clean",
      originalName: "devis.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      sha256: hex(n + Number.parseInt(tag.slice(-4), 16)),
      storageKey: `${org(orgKey)}/${id}`,
      uploadedBy: user(userKey),
    })
    .returning();
}

function newRequest(tx: Transaction, orgKey: string, userKey: string) {
  return tx
    .insert(financingRequests)
    .values({
      id: uuidv7(),
      reference: sql`credit.next_request_reference()`,
      organizationId: org(orgKey),
      createdBy: user(userKey),
      equipmentCategory: "truck",
      amountHt: 1_200_000,
    })
    .returning();
}

describe("listes de valeurs : domaine ≡ contraintes SQL", () => {
  async function checkValues(constraint: string) {
    const [row] = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${constraint}`,
    );
    return new Set([...(row?.def ?? "").matchAll(/'([a-z0-9_]+)'::text/g)].map((m) => m[1]));
  }
  it.each([
    ["companies_legal_form_check", LEGAL_FORMS],
    ["companies_sector_check", BUSINESS_SECTORS],
    ["companies_revenue_band_check", REVENUE_BANDS],
    ["companies_headcount_band_check", HEADCOUNT_BANDS],
    ["documents_type_check", DOCUMENT_TYPES],
    ["requests_category_check", EQUIPMENT_CATEGORIES],
    ["requests_condition_check", EQUIPMENT_CONDITIONS],
    ["requests_periodicity_check", PERIODICITIES],
    ["requests_status_check", REQUEST_STATUSES],
  ] as const)("%s", async (name, values) => {
    expect(await checkValues(name)).toEqual(new Set(values));
  });
});

describe("onboarding", () => {
  it("un nouvel utilisateur crée son entreprise et en devient dirigeant ; une seule fois", async () => {
    const userId = uuidv7();
    await db
      .insert(users)
      .values({ id: userId, name: "Nouveau", email: `nouveau-${tag}@pme.example` });
    const ice = `9${tag.replace(/\D/g, "").padEnd(14, "7").slice(0, 14)}`;
    const create = () =>
      asApp(db, { userId }, (tx) =>
        tx.execute<{
          id: string;
        }>(sql`select kyc.create_company('Nouvelle PME SARL', ${`nouvelle-${tag}`}, ${ice},
          'sarl', 'transport', 'Casablanca', '2020-01-15', '3m_10m', '10_49') as id`),
      );
    const [row] = await create();
    const mine = await asApp(db, { userId }, (tx) => tx.select().from(companies));
    expect(mine.map((c) => c.organizationId)).toEqual([row?.id]);
    expect(await pgError(create())).toBe("23505");
    expect(
      await pgError(
        asApp(db, { userId: null }, (tx) =>
          tx.execute(
            sql`select kyc.create_company('X', 'x', '000000000000000', 'sarl', 'transport', 'Rabat', null, null, null)`,
          ),
        ),
      ),
    ).toBe("42501");
    await db.execute(sql`delete from identity.organizations where id = ${row?.id ?? ""}`);
    await db.delete(users).where(sql`id = ${userId}`);
  });
});

describe("documents", () => {
  it("dépôt par un membre ; invisible pour une autre entreprise et pour un bailleur ; visible plateforme", async () => {
    const [doc] = await asApp(db, as("collaborateurA"), (tx) =>
      newDocument(tx, "pmeA", "collaborateurA", 1),
    );
    expect(
      await asApp(db, as("dirigeantB"), (tx) =>
        tx
          .select()
          .from(documents)
          .where(sql`id = ${doc?.id ?? ""}`),
      ),
    ).toEqual([]);
    expect(await asApp(db, as("analyste"), (tx) => tx.select().from(documents))).toEqual([]);
    expect(
      await asApp(db, as("ops"), (tx) =>
        tx
          .select()
          .from(documents)
          .where(sql`id = ${doc?.id ?? ""}`),
      ),
    ).toHaveLength(1);
  });

  it("dépôt refusé dans une autre entreprise ou au nom d'un autre", async () => {
    expect(
      await pgError(asApp(db, as("dirigeantB"), (tx) => newDocument(tx, "pmeA", "dirigeantB", 2))),
    ).toBe("42501");
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) => newDocument(tx, "pmeA", "collaborateurA", 3)),
      ),
    ).toBe("42501");
  });

  it("immuable : seul l'effacement logique est permis, une fois", async () => {
    const [doc] = await asApp(db, as("dirigeantA"), (tx) =>
      newDocument(tx, "pmeA", "dirigeantA", 4, "articles"),
    );
    const id = doc?.id ?? "";
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) =>
          tx
            .update(documents)
            .set({ type: "other" })
            .where(sql`id = ${id}`),
        ),
      ),
    ).toBe("42501");
    await asApp(db, as("dirigeantA"), (tx) =>
      tx
        .update(documents)
        .set({ deletedAt: new Date() })
        .where(sql`id = ${id}`),
    );
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) =>
          tx
            .update(documents)
            .set({ deletedAt: new Date() })
            .where(sql`id = ${id}`),
        ),
      ),
    ).toBe("42501");
  });
});

describe("demandes, consentement, historique", () => {
  it("cycle complet : brouillon → (consentement) → soumise ; historique tracé ; contenu figé", async () => {
    const [req] = await asApp(db, as("collaborateurA"), (tx) =>
      newRequest(tx, "pmeA", "collaborateurA"),
    );
    const id = req?.id ?? "";
    expect(req?.reference).toMatch(/^LP-\d{4}-\d{6}$/);

    // Sans consentement : soumission refusée par la base.
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) =>
          tx
            .update(financingRequests)
            .set({ status: "submitted" })
            .where(sql`id = ${id}`),
        ),
      ),
    ).toBe("23514");

    // Le consentement est réservé au dirigeant.
    const consent = (key: string) =>
      asApp(db, as(key), (tx) =>
        tx
          .insert(consents)
          .values({
            id: uuidv7(),
            organizationId: org("pmeA"),
            requestId: id,
            purpose: "processing",
            legalTextId,
            grantedBy: user(key),
          })
          .returning(),
      );
    expect(await pgError(consent("collaborateurA"))).toBe("42501");
    const [c] = await consent("dirigeantA");

    await asApp(db, as("dirigeantA"), (tx) =>
      tx
        .update(financingRequests)
        .set({ status: "submitted" })
        .where(sql`id = ${id}`),
    );
    const events = await asApp(db, as("collaborateurA"), (tx) =>
      tx
        .select()
        .from(requestEvents)
        .where(sql`request_id = ${id}`)
        .orderBy(requestEvents.id),
    );
    expect(events.map((e) => [e.fromStatus, e.toStatus])).toEqual([
      [null, "draft"],
      ["draft", "submitted"],
    ]);
    expect(events[1]?.actorUserId).toBe(user("dirigeantA"));

    // Figée : ni contenu, ni retour en brouillon ; annulation possible.
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) =>
          tx
            .update(financingRequests)
            .set({ amountHt: 1 })
            .where(sql`id = ${id}`),
        ),
      ),
    ).toBe("23514");
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) =>
          tx
            .update(financingRequests)
            .set({ status: "draft" })
            .where(sql`id = ${id}`),
        ),
      ),
    ).toBe("23514");
    await asApp(db, as("dirigeantA"), (tx) =>
      tx
        .update(financingRequests)
        .set({ status: "cancelled" })
        .where(sql`id = ${id}`),
    );

    // Consentement : révocable une fois, jamais modifié ni supprimé.
    const cid = c?.id ?? "";
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) =>
          tx
            .update(consents)
            .set({ purpose: "marketing" })
            .where(sql`id = ${cid}`),
        ),
      ),
    ).toBe("42501");
    expect(await pgError(db.execute(sql`delete from kyc.consents where id = ${cid}`))).toBe(
      "42501",
    );
    await asApp(db, as("dirigeantA"), (tx) =>
      tx
        .update(consents)
        .set({ revokedAt: new Date(), revokedBy: user("dirigeantA") })
        .where(sql`id = ${cid}`),
    );
    expect(
      await pgError(
        asApp(db, as("dirigeantA"), (tx) =>
          tx
            .update(consents)
            .set({ revokedAt: new Date(), revokedBy: user("dirigeantA") })
            .where(sql`id = ${cid}`),
        ),
      ),
    ).toBe("42501");
  });

  it("table de transitions SQL ≡ requestMachine", async () => {
    const [row] = await db.execute<{ src: string }>(
      sql`select prosrc as src from pg_proc where proname = 'guard_request_update'`,
    );
    const pairs = [...(row?.src ?? "").matchAll(/\('([a-z]+)', '([a-z]+)'\)/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(pairs).toEqual(requestMachine.edges().map(([a, b]) => [a, b]));
  });

  it("isolation : une autre entreprise et un bailleur ne voient ni demandes ni historique ni consentements", async () => {
    for (const key of ["dirigeantB", "analyste"]) {
      const seen = await asApp(db, as(key), async (tx) => ({
        r: await tx
          .select()
          .from(financingRequests)
          .where(sql`organization_id = ${org("pmeA")}`),
        e: await tx.select().from(requestEvents),
        c: await tx
          .select()
          .from(consents)
          .where(sql`organization_id = ${org("pmeA")}`),
      }));
      expect(seen, key).toEqual({ r: [], e: [], c: [] });
    }
  });

  it("pièce jointe : même entreprise, demande en brouillon seulement", async () => {
    const [docB] = await asApp(db, as("dirigeantB"), (tx) =>
      newDocument(tx, "pmeB", "dirigeantB", 5),
    );
    const [docA] = await asApp(db, as("dirigeantA"), (tx) =>
      newDocument(tx, "pmeA", "dirigeantA", 6),
    );
    const [req] = await asApp(db, as("dirigeantA"), (tx) => newRequest(tx, "pmeA", "dirigeantA"));
    const attach = (documentId: string) =>
      asApp(db, as("dirigeantA"), (tx) =>
        tx.insert(requestDocuments).values({ requestId: req?.id ?? "", documentId }),
      );
    expect(await pgError(attach(docB?.id ?? ""))).toBe("23514");
    await attach(docA?.id ?? "");
    const attached = await asApp(db, as("dirigeantA"), (tx) =>
      tx
        .select()
        .from(requestDocuments)
        .where(sql`request_id = ${req?.id ?? ""}`),
    );
    expect(attached).toHaveLength(1);
  });
});

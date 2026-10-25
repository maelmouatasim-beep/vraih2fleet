import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AI_RUN_PURPOSES,
  AI_RUN_STATUSES,
  CHECK_CODES,
  CHECK_STATUSES,
  DOCUMENT_REVIEW_STATUSES,
  GRADES,
  MEMO_STATUSES,
} from "@leaseplace/domain";
import type { Transaction } from "../client";
import {
  aiRuns,
  consents,
  creditMemos,
  documentExtractions,
  documents,
  financingRequests,
  kycChecks,
  legalTexts,
  requestDocuments,
  requestEvents,
  riskAssessments,
  riskOverrides,
} from "../schema";
import { asApp, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;
let legalTextId: string;
const tag = uuidv7().slice(-6);
const hex = (n: number) => n.toString(16).padStart(64, "0");

beforeAll(async () => {
  f = await createFixture(db, {
    pme: { type: "company", members: { dirigeant: "company_owner" } },
    autre: { type: "company", members: { autreDirigeant: "company_owner" } },
    bailleur: { type: "lessor", members: { analyste: "lessor_analyst" } },
    plateforme: {
      type: "platform",
      members: { ops: "platform_ops", support: "platform_support" },
    },
  });
  const [text] = await db
    .select()
    .from(legalTexts)
    .where(sql`kind = 'consent_processing' and locale = 'fr'`);
  legalTextId = text?.id ?? "";
});

afterAll(async () => {
  // Nettoyage hors application : les triggers d'immuabilité sont suspendus.
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      for (const o of [f.orgs.pme, f.orgs.autre]) {
        await tx.execute(
          sql`delete from credit.credit_memos where request_id in (select id from credit.financing_requests where organization_id = ${o})`,
        );
        await tx.execute(
          sql`delete from credit.risk_overrides where assessment_id in (select id from credit.risk_assessments where organization_id = ${o})`,
        );
        await tx.execute(sql`delete from credit.risk_assessments where organization_id = ${o}`);
        await tx.execute(sql`delete from kyc.kyc_checks where organization_id = ${o}`);
        await tx.execute(sql`delete from kyc.document_extractions where organization_id = ${o}`);
        await tx.execute(sql`delete from credit.ai_runs where organization_id = ${o}`);
        await tx.execute(sql`delete from credit.financing_requests where organization_id = ${o}`);
        await tx.execute(sql`delete from kyc.documents where organization_id = ${o}`);
        await tx.execute(sql`delete from kyc.consents where organization_id = ${o}`);
      }
    })
    .catch(() => undefined);
  await f.cleanup().catch(() => undefined);
  await close();
});

const as = (key: string) => ({ userId: f.users[key] ?? null });
const org = (key: string) => f.orgs[key] ?? "";
const user = (key: string) => f.users[key] ?? "";

async function submittedRequest(n: number) {
  return asApp(db, as("dirigeant"), async (tx) => {
    const id = uuidv7();
    await tx.insert(financingRequests).values({
      id,
      reference: sql`credit.next_request_reference()`,
      organizationId: org("pme"),
      createdBy: user("dirigeant"),
      equipmentCategory: "truck",
      amountHt: 900_000 + n,
    });
    await tx.insert(consents).values({
      id: uuidv7(),
      organizationId: org("pme"),
      requestId: id,
      purpose: "processing",
      legalTextId,
      grantedBy: user("dirigeant"),
    });
    await tx
      .update(financingRequests)
      .set({ status: "submitted" })
      .where(sql`id = ${id}`);
    return id;
  });
}

const setStatus = (tx: Transaction, id: string, status: string, note?: string) =>
  (note === undefined
    ? Promise.resolve()
    : tx.execute(sql`select set_config('app.event_note', ${note}, true)`)
  ).then(() =>
    tx
      .update(financingRequests)
      .set({ status })
      .where(sql`id = ${id}`)
      .returning(),
  );

function assessment(tx: Transaction, requestId: string, userKey = "ops") {
  return tx
    .insert(riskAssessments)
    .values({
      id: uuidv7(),
      requestId,
      organizationId: org("pme"),
      modelVersion: "1.0.0",
      inputs: {},
      ratios: {},
      factors: [],
      flags: [],
      score: 72.5,
      grade: "B",
      uncappedGrade: "B",
      createdBy: user(userKey),
    })
    .returning();
}

function memo(tx: Transaction, requestId: string, assessmentId: string) {
  return tx
    .insert(creditMemos)
    .values({
      id: uuidv7(),
      requestId,
      assessmentId,
      content: { sections: [] },
      sourceMap: {},
      createdBy: user("ops"),
    })
    .returning();
}

function aiRun(tx: Transaction, requestId: string) {
  return tx
    .insert(aiRuns)
    .values({
      id: uuidv7(),
      purpose: "document_extraction",
      provider: "mock",
      model: "simulateur-demo",
      promptVersion: "extraction-v1",
      organizationId: org("pme"),
      requestId,
      inputSha256: hex(1),
      status: "succeeded",
      createdBy: user("ops"),
    })
    .returning();
}

describe("listes de valeurs : domaine ≡ contraintes SQL", () => {
  async function checkValues(constraint: string) {
    const [row] = await db.execute<{ def: string }>(
      sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${constraint}`,
    );
    return new Set(
      [...(row?.def ?? "").matchAll(/'([A-Za-z0-9_]+)'::(?:text|bpchar)/g)].map((m) => m[1]),
    );
  }
  it.each([
    ["documents_review_status_check", DOCUMENT_REVIEW_STATUSES],
    ["ai_runs_purpose_check", AI_RUN_PURPOSES],
    ["ai_runs_status_check", AI_RUN_STATUSES],
    ["kyc_checks_code_check", CHECK_CODES],
    ["kyc_checks_status_check", CHECK_STATUSES],
    ["risk_assessments_grade_check", GRADES],
    ["risk_overrides_grade_check", GRADES],
    ["credit_memos_status_check", MEMO_STATUSES],
  ] as const)("%s", async (name, values) => {
    expect(await checkValues(name)).toEqual(new Set(values));
  });
});

describe("revue d'une demande", () => {
  it("parcours complet : revue, compléments motivés, resoumission, qualification", async () => {
    const id = await submittedRequest(1);

    // L'entreprise ne peut pas se mettre en revue ; le support non plus.
    expect(await pgError(asApp(db, as("dirigeant"), (tx) => setStatus(tx, id, "in_review")))).toBe(
      "42501",
    );
    for (const key of ["support", "analyste"]) {
      expect(await asApp(db, as(key), (tx) => setStatus(tx, id, "in_review")), key).toEqual([]);
    }
    await asApp(db, as("ops"), (tx) => setStatus(tx, id, "in_review"));

    // Pendant la revue, la demande est figée pour l'entreprise.
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx
            .update(financingRequests)
            .set({ amountHt: 1 })
            .where(sql`id = ${id}`),
        ),
      ),
    ).toBe("23514");

    // Compléments demandés : motif visible dans l'historique de l'entreprise.
    await asApp(db, as("ops"), (tx) =>
      setStatus(tx, id, "needs_info", "Merci de joindre le devis signé du fournisseur."),
    );
    const events = await asApp(db, as("dirigeant"), (tx) =>
      tx
        .select()
        .from(requestEvents)
        .where(sql`request_id = ${id}`),
    );
    expect(events.at(-1)).toMatchObject({
      toStatus: "needs_info",
      metadata: { note: "Merci de joindre le devis signé du fournisseur." },
    });

    // L'entreprise corrige, joint une pièce et resoumet.
    await asApp(db, as("dirigeant"), async (tx) => {
      await tx
        .update(financingRequests)
        .set({ amountHt: 950_000 })
        .where(sql`id = ${id}`);
      const docId = uuidv7();
      await tx.insert(documents).values({
        id: docId,
        organizationId: org("pme"),
        type: "quote",
        status: "clean",
        originalName: "devis-signe.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        sha256: hex(Number.parseInt(tag, 16)),
        storageKey: `${org("pme")}/${docId}`,
        uploadedBy: user("dirigeant"),
      });
      await tx.insert(requestDocuments).values({ requestId: id, documentId: docId });
      await setStatus(tx, id, "submitted");
    });
    await asApp(db, as("ops"), (tx) => setStatus(tx, id, "in_review"));

    // Qualification : impossible sans indice ni note validée.
    expect(await pgError(asApp(db, as("ops"), (tx) => setStatus(tx, id, "qualified")))).toBe(
      "23514",
    );
    await asApp(db, as("ops"), async (tx) => {
      const [a] = await assessment(tx, id);
      const [m] = await memo(tx, id, a?.id ?? "");
      await tx
        .update(creditMemos)
        .set({ status: "approved", decidedBy: user("ops") })
        .where(sql`id = ${m?.id ?? ""}`);
      await setStatus(tx, id, "qualified");
    });

    // Plus de retour en arrière ; l'entreprise peut encore annuler.
    expect(await pgError(asApp(db, as("ops"), (tx) => setStatus(tx, id, "in_review")))).toBe(
      "23514",
    );
    expect(await pgError(asApp(db, as("ops"), (tx) => setStatus(tx, id, "cancelled")))).toBe(
      "42501",
    );
    await asApp(db, as("dirigeant"), (tx) => setStatus(tx, id, "cancelled"));
  });

  it("pièces jointes figées pendant la revue", async () => {
    const id = await submittedRequest(2);
    await asApp(db, as("ops"), (tx) => setStatus(tx, id, "in_review"));
    const [doc] = await db
      .insert(documents)
      .values({
        id: uuidv7(),
        organizationId: org("pme"),
        type: "quote",
        status: "clean",
        originalName: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
        sha256: hex(Number.parseInt(tag, 16) + 1),
        storageKey: `${org("pme")}/${uuidv7()}`,
        uploadedBy: user("dirigeant"),
      })
      .returning();
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx.insert(requestDocuments).values({ requestId: id, documentId: doc?.id ?? "" }),
        ),
      ),
    ).toBe("23514");
  });
});

describe("tables de revue : plateforme seulement", () => {
  it("entreprise, bailleur et support ne lisent rien ; les opérations lisent", async () => {
    const id = await submittedRequest(3);
    await asApp(db, as("ops"), async (tx) => {
      const [run] = await aiRun(tx, id);
      await assessment(tx, id);
      await tx.insert(kycChecks).values({
        id: uuidv7(),
        runId: uuidv7(),
        organizationId: org("pme"),
        requestId: id,
        code: "ice_match",
        status: "pass",
        documentIds: [],
        found: [],
      });
      expect(run?.status).toBe("succeeded");
    });
    for (const key of ["dirigeant", "autreDirigeant", "analyste", "support"]) {
      const seen = await asApp(db, as(key), async (tx) => ({
        runs: await tx.select().from(aiRuns),
        assessments: await tx.select().from(riskAssessments),
        checks: await tx.select().from(kycChecks),
        extractions: await tx.select().from(documentExtractions),
        memos: await tx.select().from(creditMemos),
        overrides: await tx.select().from(riskOverrides),
      }));
      expect(seen, key).toEqual({
        runs: [],
        assessments: [],
        checks: [],
        extractions: [],
        memos: [],
        overrides: [],
      });
    }
    const opsView = await asApp(db, as("ops"), (tx) =>
      tx
        .select()
        .from(riskAssessments)
        .where(sql`request_id = ${id}`),
    );
    expect(opsView).toHaveLength(1);
  });

  it("une entreprise ne peut rien écrire dans les tables de revue", async () => {
    const id = await submittedRequest(4);
    expect(await pgError(asApp(db, as("dirigeant"), (tx) => assessment(tx, id, "dirigeant")))).toBe(
      "42501",
    );
  });

  it("une évaluation, une trace, une correction sont immuables", async () => {
    const id = await submittedRequest(5);
    const { a, run } = await asApp(db, as("ops"), async (tx) => {
      const [a] = await assessment(tx, id);
      const [run] = await aiRun(tx, id);
      await tx.insert(riskOverrides).values({
        id: uuidv7(),
        assessmentId: a?.id ?? "",
        grade: "C",
        reason: "Caution personnelle refusée par le dirigeant",
        createdBy: user("ops"),
      });
      return { a, run };
    });
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) =>
          tx
            .update(riskAssessments)
            .set({ grade: "A" })
            .where(sql`id = ${a?.id ?? ""}`),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) => tx.delete(aiRuns).where(sql`id = ${run?.id ?? ""}`)),
      ),
    ).toBe("42501");
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) =>
          tx.insert(riskOverrides).values({
            id: uuidv7(),
            assessmentId: a?.id ?? "",
            grade: "A",
            reason: "trop court",
            createdBy: user("ops"),
          }),
        ),
      ),
    ).toBe("23514");
  });

  it("note de synthèse : contenu figé, décision unique par son auteur", async () => {
    const id = await submittedRequest(6);
    const m = await asApp(db, as("ops"), async (tx) => {
      const [a] = await assessment(tx, id);
      const [m] = await memo(tx, id, a?.id ?? "");
      // Un seul brouillon à la fois.
      expect(await pgError(memo(tx, id, a?.id ?? ""))).toBe("23505");
      return m;
    }).catch(() => null);
    expect(m).toBeNull();
    const memoId = await asApp(db, as("ops"), async (tx) => {
      const [a] = await assessment(tx, id);
      const [created] = await memo(tx, id, a?.id ?? "");
      return created?.id ?? "";
    });
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) =>
          tx
            .update(creditMemos)
            .set({ content: { sections: ["x"] } })
            .where(sql`id = ${memoId}`),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) =>
          tx
            .update(creditMemos)
            .set({ status: "approved", decidedBy: user("support") })
            .where(sql`id = ${memoId}`),
        ),
      ),
    ).toBe("42501");
    await asApp(db, as("ops"), (tx) =>
      tx
        .update(creditMemos)
        .set({ status: "discarded", decidedBy: user("ops") })
        .where(sql`id = ${memoId}`),
    );
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) =>
          tx
            .update(creditMemos)
            .set({ status: "approved", decidedBy: user("ops") })
            .where(sql`id = ${memoId}`),
        ),
      ),
    ).toBe("42501");
  });
});

describe("revue des documents", () => {
  it("statut de revue : plateforme seulement ; le reste du document reste figé", async () => {
    const docId = uuidv7();
    await asApp(db, as("dirigeant"), (tx) =>
      tx.insert(documents).values({
        id: docId,
        organizationId: org("pme"),
        type: "rc_extract",
        status: "clean",
        originalName: "rc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
        sha256: hex(Number.parseInt(tag, 16) + 2),
        storageKey: `${org("pme")}/${docId}`,
        uploadedBy: user("dirigeant"),
      }),
    );
    expect(
      await pgError(
        asApp(db, as("dirigeant"), (tx) =>
          tx
            .update(documents)
            .set({ reviewStatus: "verified" })
            .where(sql`id = ${docId}`),
        ),
      ),
    ).toBe("42501");
    expect(
      await pgError(
        asApp(db, as("ops"), (tx) =>
          tx
            .update(documents)
            .set({ originalName: "autre.pdf" })
            .where(sql`id = ${docId}`),
        ),
      ),
    ).toBe("42501");
    const [updated] = await asApp(db, as("ops"), (tx) =>
      tx
        .update(documents)
        .set({ reviewStatus: "rejected", reviewNote: "Extrait de plus de trois mois" })
        .where(sql`id = ${docId}`)
        .returning(),
    );
    expect(updated?.reviewStatus).toBe("rejected");
  });
});

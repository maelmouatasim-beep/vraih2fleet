import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { leads } from "../schema";
import { asApp, createFixture, pgError, testDatabase, type Fixture } from "./helpers";

const { db, close } = testDatabase();
let f: Fixture;
const tag = uuidv7().slice(-12);
const ip = `10.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}.1`;

beforeAll(async () => {
  f = await createFixture(db, {
    bailleur: { type: "lessor", members: { analyste: "lessor_analyst" } },
    plateforme: { type: "platform", members: { ops: "platform_ops", support: "platform_support" } },
  });
});
afterAll(async () => {
  await f.cleanup();
  await close();
});

const submit = (email: string, overrides: { kind?: string; consent?: string } = {}) =>
  asApp(db, { userId: null, ip }, (tx) =>
    tx.execute<{ id: string }>(sql`
      select marketing.submit_lead(${overrides.kind ?? "lessor"}, 'Cèdre Leasing', 'Youssef Alaoui',
        ${email}, '+212 600 000 000', 'Présentation souhaitée', 'fr', ${overrides.consent ?? "2026-10-22"}) as id
    `),
  );

describe("demandes de contact", () => {
  it("un visiteur anonyme dépose une demande ; l'adresse est normalisée", async () => {
    const [row] = await submit(`  Contact-${tag}@Cedre.example `);
    const [lead] = await db
      .select()
      .from(leads)
      .where(sql`id = ${row?.id ?? ""}`);
    expect(lead?.email).toBe(`contact-${tag}@cedre.example`);
    expect(lead?.ip).toBe(ip);
    expect(lead?.status).toBe("new");
  });

  it("consentement obligatoire, type et adresse validés", async () => {
    expect(await pgError(submit(`a-${tag}@x.example`, { consent: "" }))).toBe("23514");
    expect(await pgError(submit(`b-${tag}@x.example`, { kind: "bank" }))).toBe("23514");
    expect(await pgError(submit("pas-une-adresse"))).toBe("23514");
  });

  it("insertion directe et lecture refusées hors plateforme", async () => {
    expect(
      await pgError(
        asApp(db, { userId: null }, (tx) =>
          tx.execute(sql`insert into marketing.leads (kind, organization_name, contact_name, email, locale, consent_version, consented_at)
            values ('lessor', 'X', 'Y', 'x@y.example', 'fr', 'v', now())`),
        ),
      ),
    ).toBe("42501");
    expect(await asApp(db, { userId: null }, (tx) => tx.select().from(leads))).toEqual([]);
    expect(
      await asApp(db, { userId: f.users.analyste ?? null }, (tx) => tx.select().from(leads)),
    ).toEqual([]);
    expect(
      await asApp(db, { userId: f.users.support ?? null }, (tx) => tx.select().from(leads)),
    ).toEqual([]);
    const seen = await asApp(db, { userId: f.users.ops ?? null }, (tx) => tx.select().from(leads));
    expect(seen.length).toBeGreaterThan(0);
  });

  it("limitation : 3 demandes par jour et par adresse", async () => {
    const email = `limite-${tag}@x.example`;
    for (let i = 0; i < 3; i++) await submit(email);
    expect(await pgError(submit(email))).toBe("P0429");
  });

  it("limitation : 5 demandes par heure et par IP", async () => {
    // 1 (premier test) + 3 (test précédent) = 4 depuis cette IP ; la 5e passe, la 6e non.
    await submit(`ip5-${tag}@x.example`);
    expect(await pgError(submit(`ip6-${tag}@x.example`))).toBe("P0429");
  });
});

/**
 * Phase 9 — balayage d'accessibilité (WCAG 2.2 AA, axe) de TOUTES les pages
 * de chaque espace, en français et en arabe (RTL), avec le jeu de
 * démonstration en volume ; sur mobile, aucune page ne défile
 * horizontalement.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { sql } from "drizzle-orm";
import { createDatabase } from "@leaseplace/db";
import {
  account,
  expectAccessible,
  resetRateLimitsBeforeEach,
  signInCompanyWithCode,
  signInPro,
} from "./fixtures";

resetRateLimitsBeforeEach();

// Alias (et non interface) : `db.execute<T>` exige un type indexable.
type Ids = {
  request: string;
  thread: string;
  target: string;
  dossier: string;
  lessor: string;
};

async function ids(): Promise<Ids> {
  const { db, close } = createDatabase(process.env.DATABASE_URL_ADMIN ?? "", { max: 1 });
  try {
    const [row] = await db.execute<Ids>(sql`
      select
        (select r.id from credit.financing_requests r join identity.organizations o on o.id = r.organization_id
          where o.slug = 'atlas-transports' and r.status = 'routed' limit 1) as request,
        (select t.id from market.threads t join credit.financing_requests r on r.id = t.request_id
          join identity.organizations o on o.id = r.organization_id
          where o.slug = 'atlas-transports' limit 1) as thread,
        (select t.id from credit.routing_targets t join identity.organizations o on o.id = t.lessor_organization_id
          where o.slug = 'cedre-leasing' and t.status = 'offered' limit 1) as target,
        (select r.id from credit.financing_requests r where r.status = 'routed' limit 1) as dossier,
        (select o.id from identity.organizations o where o.slug = 'cedre-leasing') as lessor`);
    if (!row) throw new Error("jeu de démonstration absent");
    return row;
  } finally {
    await close();
  }
}

async function scan(page: Page, paths: readonly string[], locale: "fr" | "ar") {
  for (const path of paths) {
    const url = locale === "fr" ? path : `/ar${path === "/" ? "" : path}`;
    const res = await page.goto(url);
    expect(res?.status(), url).toBeLessThan(400);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await test.step(url, () => expectAccessible(page));
  }
}

async function noHorizontalScroll(page: Page, paths: readonly string[]) {
  for (const path of paths) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} déborde de ${String(overflow)} px`).toBeLessThanOrEqual(1);
  }
}

const proPage = async (browser: Browser, key: string, home: RegExp) => {
  const page = await (await browser.newContext()).newPage();
  await signInPro(page, key);
  await expect(page).toHaveURL(home);
  return page;
};

const PUBLIC = [
  "/",
  "/simulateur",
  "/bailleurs",
  "/secteurs/transport",
  "/mentions-legales",
  "/connexion",
];

test("pages publiques : fr et ar, mobile sans débordement", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await (await browser.newContext()).newPage();
  for (const locale of ["fr", "ar"] as const) await scan(page, PUBLIC, locale);
  const mobile = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await noHorizontalScroll(mobile, [...PUBLIC, ...PUBLIC.map((p) => `/ar${p === "/" ? "" : p}`)]);
});

test("espace entreprise : toutes les pages, fr et ar, mobile", async ({ browser }) => {
  test.setTimeout(180_000);
  const id = await ids();
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await signInCompanyWithCode(page, account("entreprise").email);
  await expect(page).toHaveURL(/\/entreprise/);
  const paths = [
    "/entreprise",
    "/entreprise/demandes",
    `/entreprise/demandes/${id.request}`,
    `/entreprise/demandes/${id.request}/offres`,
    "/entreprise/coffre-fort",
    "/entreprise/profil",
    "/entreprise/messages",
    `/entreprise/messages/${id.thread}`,
    "/entreprise/notifications",
  ];
  for (const locale of ["fr", "ar"] as const) await scan(page, paths, locale);
  await noHorizontalScroll(page, [...paths, ...paths.map((p) => `/ar${p}`)]);
});

test("espace bailleur : toutes les pages, fr et ar", async ({ browser }) => {
  test.setTimeout(180_000);
  const id = await ids();
  const page = await proPage(browser, "bailleur", /\/bailleur/);
  const paths = [
    "/bailleur",
    `/bailleur/dossiers/${id.target}`,
    "/bailleur/pipeline",
    "/bailleur/tableau-de-bord",
    "/bailleur/criteres",
    "/bailleur/facturation",
    "/bailleur/notifications",
  ];
  for (const locale of ["fr", "ar"] as const) await scan(page, paths, locale);
});

test("back-office : toutes les pages, fr et ar", async ({ browser }) => {
  test.setTimeout(180_000);
  const id = await ids();
  const page = await proPage(browser, "admin", /\/admin$/);
  const paths = [
    "/admin",
    "/admin/dossiers",
    `/admin/dossiers/${id.dossier}`,
    "/admin/bailleurs",
    `/admin/bailleurs/${id.lessor}`,
    "/admin/commissions",
    "/admin/contacts",
    "/admin/utilisateurs",
    "/admin/confidentialite",
    "/admin/journal",
  ];
  for (const locale of ["fr", "ar"] as const) await scan(page, paths, locale);
});

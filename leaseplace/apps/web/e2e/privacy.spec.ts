/**
 * Phase 9 — droits loi 09-08 (export, effacement), conservation, accès
 * support en lecture seule.
 */
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { sql } from "drizzle-orm";
import { createDatabase } from "@leaseplace/db";
import {
  account,
  expectAccessible,
  resetRateLimitsBeforeEach,
  signInCompanyWithCode,
  signInPro,
} from "./fixtures";
import { createReviewCase } from "./review-fixtures";

resetRateLimitsBeforeEach();

async function asOwner(fn: (db: ReturnType<typeof createDatabase>["db"]) => Promise<unknown>) {
  const { db, close } = createDatabase(process.env.DATABASE_URL_ADMIN ?? "", { max: 1 });
  try {
    await fn(db);
  } finally {
    await close();
  }
}

test("export JSON, demande d'effacement bloquée puis exécutée", async ({ browser }) => {
  test.setTimeout(180_000);
  const c = await createReviewCase();
  const company = await (await browser.newContext()).newPage();
  await signInCompanyWithCode(company, c.ownerEmail);
  await expect(company).toHaveURL(/\/entreprise/);
  await company.goto("/entreprise/profil");
  const section = company.locator("[data-privacy]");
  await expect(section.getByRole("heading", { name: "Vos données (loi 09-08)" })).toBeVisible();

  // Export : JSON complet de l'entreprise.
  const [download] = await Promise.all([
    company.waitForEvent("download"),
    section.getByRole("link", { name: "Télécharger mes données (JSON)" }).click(),
  ]);
  const data = JSON.parse(await readFile(await download.path(), "utf-8")) as {
    format: string;
    organization: { name: string };
    requests: { reference: string }[];
    documents: { storageKey?: string }[];
    myActions: { action: string }[];
  };
  expect(data.format).toBe("leaseplace-export/1");
  expect(data.organization.name).toBe(c.companyName);
  expect(data.requests.map((r) => r.reference)).toContain(c.reference);
  expect(data.documents.length).toBeGreaterThan(0);
  expect(data.documents.every((d) => d.storageKey === undefined)).toBe(true);

  // Une demande soumise bloque l'effacement : la demande est déposée, l'exécution attend.
  await expect(section).toContainText("Une demande est en cours");
  await section.getByRole("button", { name: "Demander l’effacement" }).click();
  const submit = section.getByRole("button", { name: "Envoyer la demande" });
  await expect(submit).toBeDisabled();
  await section.getByRole("checkbox").check();
  await submit.click();
  await expect(section.locator("[data-erasure-pending]")).toBeVisible();
  await expectAccessible(company);

  const admin = await (await browser.newContext()).newPage();
  await signInPro(admin, "admin");
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.getByRole("link", { name: "Confidentialité" }).first().click();
  const row = admin.locator(`[data-privacy-request="${c.companyName}"]`);
  await expect(row).toContainText("Dossier en cours : effacement bloqué.");
  await expect(row.getByRole("button", { name: "Effacer" })).toBeDisabled();
  await expectAccessible(admin);

  // Le dossier est retiré : l'effacement devient possible.
  await asOwner((db) =>
    db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.execute(sql`update credit.financing_requests set status = 'cancelled', cancelled_at = now()
        where id = ${c.requestId}`);
    }),
  );
  await admin.reload();
  await row.getByRole("button", { name: "Effacer" }).click();
  await row.getByRole("button", { name: "Confirmer l’effacement" }).click();
  await expect(row).toContainText("Effacée");

  // Comptes fermés : la session du dirigeant ne vaut plus rien.
  await company.goto("/entreprise/profil");
  await expect(company).toHaveURL(/\/connexion/);
});

test("durées de conservation réglées et purge lancée par l'administrateur", async ({ page }) => {
  await signInPro(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/confidentialite");
  const draft = page.locator('[data-retention="draft_requests"]');
  // Une valeur différente de la valeur courante (le test peut être rejoué).
  const next = (await draft.getByLabel("Durée en jours").inputValue()) === "90" ? "120" : "90";
  await draft.getByLabel("Durée en jours").fill("10");
  await draft.getByRole("button", { name: "Enregistrer" }).click();
  await expect(draft.getByRole("alert")).toContainText("Durée sous le minimum.");
  await draft.getByLabel("Durée en jours").fill(next);
  await draft.getByRole("button", { name: "Enregistrer" }).click();
  await expect(draft.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  await page.reload();
  await expect(
    page.locator('[data-retention="draft_requests"]').getByLabel("Durée en jours"),
  ).toHaveValue(next);
  await page.getByRole("button", { name: "Lancer la purge" }).click();
  await expect(page.locator("[data-retention-result]")).toContainText("Purge effectuée");
  await page.reload();
  await expect(page.getByText(/Dernière purge/)).toBeVisible();
});

test("accès support : motif, lecture seule, aucune pièce, fin tracée", async ({ page }) => {
  test.setTimeout(120_000);
  const salma = account("entreprise");
  await signInPro(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/utilisateurs");
  const row = page.locator(`[data-user-row="${salma.email}"]`);
  await row.getByRole("button", { name: "Accès support" }).click();
  await row.getByLabel("Motif (ticket, demande du client)").fill("aide");
  await row.getByRole("button", { name: "Ouvrir l’accès" }).click();
  await expect(row.getByRole("alert")).toContainText("Motif trop court");
  await row
    .getByLabel("Motif (ticket, demande du client)")
    .fill("Ticket 2041 : la dirigeante ne retrouve pas ses offres");
  await row.getByRole("button", { name: "Ouvrir l’accès" }).click();

  // L'espace de la cliente, avec le bandeau permanent.
  await expect(page).toHaveURL(/\/entreprise/);
  const banner = page.locator("[data-support-banner]");
  await expect(banner).toContainText("Accès support en lecture seule");
  await expect(banner).toContainText(salma.name);
  await expectAccessible(page);

  // Aucune pièce téléchargeable pendant l'accès.
  await page.goto("/entreprise/coffre-fort");
  const link = page.locator('a[href^="/api/documents/"]').first();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const res = await page.request.get(href ?? "");
  expect(res.status()).toBe(403);
  // Ni export de données.
  expect((await page.request.get("/api/export")).status()).toBe(403);

  await banner.getByRole("button", { name: "Terminer l’accès" }).click();
  await expect(page).toHaveURL(/\/admin\/utilisateurs/);
  await expect(page.locator("[data-support-banner]")).toHaveCount(0);
  await page.goto("/admin/journal");
  await expect(page.getByText("support.impersonation_ended").first()).toBeVisible();
});

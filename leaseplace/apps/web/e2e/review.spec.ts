/**
 * Phase 5 — revue d'un dossier par la plateforme : prise en charge, analyse
 * (simulateur), contrôles, indice d'orientation et correction motivée, note
 * de synthèse vérifiée puis validée par un humain, qualification ;
 * demande de compléments vue par l'entreprise ; anomalie à commenter.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  expectAccessible,
  resetRateLimitsBeforeEach,
  signInCompanyWithCode,
  signInPro,
} from "./fixtures";
import { createReviewCase } from "./review-fixtures";

resetRateLimitsBeforeEach();

async function openCase(page: Page, reference: string) {
  await signInPro(page, "ops");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Revue des dossiers" }).first().click();
  await expect(page).toHaveURL(/\/admin\/dossiers$/);
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function analyze(page: Page) {
  await page.getByRole("button", { name: "Prendre en charge et analyser" }).click();
  await expect(page.locator("[data-grade]")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Extraction simulée")).toBeVisible();
}

test("revue complète jusqu'à la qualification", async ({ page }) => {
  const c = await createReviewCase();
  await openCase(page, c.reference);
  await analyze(page);
  await expect(page.locator('[data-check="ice_match"]')).toHaveAttribute("data-status", "pass");
  await expect(
    page.getByText("Indice d’orientation — la décision appartient exclusivement au bailleur."),
  ).toBeVisible();

  // Correction motivée de l'indice.
  const before = await page.locator("[data-grade]").getAttribute("data-grade");
  const target = before === "A" ? "B" : "A";
  await page.getByText("Corriger l’indice (motif obligatoire)").click();
  await page.getByText(target, { exact: true }).click();
  await page
    .getByLabel("Motif")
    .fill("Garantie personnelle du dirigeant et contrat-cadre avec l’ONCF");
  await page.getByRole("button", { name: "Enregistrer la correction" }).click();
  await expect(page.locator("[data-grade]")).toHaveAttribute("data-grade", target);

  // Qualification bloquée sans note validée.
  await page.getByRole("button", { name: "Qualifier le dossier" }).click();
  await expect(
    page.getByText("La note de synthèse de l’analyse en cours n’est pas validée."),
  ).toBeVisible();

  // Note rédigée, vérifiée, validée par un humain.
  await page.getByRole("button", { name: "Rédiger la note" }).click();
  await expect(page.locator("[data-memo]")).toContainText("Analyse financière");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Valider la note" }).click();
  await expect(page.getByText("Validée", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Qualifier le dossier" }).click();
  await expect(page.getByText("Dossier vérifié", { exact: true }).first()).toBeVisible();
});

test("compléments demandés : l'entreprise voit le motif et resoumet", async ({ page, browser }) => {
  const c = await createReviewCase();
  await openCase(page, c.reference);
  await analyze(page);
  await page
    .getByLabel("Message à l’entreprise")
    .fill("Merci de joindre un devis signé et daté du fournisseur.");
  await page.getByRole("button", { name: "Envoyer la demande" }).click();
  await expect(page.getByText("Compléments demandés").first()).toBeVisible();

  const company = await (await browser.newContext()).newPage();
  await signInCompanyWithCode(company, c.ownerEmail);
  await expect(company).toHaveURL(/\/entreprise$/);
  await company
    .getByRole("link", { name: /Compléments demandés/ })
    .first()
    .click();
  await expect(company.locator("[data-info-note]")).toContainText("devis signé et daté");
  await company.getByRole("button", { name: "Consentement" }).click();
  await company.getByLabel("J’ai lu et j’accepte ce traitement.").check();
  await company.getByRole("button", { name: "Vérification" }).click();
  await company.getByRole("button", { name: "Soumettre à nouveau" }).click();
  await expect(company.getByText("Soumise", { exact: true })).toBeVisible();
  await expect(company.locator("[data-event-note]")).toContainText("devis signé et daté");
  await company.context().close();
});

test("anomalie : ICE différent, qualification seulement après commentaire", async ({ page }) => {
  const c = await createReviewCase({ anomaly: true });
  await openCase(page, c.reference);
  await analyze(page);
  await expect(page.locator('[data-check="ice_match"]')).toHaveAttribute("data-status", "fail");
  await expect(page.locator('[data-flag="consistency_failures"]')).toBeVisible();
  await page.getByRole("button", { name: "Rédiger la note" }).click();
  await page.getByRole("button", { name: "Valider la note" }).click();
  await page.getByRole("button", { name: "Qualifier le dossier" }).click();
  await expect(page.getByText(/Des contrôles sont en anomalie/)).toBeVisible();
  await page
    .getByLabel(/Anomalies examinées/)
    .fill(
      "ICE de l'extrait RC erroné : attestation ICE et liasse concordantes, RC corrigé demandé.",
    );
  await page.getByRole("button", { name: "Qualifier le dossier" }).click();
  await expect(page.getByText("Dossier vérifié", { exact: true }).first()).toBeVisible();
});

test("l’administrateur accède à la revue ; une entreprise non", async ({ page }) => {
  const c = await createReviewCase();
  await signInPro(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/dossiers/${c.requestId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(c.companyName);
  const company = page.context();
  await company.clearCookies();
  await signInCompanyWithCode(page);
  await expect(page).toHaveURL(/\/entreprise$/);
  await page.goto(`/admin/dossiers/${c.requestId}`);
  await expect(page).toHaveURL(/\/acces-refuse/);
});

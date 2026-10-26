/**
 * Phase 6 — routage et espace bailleur : la plateforme qualifie un dossier,
 * l'entreprise choisit ses bailleurs et consent, le bailleur reçoit le
 * dossier (délai de 72 h), télécharge une pièce filigranée, envoie une offre
 * calculée par le moteur ; un autre bailleur décline avec un motif.
 */
import { expect, test } from "@playwright/test";
import {
  account,
  expectAccessible,
  lastMail,
  resetRateLimitsBeforeEach,
  signInPro,
} from "./fixtures";
import { pdfTexts } from "./pdf-text";
import { qualify, sendTo } from "./flows";
import { createReviewCase } from "./review-fixtures";

resetRateLimitsBeforeEach();

test("routage choisi par l'entreprise, offre du bailleur, refus motivé", async ({ browser }) => {
  test.setTimeout(180_000);
  const c = await createReviewCase();
  await qualify(browser, c);

  const company = await (await browser.newContext()).newPage();
  await sendTo(company, c, ["Cèdre Leasing", "Argane Bail"]);

  // Cèdre : courriel sans données du dossier, boîte de réception, délai de 72 h.
  const cedre = await (await browser.newContext()).newPage();
  const mail = await lastMail(cedre, account("bailleur").email);
  expect(mail.body).toContain(c.reference);
  expect(mail.body).not.toContain(c.companyName);
  await signInPro(cedre, "bailleur");
  await expect(cedre).toHaveURL(/\/bailleur$/);
  const row = cedre.locator(`[data-inbox-row="${c.reference}"]`);
  await expect(row).toContainText(c.companyName);
  await expect(row).toContainText("Nouveau");
  await expect(row.locator('[data-sla="ok"]')).toContainText(/7[12] h restantes/);
  await expectAccessible(cedre);
  await row.getByRole("link", { name: c.reference }).click();

  // Fiche : consultée, synthèse, pièces filigranées au nom du bailleur.
  await expect(cedre.getByRole("heading", { level: 1, name: c.companyName })).toBeVisible();
  await expect(cedre.getByText("Consulté", { exact: true }).first()).toBeVisible();
  await expect(cedre.locator("[data-memo]")).toBeVisible();
  const rc = cedre.locator('[data-lessor-document="rc_extract"] a');
  const response = await cedre.request.get((await rc.getAttribute("href")) ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  const texts = pdfTexts(new Uint8Array(await response.body()));
  expect(texts).toContain("Cèdre Leasing · LeasePlace");
  expect(texts.some((t) => t.startsWith("Consulté par Cèdre Leasing le "))).toBe(true);
  await expectAccessible(cedre);

  // Offre : saisie invalide signalée, puis loyer et TEG recalculés en direct.
  const form = cedre.locator("[data-response]");
  await form.getByLabel("Taux annuel").fill("45");
  await expect(form.getByText("Taux invalide : entre 0,1 % et 30 %.")).toBeVisible();
  await expect(form.getByRole("button", { name: "Envoyer l’offre" })).toBeDisabled();
  await form.getByLabel("Taux annuel").fill("8,9");
  await expect(form.locator("[data-offer-preview]")).not.toContainText("—");
  const previewRent = (await form.locator("[data-offer-preview] p").nth(1).textContent()) ?? "";
  await form.getByRole("button", { name: "Envoyer l’offre" }).click();
  const summary = cedre.locator("[data-offer-summary]");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText(previewRent.trim());
  await expect(cedre.getByText("Offre envoyée", { exact: true }).first()).toBeVisible();

  // Argane : refus « autre motif » sans précision refusé, puis motivé.
  const argane = await (await browser.newContext()).newPage();
  await signInPro(argane, "bailleur-b");
  await expect(argane).toHaveURL(/\/bailleur$/);
  await argane
    .locator(`[data-inbox-row="${c.reference}"]`)
    .getByRole("link", { name: c.reference })
    .click();
  await argane.getByText("Ne pas donner suite").click();
  await argane.getByLabel("Autre motif").check();
  await argane.getByRole("button", { name: "Confirmer le refus" }).click();
  await expect(argane.getByText("Précisez le motif (10 caractères au moins).")).toBeVisible();
  await argane.getByLabel("Précision (facultatif)").fill("Plafond sectoriel atteint ce trimestre");
  await argane.getByRole("button", { name: "Confirmer le refus" }).click();
  await expect(argane.getByText(/Dossier décliné le .*\s: Autre motif\./)).toBeVisible();

  // L'entreprise voit l'offre et le refus, et reçoit un courriel.
  await company.reload();
  await expect(company.locator('[data-target="Cèdre Leasing"]')).toContainText("Offre reçue");
  await expect(company.locator('[data-target="Argane Bail"]')).toContainText("Ne donne pas suite");
  await expect(company.locator("[data-offers-card]")).toContainText("1 offre reçue");
  const offerMail = await lastMail(await company.context().newPage(), c.ownerEmail);
  expect(offerMail.body).toContain(c.reference);

  // Retrait de l'offre : le bailleur peut à nouveau répondre.
  await cedre.getByRole("button", { name: "Retirer l’offre" }).click();
  await expect(cedre.getByRole("button", { name: "Envoyer l’offre" })).toBeVisible();
});

test("un bailleur non choisi ne voit pas le dossier", async ({ browser }) => {
  test.setTimeout(150_000);
  const c = await createReviewCase();
  await qualify(browser, c);
  const company = await (await browser.newContext()).newPage();
  await sendTo(company, c, ["Cèdre Leasing"]);

  const argane = await (await browser.newContext()).newPage();
  await signInPro(argane, "bailleur-b");
  await expect(argane).toHaveURL(/\/bailleur$/);
  await argane.goto("/bailleur?vue=tous");
  await expect(argane.locator(`[data-inbox-row="${c.reference}"]`)).toHaveCount(0);
  await expect(argane.getByText(c.companyName)).toHaveCount(0);
});

test("critères d'appétit et tableau de bord du bailleur", async ({ page }) => {
  await signInPro(page, "bailleur");
  await expect(page).toHaveURL(/\/bailleur$/);
  await page.getByRole("link", { name: "Critères d’appétit" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Critères d’appétit" })).toBeVisible();
  await expect(page.getByLabel("Montant minimum")).toHaveValue("100000");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Critères enregistrés.")).toBeVisible();
  await expect(page.getByText(/Dernière mise à jour le .* \(version \d+\)/)).toBeVisible();

  await page.getByRole("link", { name: "Tableau de bord" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await expect(page.getByText("Taux de réponse")).toBeVisible();
  await expectAccessible(page);
});

test("un analyste bailleur ne modifie pas les critères", async ({ page }) => {
  await signInPro(page, "bailleur-b");
  await expect(page).toHaveURL(/\/bailleur$/);
  await page.goto("/bailleur/criteres");
  await expect(
    page.getByText("Seul un administrateur de votre établissement peut modifier ces critères."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
});

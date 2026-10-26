/**
 * Phase 8 — mandats, commission à la mise en loyer, facture, encaissement,
 * facturation côté bailleur, pilotage et utilisateurs (back-office).
 */
import { expect, test } from "@playwright/test";
import { expectAccessible, resetRateLimitsBeforeEach, signInPro } from "./fixtures";
import { acceptOffer, offerAs, qualify, runDealToActive, sendTo } from "./flows";
import { pdfTexts } from "./pdf-text";
import { createReviewCase } from "./review-fixtures";

resetRateLimitsBeforeEach();

test("commission due à la mise en loyer, facturée, téléchargée, encaissée", async ({ browser }) => {
  test.setTimeout(240_000);
  const c = await createReviewCase();
  await qualify(browser, c);
  const company = await (await browser.newContext()).newPage();
  await sendTo(company, c, ["Cèdre Leasing"]);
  const cedre = await offerAs(browser, "bailleur", c, "8,5");
  await company.goto(`/entreprise/demandes/${c.requestId}/offres`);
  await acceptOffer(company, "Cèdre Leasing");
  await runDealToActive(cedre);

  // Administration : commission à facturer (650 000 DH : 7 500 + 150 000 × 1,2 % = 9 300).
  const admin = await (await browser.newContext()).newPage();
  await signInPro(admin, "admin");
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.getByRole("link", { name: "Commissions" }).first().click();
  const row = admin.locator(`[data-commission-row="${c.reference}"]`);
  await expect(row.locator("[data-commission-status]")).toHaveAttribute(
    "data-commission-status",
    "due",
  );
  await expect(row).toContainText(/9\s300,00/);
  await expectAccessible(admin);
  await row.getByRole("button", { name: "Émettre la facture" }).click();
  await expect(row).toHaveCount(0);
  await admin.goto("/admin/commissions?vue=facturees");
  const invoiced = admin.locator(`[data-commission-row="${c.reference}"]`);
  await expect(invoiced.locator("[data-commission-status]")).toHaveAttribute(
    "data-commission-status",
    "invoiced",
  );
  const link = invoiced.locator("[data-invoice]");
  const number = (await link.getAttribute("data-invoice")) ?? "";
  expect(number).toMatch(/^LP-F-\d{4}-\d{6}$/);
  const pdf = await admin.request.get((await link.getAttribute("href")) ?? "");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const texts = pdfTexts(new Uint8Array(await pdf.body())).join("\n");
  expect(texts).toContain(`N° ${number}`);
  expect(texts).toContain(`Demande ${c.reference}`);
  expect(texts).toContain("11 160,00 DH");

  // Le bailleur (administrateur) voit sa facture.
  await cedre.goto("/bailleur/facturation");
  await expect(cedre.locator("[data-lessor-mandate]")).toContainText("En vigueur");
  await expect(cedre.locator(`[data-commission-row="${c.reference}"]`)).toContainText(number);
  await expectAccessible(cedre);

  // Encaissement.
  await invoiced.getByRole("button", { name: "Encaisser" }).click();
  await invoiced.getByLabel("Référence du virement").fill("VIR-E2E-0001");
  await invoiced.getByRole("button", { name: "Confirmer l’encaissement" }).click();
  await expect(invoiced).toHaveCount(0);
  await admin.goto("/admin/commissions?vue=payees");
  await expect(
    admin.locator(`[data-commission-row="${c.reference}"] [data-commission-status]`),
  ).toHaveAttribute("data-commission-status", "paid");
  await cedre.reload();
  await expect(cedre.locator(`[data-commission-row="${c.reference}"]`)).toContainText("Payée");
});

test("nouvelle version de mandat : grille contrôlée, mise en vigueur, ancienne résiliée", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signInPro(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Bailleurs et mandats" }).first().click();
  const sahel = page.locator('[data-lessor-row="Sahel Équipement Bail"]');
  await expect(sahel).toContainText("En vigueur");
  await expectAccessible(page);
  await sahel.getByRole("link", { name: "Sahel Équipement Bail" }).click();
  const form = page.locator("[data-mandate-form]");
  const version = `MANDAT-E2E-${String(Date.now()).slice(-6)}`;
  await form.getByLabel("Version du contrat").fill(version);
  await form.getByLabel("Signé le").fill(new Date().toISOString().slice(0, 10));
  // Taux croissant : grille refusée, création impossible.
  await form.locator('[data-tier="1"]').getByLabel("Taux (%)").fill("2");
  await expect(form.getByText(/La grille est dégressive/)).toBeVisible();
  await expect(form.getByRole("button", { name: "Créer le brouillon" })).toBeDisabled();
  await form.locator('[data-tier="1"]').getByLabel("Taux (%)").fill("1,1");
  await form.getByRole("button", { name: "Créer le brouillon" }).click();
  const draft = page.locator('[data-mandate="draft"]').filter({ hasText: version });
  await expect(draft).toBeVisible();
  await draft.getByRole("button", { name: "Mettre en vigueur" }).click();
  await expect(page.locator('[data-mandate="active"]').filter({ hasText: version })).toBeVisible();
  await expect(page.locator('[data-mandate="active"]')).toHaveCount(1);
  await expect(page.locator('[data-mandate="terminated"]').first()).toBeVisible();
  await expectAccessible(page);
});

test("pilotage, utilisateurs et droits du back-office", async ({ browser }) => {
  test.setTimeout(90_000);
  const admin = await (await browser.newContext()).newPage();
  await signInPro(admin, "admin");
  await expect(admin).toHaveURL(/\/admin$/);
  const kpis = admin.locator("[data-kpis]");
  await expect(kpis).toBeVisible();
  await expect(kpis.locator('[data-stage="financed"]')).not.toContainText(/^Financées0/);
  await admin.getByRole("link", { name: "Utilisateurs" }).first().click();
  await expect(
    admin.locator('[data-user-row="youssef.alaoui@cedre-leasing.example"]'),
  ).toContainText("Cèdre Leasing");
  await expectAccessible(admin);

  // Opérations : pilotage et commissions en lecture, sans facturer ni gérer les utilisateurs.
  const ops = await (await browser.newContext()).newPage();
  await signInPro(ops, "ops");
  await expect(ops).toHaveURL(/\/admin$/);
  await expect(ops.locator("[data-kpis]")).toBeVisible();
  await ops.goto("/admin/commissions?vue=toutes");
  await expect(ops.locator("[data-commission-row]").first()).toBeVisible();
  await expect(ops.getByRole("button", { name: "Émettre la facture" })).toHaveCount(0);
  await ops.goto("/admin/utilisateurs");
  await expect(
    ops.getByText("La gestion des utilisateurs est réservée à l’administration de la plateforme."),
  ).toBeVisible();

  // Analyste bailleur : mandat visible, commissions réservées à l'administrateur.
  const analyst = await (await browser.newContext()).newPage();
  await signInPro(analyst, "bailleur-b");
  await expect(analyst).toHaveURL(/\/bailleur$/);
  await analyst.goto("/bailleur/facturation");
  await expect(analyst.locator("[data-lessor-mandate]")).toContainText("MANDAT-2026-01");
  await expect(
    analyst.getByText(/visibles par l’administrateur de votre établissement/),
  ).toBeVisible();
});

/**
 * Parcours réutilisés par les e2e des phases 6 et 7 : revue complète par
 * l'équipe, choix des bailleurs par l'entreprise, offre d'un bailleur.
 */
import { expect, type Browser, type Page } from "@playwright/test";
import { expectAccessible, signInCompanyWithCode, signInPro } from "./fixtures";
import type { ReviewCase } from "./review-fixtures";

/** Revue complète par l'équipe : analyse, indice fixé à A (motif), note validée, qualification. */
export async function qualify(browser: Browser, c: ReviewCase) {
  const page = await (await browser.newContext()).newPage();
  await signInPro(page, "ops");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(`/admin/dossiers/${c.requestId}`);
  await page.getByRole("button", { name: "Prendre en charge et analyser" }).click();
  await expect(page.locator("[data-grade]")).toBeVisible({ timeout: 20_000 });
  if ((await page.locator("[data-grade]").getAttribute("data-grade")) !== "A") {
    await page.getByText("Corriger l’indice (motif obligatoire)").click();
    await page.getByText("A", { exact: true }).click();
    await page
      .getByLabel("Motif")
      .fill("Garantie personnelle du dirigeant, carnet de commandes signé");
    await page.getByRole("button", { name: "Enregistrer la correction" }).click();
    await expect(page.locator("[data-grade]")).toHaveAttribute("data-grade", "A");
  }
  await page.getByRole("button", { name: "Rédiger la note" }).click();
  await expect(page.locator("[data-memo]")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Valider la note" }).click();
  await expect(page.getByText("Validée", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Qualifier le dossier" }).click();
  await expect(page.getByText("Dossier vérifié", { exact: true }).first()).toBeVisible();
  // Orientation calculée à la qualification, motifs d'exclusion visibles par l'équipe.
  const medina = page.locator('[data-routing-target="Médina Leasing"]');
  await expect(medina).toHaveAttribute("data-status", "excluded");
  await expect(medina).toContainText("Équipement non couvert");
  await expect(page.locator('[data-routing-target="Cèdre Leasing"]')).toHaveAttribute(
    "data-status",
    "eligible",
  );
  await page.context().close();
}

/** L'entreprise ne garde que les bailleurs voulus, consent et transmet. */
export async function sendTo(page: Page, c: ReviewCase, keep: readonly string[]) {
  await signInCompanyWithCode(page, c.ownerEmail);
  await expect(page).toHaveURL(/\/entreprise/);
  await page.goto(`/entreprise/demandes/${c.requestId}`);
  const chooser = page.locator("[data-routing]");
  await expect(chooser.getByRole("heading", { name: "Choisissez les bailleurs" })).toBeVisible();
  // Médina Leasing ne finance pas d'engins de chantier : jamais proposée.
  await expect(chooser.locator('[data-lessor="Médina Leasing"]')).toHaveCount(0);
  await expect(chooser.locator("[data-routing-consent]")).toContainText("sélectionnées ci-dessus");
  await expectAccessible(page);
  for (const label of await chooser.locator("[data-lessor]").all()) {
    const name = (await label.getAttribute("data-lessor")) ?? "";
    await label.getByRole("checkbox").setChecked(keep.includes(name));
  }
  await expect(page.getByText(`${String(keep.length)} sur 4`)).toBeVisible();
  const send = page.getByRole("button", { name: /^Transmettre à/ });
  await expect(send).toBeDisabled();
  await page.getByLabel(/J’ai lu ce texte et j’accepte la transmission/).check();
  await send.click();
  await expect(page.locator("[data-routed]")).toBeVisible();
  for (const name of keep)
    await expect(page.locator(`[data-target="${name}"]`)).toContainText("Reçu");
  await expect(page.getByText("Transmise aux bailleurs").first()).toBeVisible();
}

/** Offre d'un bailleur (compte de démonstration) au taux donné ; renvoie sa page. */
export async function offerAs(browser: Browser, key: string, c: ReviewCase, rate: string) {
  const page = await (await browser.newContext()).newPage();
  await signInPro(page, key);
  await expect(page).toHaveURL(/\/bailleur$/);
  await page
    .locator(`[data-inbox-row="${c.reference}"]`)
    .getByRole("link", { name: c.reference })
    .click();
  const form = page.locator("[data-response]");
  await form.getByLabel("Taux annuel").fill(rate);
  await expect(form.locator("[data-offer-preview]")).not.toContainText("—");
  await form.getByRole("button", { name: "Envoyer l’offre" }).click();
  await expect(page.locator("[data-offer-summary]")).toBeVisible();
  return page;
}

/** Acceptation d'une offre depuis le comparateur (case de confirmation comprise). */
export async function acceptOffer(page: Page, lessor: string) {
  const card = page.locator(`[data-offer="${lessor}"]`);
  await card.getByRole("button", { name: "Accepter cette offre" }).click();
  const confirm = card.locator("[data-accept-confirm]");
  await confirm.getByLabel("J’ai compris et je confirme mon choix.").check();
  await confirm.getByRole("button", { name: "Confirmer l’acceptation" }).click();
  await expect(page.getByText(`Vous avez accepté l’offre de ${lessor}.`)).toBeVisible();
}

/** Signature, livraison et mise en loyer constatées par le bailleur, sur sa fiche. */
export async function runDealToActive(page: Page) {
  await page.reload();
  const deal = page.locator("[data-deal-card]");
  await deal.getByRole("button", { name: "Enregistrer la signature" }).click();
  await expect(deal.locator("[data-deal]")).toHaveAttribute("data-deal", "signed");
  await deal.getByRole("button", { name: "Enregistrer la livraison" }).click();
  await expect(deal.locator("[data-deal]")).toHaveAttribute("data-deal", "delivered");
  await deal.getByRole("button", { name: "Enregistrer la mise en loyer" }).click();
  await expect(deal.locator("[data-deal]")).toHaveAttribute("data-deal", "active");
}

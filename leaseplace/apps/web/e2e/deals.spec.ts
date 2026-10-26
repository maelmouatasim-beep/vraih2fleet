/**
 * Phase 7 — comparateur, acceptation, opération jusqu'à la mise en loyer,
 * annulation avant signature, messagerie et notifications.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  account,
  expectAccessible,
  lastMail,
  resetRateLimitsBeforeEach,
  signInCompanyWithCode,
  signInPro,
} from "./fixtures";
import { offerAs, qualify, sendTo } from "./flows";
import { createReviewCase, type ReviewCase } from "./review-fixtures";

resetRateLimitsBeforeEach();

/** Dossier transmis à Cèdre et Argane, chacun avec une offre (Argane moins chère). */
async function withTwoOffers(browser: Browser) {
  const c = await createReviewCase();
  await qualify(browser, c);
  const company = await (await browser.newContext()).newPage();
  await sendTo(company, c, ["Cèdre Leasing", "Argane Bail"]);
  const cedre = await offerAs(browser, "bailleur", c, "8,9");
  const argane = await offerAs(browser, "bailleur-b", c, "7,5");
  return { c, company, cedre, argane };
}

async function openComparator(page: Page, c: ReviewCase) {
  await page.goto(`/entreprise/demandes/${c.requestId}`);
  await expect(page.locator("[data-offers-card]")).toContainText("2 offres reçues");
  await page.getByRole("link", { name: "Comparer les offres" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Comparer les offres" })).toBeVisible();
}

async function accept(page: Page, lessor: string) {
  const card = page.locator(`[data-offer="${lessor}"]`);
  await card.getByRole("button", { name: "Accepter cette offre" }).click();
  const confirm = card.locator("[data-accept-confirm]");
  await expect(confirm.getByRole("button", { name: "Confirmer l’acceptation" })).toBeDisabled();
  await confirm.getByLabel("J’ai compris et je confirme mon choix.").check();
  await confirm.getByRole("button", { name: "Confirmer l’acceptation" }).click();
  await expect(page.getByText(`Vous avez accepté l’offre de ${lessor}.`)).toBeVisible();
}

test("comparer, accepter, suivre jusqu'à la mise en loyer", async ({ browser }) => {
  test.setTimeout(240_000);
  const { c, company, cedre, argane } = await withTwoOffers(browser);

  // Comparateur : classement neutre par coût total, badge, tri, tableau, simulation.
  await openComparator(company, c);
  const cards = company.locator("[data-offer]");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAttribute("data-offer", "Argane Bail");
  await expect(cards.first()).toContainText("Meilleur coût total");
  await expect(company.getByText(/Aucune position n’est sponsorisée/)).toBeVisible();
  await expectAccessible(company);
  await company.getByRole("radio", { name: "Tableau" }).check({ force: true });
  await expect(company.locator("[data-offer-table] tbody tr")).toHaveCount(2);
  await company.getByRole("radio", { name: "Cartes" }).check({ force: true });
  await company.getByLabel("Durée", { exact: true }).selectOption("72");
  await expect(company.locator("[data-simulation-table] tbody tr")).toHaveCount(2);
  await expect(company.getByText(/Estimation indicative/)).toBeVisible();
  await expectAccessible(company);

  // Acceptation de l'offre d'Argane : celle de Cèdre devient « non retenue ».
  await accept(company, "Argane Bail");
  await expect(company.locator('[data-offer="Cèdre Leasing"]')).toContainText("Non retenue");
  await company.goto(`/entreprise/demandes/${c.requestId}`);
  await expect(company.locator("[data-tracker]")).toHaveAttribute("data-tracker", "signed");
  await expect(company.locator("[data-deal-card]")).toContainText("Argane Bail");

  // Cèdre est prévenu et voit son offre non retenue.
  await cedre.reload();
  await expect(cedre.locator('[data-offer-status="not_retained"]')).toBeVisible();

  // Argane constate signature, livraison, mise en loyer (montant définitif).
  await argane.reload();
  await expect(argane.locator('[data-offer-status="accepted"]')).toBeVisible();
  await expect(argane.locator("[data-bell]")).not.toHaveAttribute("data-bell", "0");
  const deal = argane.locator("[data-deal-card]");
  await deal.getByRole("button", { name: "Enregistrer la signature" }).click();
  await expect(deal.locator("[data-deal]")).toHaveAttribute("data-deal", "signed");
  await deal.getByRole("button", { name: "Enregistrer la livraison" }).click();
  await expect(deal.locator("[data-deal]")).toHaveAttribute("data-deal", "delivered");
  await deal.getByLabel("Montant financé définitif HT").fill("640000");
  await deal.getByRole("button", { name: "Enregistrer la mise en loyer" }).click();
  await expect(deal.locator("[data-deal]")).toHaveAttribute("data-deal", "active");
  await expect(deal).toContainText(/640\s000/);
  await expectAccessible(argane);
  await argane.goto("/bailleur/pipeline?vue=mis-en-loyer");
  await expect(argane.locator(`[data-pipeline-row="${c.reference}"]`)).toContainText(
    "Mis en loyer",
  );
  await expectAccessible(argane);

  // L'entreprise : demande financée, suivi terminé, notification qui mène à la demande.
  await company.goto("/entreprise/notifications");
  await company.locator('[data-notification="deal_activated"]').first().click();
  await expect(company).toHaveURL(new RegExp(`/entreprise/demandes/${c.requestId}$`));
  await expect(company.locator("[data-tracker]")).toHaveAttribute("data-tracker", "done");
  await expect(company.getByText("Financée").first()).toBeVisible();
});

test("annulation par l'entreprise avant signature : les autres offres reviennent", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { c, company, cedre } = await withTwoOffers(browser);
  await openComparator(company, c);
  await accept(company, "Cèdre Leasing");
  await company.goto(`/entreprise/demandes/${c.requestId}`);
  const cancel = company.locator("[data-deal-cancel]");
  await cancel.getByText("Renoncer à cette offre").click();
  await cancel.getByLabel("Autre motif", { exact: true }).check();
  await cancel.getByRole("button", { name: "Confirmer l’annulation" }).click();
  await expect(cancel.getByText("Précisez le motif (10 caractères au moins).")).toBeVisible();
  await cancel.getByLabel("Financé autrement").check();
  await cancel.getByRole("button", { name: "Confirmer l’annulation" }).click();
  await expect(company.locator("[data-deal]")).toHaveAttribute("data-deal", "cancelled");
  await expect(company.locator("[data-tracker]")).toHaveAttribute("data-tracker", "accepted");

  // Cèdre est prévenu ; l'offre d'Argane peut être acceptée.
  const mail = await lastMail(await cedre.context().newPage(), account("bailleur").email);
  expect(mail.body).toContain(c.reference);
  await company.goto(`/entreprise/demandes/${c.requestId}/offres`);
  await accept(company, "Argane Bail");
});

test("questions et réponses, coordonnées signalées, non-lus", async ({ browser }) => {
  test.setTimeout(180_000);
  const c = await createReviewCase();
  await qualify(browser, c);
  const company = await (await browser.newContext()).newPage();
  await sendTo(company, c, ["Cèdre Leasing"]);

  await company.goto("/entreprise/messages");
  await company
    .locator('[data-thread-row="Cèdre Leasing"]')
    .filter({ hasText: c.reference })
    .click();
  const box = company.getByLabel("Votre message");
  await box.fill("Pouvez-vous me rappeler au 06 12 34 56 78 ?");
  await expect(company.locator("[data-contact-warning]")).toBeVisible();
  await box.fill("Le devis inclut-il la formation des conducteurs ?");
  await expect(company.locator("[data-contact-warning]")).toHaveCount(0);
  await company.getByRole("button", { name: "Envoyer" }).click();
  await expect(company.locator('[data-message="mine"]')).toContainText("formation des conducteurs");
  await expectAccessible(company);

  const cedre = await (await browser.newContext()).newPage();
  await signInPro(cedre, "bailleur");
  await expect(cedre).toHaveURL(/\/bailleur$/);
  const row = cedre.locator(`[data-inbox-row="${c.reference}"]`);
  await expect(row.locator("[data-unread-messages]")).toContainText("1 message");
  await row.getByRole("link", { name: c.reference }).click();
  const thread = cedre.locator("[data-messages]");
  await expect(thread.locator('[data-message="theirs"]')).toContainText(
    "formation des conducteurs",
  );
  await thread.getByLabel("Votre message").fill("Oui, une journée de formation est incluse.");
  await thread.getByRole("button", { name: "Envoyer" }).click();
  await expect(thread.locator('[data-message="mine"]')).toContainText("journée de formation");
  await cedre.goto("/bailleur");
  await expect(
    cedre.locator(`[data-inbox-row="${c.reference}"] [data-unread-messages]`),
  ).toHaveCount(0);

  await company.goto("/entreprise/messages");
  await expect(
    company.locator('[data-thread-row="Cèdre Leasing"]').filter({ hasText: c.reference }),
  ).toContainText("1 non lu");
  await expect(company.locator("[data-bell]")).not.toHaveAttribute("data-bell", "0");
});

test("préférences : SMS sur un mobile marocain pour les étapes importantes", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const c = await createReviewCase();
  await qualify(browser, c);
  const company = await (await browser.newContext()).newPage();
  await sendTo(company, c, ["Cèdre Leasing"]);
  await company.goto("/entreprise/notifications");
  const form = company.locator("[data-preferences]");
  await form.getByLabel("Par SMS").check();
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    form.getByText("Indiquez un numéro de mobile pour le SMS ou WhatsApp."),
  ).toBeVisible();
  await form.getByLabel("Numéro de mobile").fill("05 22 12 34 56");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByText(/Numéro invalide/)).toBeVisible();
  await form.getByLabel("Numéro de mobile").fill("06 61 23 45 67");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(form.getByText("Préférences enregistrées.")).toBeVisible();
  await expectAccessible(company);

  await offerAs(browser, "bailleur", c, "8,5");
  const outbox = await (await browser.newContext()).newPage();
  await outbox.goto("/demo/boite-mail");
  const sms = outbox.locator('[data-outbox-channel="sms"][data-outbox-to="+212661234567"]').first();
  await expect(sms).toContainText(c.reference);
  await expect(sms).toContainText("Cèdre Leasing");
});

test("pipeline de démonstration : chaque bailleur ne voit que ses opérations", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  // Seed : une offre de Cèdre acceptée par Atlas, contrat signé.
  const cedre = await (await browser.newContext()).newPage();
  await signInPro(cedre, "bailleur");
  await expect(cedre).toHaveURL(/\/bailleur$/);
  await cedre.getByRole("link", { name: "Pipeline" }).first().click();
  const atlas = cedre.locator("[data-pipeline-row]").filter({ hasText: "Atlas Transports" });
  await expect(atlas).toContainText("Contrat signé");
  await expect(atlas).toContainText("Prochaine étape : livraison du matériel");
  await expectAccessible(cedre);
  const argane = await (await browser.newContext()).newPage();
  await signInPro(argane, "bailleur-b");
  await expect(argane).toHaveURL(/\/bailleur$/);
  await argane.goto("/bailleur/pipeline");
  await expect(
    argane.locator("[data-pipeline-row]").filter({ hasText: "Atlas Transports" }),
  ).toHaveCount(0);
});

test("compte de démonstration : trois offres à comparer, un échange en cours", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const company = await (await browser.newContext()).newPage();
  await signInCompanyWithCode(company);
  await expect(company).toHaveURL(/\/entreprise$/);
  await company.goto("/entreprise/demandes");
  await company.getByRole("link", { name: /Deux semi-remorques frigorifiques/ }).click();
  await expect(company.locator("[data-offers-card]")).toContainText("3 offres reçues");
  await company.getByRole("link", { name: "Comparer les offres" }).click();
  await expect(company.locator("[data-offer]")).toHaveCount(3);
  await expect(company.locator("[data-offer]").first()).toContainText("Meilleur coût total");
  await company.goto("/entreprise/messages");
  await expect(company.locator('[data-thread-row="Cèdre Leasing"]').first()).toContainText(
    "groupes frigorifiques",
  );
});

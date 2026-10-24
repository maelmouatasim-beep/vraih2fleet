/**
 * Phase 4 — parcours PME complet : inscription par code, onboarding,
 * coffre-fort KYC (dont un fichier EICAR bloqué), assistant de demande avec
 * sauvegarde automatique, consentement, soumission, historique ; puis
 * cloisonnement des téléchargements entre entreprises.
 */
import { randomBytes, randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { EICAR_TEST_STRING } from "@leaseplace/integrations/scanner";
import { signDocumentUrl, signingKey } from "../src/lib/signed-url";
import { expectAccessible, resetRateLimitsBeforeEach, signInCompanyWithCode } from "./fixtures";

resetRateLimitsBeforeEach();
test.describe.configure({ mode: "serial" });

const RUN = randomBytes(4).toString("hex");
const EMAIL = `nadia.${RUN}@pme-e2e.example`;
const ICE = Array.from({ length: 15 }, () => String(randomInt(10))).join("");
const TODAY = new Date().toISOString().slice(0, 10);

/** PDF minimal, unique par exécution (le coffre-fort refuse les doublons). */
function pdf(label: string, extra = ""): { name: string; mimeType: string; buffer: Buffer } {
  return {
    name: `${label}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4\n% ${label} ${RUN}\n${extra}\n%%EOF\n`, "latin1"),
  };
}

async function uploadMissingRequirements(page: Page) {
  for (let i = 0; i < 20; i++) {
    const item = page.locator('[data-requirement]:not([data-state="ok"])').first();
    if ((await item.count()) === 0) return;
    const type = (await item.getAttribute("data-requirement")) ?? "doc";
    await item.locator("summary").click();
    await item.getByLabel("Fichier").setInputFiles(pdf(type));
    const date = item.getByLabel("Date de délivrance");
    if ((await date.count()) > 0) await date.fill(TODAY);
    await item.getByRole("button", { name: "Déposer" }).click();
    await expect(page.locator(`[data-requirement="${type}"]`)).toHaveAttribute("data-state", "ok");
  }
  throw new Error("pièces exigées jamais complètes");
}

let documentHref = "";
let documentId = "";

test("inscription par code, onboarding, coffre-fort, demande soumise", async ({ page }) => {
  // Inscription : le code crée le compte, puis l'onboarding rattache l'entreprise.
  await signInCompanyWithCode(page, EMAIL);
  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Votre nom complet").fill("Nadia Berrada");
  await page.getByLabel("Raison sociale").fill(`Berrada Matériel ${RUN} SARL`);
  await page.getByLabel("ICE", { exact: true }).fill(ICE);
  await page.getByLabel("Ville").fill("Tanger");
  await page.getByLabel("Date de création").fill("2018-05-14");
  await page.getByRole("button", { name: "Créer mon espace" }).click();
  await expect(page).toHaveURL(/\/entreprise$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Nadia");

  // Coffre-fort : toutes les pièces exigées pour une SARL de plus de 12 mois.
  await page.getByRole("link", { name: "Coffre-fort" }).first().click();
  await expect(page).toHaveURL(/\/entreprise\/coffre-fort$/);
  await expect(page.locator('[data-requirement="tax_returns"]')).toBeVisible();
  await uploadMissingRequirements(page);
  await expect(page.getByText("Dossier complet")).toBeVisible();
  await expectAccessible(page);

  // Un fichier infecté (signature de test EICAR) est bloqué et jamais conservé.
  const other = page.getByRole("heading", { name: "Ajouter un autre document" }).locator("..");
  await other.getByLabel("Fichier").setInputFiles(pdf("eicar", EICAR_TEST_STRING));
  await other.getByRole("button", { name: "Déposer" }).click();
  await expect(other.getByText("bloqué par l’analyse antivirus")).toBeVisible();
  await expect(page.locator('[data-document="eicar.pdf"]')).toContainText("Bloqué");
  await expect(
    page.locator('[data-document="eicar.pdf"]').getByRole("link", { name: /Télécharger/ }),
  ).toHaveCount(0);

  // Téléchargement signé d'une pièce saine.
  const link = page.locator('[data-document="rc_extract.pdf"]').getByRole("link");
  documentHref = (await link.getAttribute("href")) ?? "";
  documentId = /\/api\/documents\/([0-9a-f-]{36})/.exec(documentHref)?.[1] ?? "";
  expect(documentId).not.toBe("");
  const download = await page.request.get(documentHref);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect((await download.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Assistant de demande.
  await page.goto("/entreprise");
  await page.getByRole("button", { name: "Nouvelle demande" }).click();
  await expect(page).toHaveURL(/\/entreprise\/demandes\/[0-9a-f-]{36}$/);
  await page.getByText("Poids lourd", { exact: true }).click();
  await page
    .getByLabel("Description")
    .fill("Tracteur routier 4x2, 460 ch, pour la ligne Tanger–Casablanca");
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  // Sauvegarde automatique : rien n'est perdu au rechargement, et
  // l'assistant reprend à la première étape incomplète (Financement).
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "Financement" })).toBeVisible();
  await page.getByRole("button", { name: "Équipement" }).click();
  await expect(page.getByLabel("Description")).toHaveValue(/Tracteur routier/);
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Montant hors taxes").fill("850 000");
  await page.getByLabel("Montant hors taxes").blur();
  await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByLabel("Fichier").setInputFiles(pdf("devis-tracteur"));
  await page.getByRole("button", { name: "Déposer" }).click();
  await expect(page.locator('[data-quote="devis-tracteur.pdf"]')).toBeVisible();

  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.locator("[data-consent-text]")).toContainText("loi 09-08");
  await page.getByLabel("J’ai lu et j’accepte ce traitement.").check();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByText("Tout est prêt")).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Soumettre la demande" }).click();

  // Demande soumise : historique et preuve du consentement.
  await expect(page.getByText("Soumise", { exact: true })).toBeVisible();
  await expect(page.locator("[data-timeline]")).toContainText("Demande soumise");
  await expect(
    page.getByText(/Consentement donné le .* \(texte version 2026-10-22\)/),
  ).toBeVisible();
  await expect(page.getByText("devis-tracteur.pdf")).toBeVisible();
  await expectAccessible(page);

  // Une pièce jointe à une demande soumise ne peut plus être supprimée.
  await page.goto("/entreprise/coffre-fort");
  page.once("dialog", (d) => void d.accept());
  await page
    .locator('[data-document="devis-tracteur.pdf"]')
    .getByRole("button", { name: /Supprimer/ })
    .click();
  await expect(page.getByText("fait partie d’une demande soumise")).toBeVisible();
});

test("une autre entreprise ne peut pas télécharger ces documents", async ({ page }) => {
  expect(documentId).not.toBe("");
  await signInCompanyWithCode(page);
  await expect(page).toHaveURL(/\/entreprise$/);

  // Lien émis pour un autre utilisateur : signature refusée.
  expect((await page.request.get(documentHref)).status()).toBe(403);

  // Lien correctement signé pour cet utilisateur : la RLS cache le document.
  const secret = process.env.BETTER_AUTH_SECRET;
  test.skip(!secret, "BETTER_AUTH_SECRET requis pour signer un lien");
  const me = (await (await page.request.get("/api/auth/get-session")).json()) as {
    user: { id: string };
  };
  const forged = signDocumentUrl(signingKey(secret ?? ""), documentId, me.user.id);
  expect((await page.request.get(forged)).status()).toBe(404);
});

test("sans session, un lien de téléchargement ne sert à rien", async ({ request }) => {
  expect(documentHref).not.toBe("");
  expect((await request.get(documentHref)).status()).toBe(401);
});

test("assistant de demande sur mobile @mobile", async ({ page }) => {
  await signInCompanyWithCode(page);
  await expect(page).toHaveURL(/\/entreprise$/);
  await page.goto("/entreprise/demandes");
  await expectAccessible(page);
  await page.getByRole("button", { name: "Nouvelle demande" }).click();
  await expect(page).toHaveURL(/\/entreprise\/demandes\/[0-9a-f-]{36}$/);
  // Navigation collée en bas de l'écran sur mobile.
  if ((page.viewportSize()?.width ?? 1280) < 768)
    await expect(page.getByRole("button", { name: "Suivant" })).toBeInViewport();
  await expect(page.locator('[aria-current="step"]')).toHaveText(/Équipement/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectAccessible(page);
});

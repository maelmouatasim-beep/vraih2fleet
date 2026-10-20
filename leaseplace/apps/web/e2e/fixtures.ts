import { expect, test, type Page } from "@playwright/test";
import { createDatabase, schema } from "@leaseplace/db";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoAccount } from "../src/lib/demo-accounts";
import { currentTotp } from "../src/lib/totp";

export const ENROLMENT_EMAIL = "omar.nouveau@cedre-leasing.example";

export function account(key: string): DemoAccount {
  const a = DEMO_ACCOUNTS.find((x) => x.key === key);
  if (!a) throw new Error(`compte de démo inconnu : ${key}`);
  return a;
}

/** Connexion bailleur / plateforme : mot de passe puis code TOTP. */
export async function signInPro(page: Page, key: string) {
  const a = account(key);
  await page.goto("/connexion");
  await page.getByRole("tab", { name: "Bailleur ou équipe" }).click();
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(a.email);
  await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByLabel("Code d’authentification")).toBeVisible();
  await page.getByLabel("Code d’authentification").fill(currentTotp(a.totpSecret ?? ""));
  await page.getByRole("button", { name: "Vérifier" }).click();
}

/** Dernier courriel déposé pour `to` dans la boîte d'envoi de démonstration. */
export async function lastMail(page: Page, to: string) {
  await page.goto("/demo/boite-mail");
  const card = page.locator(`[data-outbox-to="${to}"]`).first();
  await expect(card).toBeVisible();
  const link = card.locator('[data-field="link"]');
  return {
    body: (await card.locator('[data-field="body"]').textContent()) ?? "",
    link: (await link.count()) > 0 ? await link.getAttribute("href") : null,
  };
}

export async function signInCompanyWithCode(page: Page) {
  const a = account("entreprise");
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail professionnelle").fill(a.email);
  await page.getByRole("button", { name: "Recevoir un code à 6 chiffres" }).click();
  await expect(page.getByLabel("Code reçu par e-mail")).toBeVisible();
  const context = page.context();
  const mailbox = await context.newPage();
  const { body } = await lastMail(mailbox, a.email);
  await mailbox.close();
  const code = /\b(\d{6})\b/.exec(body)?.[1];
  expect(code, "code à 6 chiffres dans le courriel").toBeTruthy();
  await page.getByLabel("Code reçu par e-mail").fill(code ?? "");
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/**
 * Chaque test repart d'un compteur de limitation de débit vide : les tests
 * enchaînent plus de 5 connexions par minute depuis la même adresse.
 * (La limitation elle-même est vérifiée par un test dédié.)
 */
export function resetRateLimitsBeforeEach() {
  test.beforeEach(async () => {
    const { db, close } = createDatabase(process.env.DATABASE_URL_ADMIN ?? "", { max: 1 });
    try {
      await db.delete(schema.rateLimits);
    } finally {
      await close();
    }
  });
}

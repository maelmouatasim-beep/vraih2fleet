import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { Secret, TOTP } from "otpauth";
import { DEMO_PASSWORD } from "../src/lib/demo-accounts";
import {
  account,
  ENROLMENT_EMAIL,
  lastMail,
  resetRateLimitsBeforeEach,
  signInCompanyWithCode,
  signInPro,
} from "./fixtures";

resetRateLimitsBeforeEach();

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test.describe("public", () => {
  test("accueil en français, sans erreur de CSP @mobile", async ({ page }) => {
    const cspErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /Content Security Policy/i.test(m.text()))
        cspErrors.push(m.text());
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Mettez les bailleurs en concurrence",
    );
    await expectAccessible(page);
    expect(cspErrors).toEqual([]);
  });

  test("arabe : sens de lecture de droite à gauche", async ({ page }) => {
    await page.goto("/ar");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("اجعل المؤجرين يتنافسون");
    await expectAccessible(page);
  });

  test("anglais", async ({ page }) => {
    await page.goto("/en/connexion");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  });

  test("un espace sans session renvoie vers la connexion", async ({ page }) => {
    await page.goto("/bailleur");
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fbailleur/);
    await expectAccessible(page);
  });
});

test.describe("entreprise", () => {
  test("connexion par code e-mail puis espace guidé @mobile", async ({ page }) => {
    await signInCompanyWithCode(page);
    await expect(page).toHaveURL(/\/entreprise$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Salma");
    await expect(
      page.getByRole("main").getByText("Atlas Transports Logistique SARL"),
    ).toBeVisible();
    await expectAccessible(page);
  });

  test("connexion par lien magique", async ({ page }) => {
    const a = account("entreprise");
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail professionnelle").fill(a.email);
    await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
    await expect(page.getByText("un lien de connexion vient de lui être envoyé")).toBeVisible();
    const { link } = await lastMail(page, a.email);
    expect(link).toContain("/api/auth/magic-link/verify");
    await page.goto(link ?? "");
    await expect(page).toHaveURL(/\/entreprise$/);
  });

  test("une entreprise n'entre ni chez un bailleur ni au back-office", async ({ page }) => {
    await signInCompanyWithCode(page);
    await expect(page).toHaveURL(/\/entreprise$/);
    await page.goto("/bailleur");
    await expect(page).toHaveURL(/\/acces-refuse\?espace=lessor/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/acces-refuse\?espace=admin/);
  });
});

test.describe("bailleur", () => {
  test("mot de passe + TOTP, boîte de réception, palette ⌘K", async ({ page }) => {
    await signInPro(page, "bailleur");
    await expect(page).toHaveURL(/\/bailleur$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Boîte de réception");
    await expect(page.getByText("Aucun dossier routé vers vous")).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByPlaceholder("Tapez une commande ou une page…")).toBeVisible();
    await page.keyboard.type("sombre");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectAccessible(page);
  });

  test("un bailleur n'entre ni dans l'espace entreprise ni au back-office", async ({ page }) => {
    await signInPro(page, "bailleur");
    await expect(page).toHaveURL(/\/bailleur$/);
    await page.goto("/entreprise");
    await expect(page).toHaveURL(/\/acces-refuse\?espace=company/);
    await page.goto("/admin/journal");
    await expect(page).toHaveURL(/\/acces-refuse\?espace=admin/);
  });

  test("ni lien magique ni code e-mail pour un compte à 2FA obligatoire", async ({ page }) => {
    const a = account("bailleur");
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail professionnelle").fill(a.email);
    await page.getByRole("button", { name: "Recevoir un code à 6 chiffres" }).click();
    // Même réponse qu'un compte valide (pas d'énumération)…
    await expect(page.getByLabel("Code reçu par e-mail")).toBeVisible();
    // …mais aucun courriel n'est parti.
    await page.goto("/demo/boite-mail");
    await expect(page.locator(`[data-outbox-to="${a.email}"]`)).toHaveCount(0);
  });

  test("limitation de débit : la 6e tentative en une minute est refusée", async ({ page }) => {
    const a = account("bailleur-b");
    await page.goto("/connexion");
    await page.getByRole("tab", { name: "Bailleur ou équipe" }).click();
    await page.getByLabel("Adresse e-mail", { exact: true }).fill(a.email);
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: "Continuer" }).click();
      await expect(page.getByRole("tabpanel").getByRole("alert")).toHaveText(
        "Identifiants incorrects.",
      );
    }
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByRole("tabpanel").getByRole("alert")).toHaveText(
      "Trop de tentatives. Réessayez dans une minute.",
    );
  });

  test("mot de passe sans le code TOTP : aucune session", async ({ page }) => {
    const a = account("bailleur-b");
    await page.goto("/connexion");
    await page.getByRole("tab", { name: "Bailleur ou équipe" }).click();
    await page.getByLabel("Adresse e-mail", { exact: true }).fill(a.email);
    await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByLabel("Code d’authentification")).toBeVisible();
    await page.goto("/bailleur");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("premier accès : enrôlement 2FA imposé, puis espace", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByRole("tab", { name: "Bailleur ou équipe" }).click();
    await page.getByLabel("Adresse e-mail", { exact: true }).fill(ENROLMENT_EMAIL);
    await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page).toHaveURL(/\/securite\/double-authentification$/);
    // Tant que la 2FA n'est pas active, l'espace reste fermé.
    await page.goto("/bailleur");
    await expect(page).toHaveURL(/\/securite\/double-authentification$/);
    await page.getByLabel("Confirmez votre mot de passe").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Commencer" }).click();
    const qr = page.getByRole("img", { name: "QR code de configuration de l’authentification" });
    await expect(qr).toBeVisible();
    await expectAccessible(page);
    const key = (await page.locator('[data-field="totp-secret"]').textContent()) ?? "";
    const code = new TOTP({
      secret: Secret.fromBase32(key.replace(/\s/g, "")),
      digits: 6,
      period: 30,
    }).generate();
    await page.getByLabel("Code à 6 chiffres").fill(code);
    await page.getByRole("button", { name: "Activer" }).click();
    await expect(page.getByText("Double authentification activée.")).toBeVisible();
    await page.getByRole("button", { name: "Accéder à mon espace" }).click();
    await expect(page).toHaveURL(/\/bailleur$/);
  });
});

test.describe("plateforme", () => {
  test("opérations : back-office et organisations de toute la plateforme", async ({ page }) => {
    await signInPro(page, "ops");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vue d’ensemble");
    for (const name of ["Atlas Transports Logistique SARL", "Cèdre Leasing", "Argane Bail"]) {
      await expect(page.getByRole("cell", { name })).toBeVisible();
    }
    await expectAccessible(page);
  });

  test("administrateur : journal d'audit chaîné, connexions et refus tracés", async ({ page }) => {
    await signInPro(page, "admin");
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Journal d’audit" }).first().click();
    await expect(page).toHaveURL(/\/admin\/journal$/);
    await expect(page.getByText("Chaîne intègre")).toBeVisible();
    await expect(page.getByRole("cell", { name: "auth.sign_in" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "space.access_denied" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "auth.two_factor_enabled" }).first()).toBeVisible();
    await expectAccessible(page);
  });
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { resetRateLimitsBeforeEach, signInPro } from "./fixtures";

resetRateLimitsBeforeEach();

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
  ).toEqual([]);
}

test.describe("landing", () => {
  test("promesse, simulateur rapide au-dessus de la ligne de flottaison @mobile", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Mettez les bailleurs en concurrence. Gratuitement.",
    );
    const rent = page.getByTestId("loyer-rapide");
    await expect(rent).toBeInViewport();
    await expectAccessible(page);
  });

  test("le simulateur rapide ouvre la simulation détaillée avec les mêmes paramètres", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("slider", { name: "Durée" }).focus();
    await page.keyboard.press("ArrowLeft");
    const rent = (await page.getByTestId("loyer-rapide").textContent()) ?? "";
    await page.getByRole("link", { name: "Simulation détaillée" }).click();
    await expect(page).toHaveURL(/\/simulateur\?months=54/);
    const strip = (s: string) => s.replace(/[^\d]/g, "");
    expect(strip((await page.getByTestId("loyer").textContent()) ?? "")).toContain(
      strip(rent).slice(0, 4),
    );
  });

  test("SEO : canonique, hreflang, JSON-LD FAQ", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en$/);
    for (const l of ["fr", "ar", "en", "x-default"]) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${l}"]`)).toHaveCount(1);
    }
    const ld = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "[]",
    ) as { "@type": string }[];
    expect(ld.map((x) => x["@type"])).toEqual(["Organization", "WebSite", "FAQPage"]);
  });

  test("robots et sitemap", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /"); // mode démo : rien d'indexé
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/ar/secteurs/transport");
    expect(sitemap).toContain('hreflang="en"');
  });
});

test.describe("secteurs", () => {
  for (const [slug, title] of [
    ["transport", "Crédit-bail pour le transport et la logistique"],
    ["btp", "Crédit-bail pour le BTP et les travaux publics"],
    ["medical", "Crédit-bail pour le matériel médical"],
  ] as const) {
    test(`page ${slug}`, async ({ page }) => {
      await page.goto(`/secteurs/${slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByTestId("loyer-rapide")).toBeVisible();
      await expectAccessible(page);
    });
  }

  test("secteur inconnu : 404", async ({ page }) => {
    const res = await page.goto("/secteurs/aviation");
    expect(res?.status()).toBe(404);
  });
});

test.describe("bailleurs", () => {
  test("une demande de contact arrive au back-office", async ({ page, browser }) => {
    const org = `Banque Test ${String(Date.now())}`;
    await page.goto("/bailleurs");
    await expectAccessible(page);
    await page.getByLabel("Établissement").fill(org);
    await page.getByLabel("Nom et prénom").fill("Leïla Bennani");
    await page
      .getByLabel("Adresse e-mail professionnelle")
      .fill(`leila.${String(Date.now())}@banque.example`);
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("consentement");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Merci, votre demande est enregistrée.")).toBeVisible();

    const ops = await (await browser.newContext()).newPage();
    await signInPro(ops, "ops");
    await ops.waitForURL(/\/admin$/);
    await ops.goto("/admin/contacts");
    await expect(ops.getByRole("cell", { name: org })).toBeVisible();
  });

  test("mentions légales : brouillon signalé", async ({ page }) => {
    await page.goto("/mentions-legales");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Mentions légales et confidentialité",
    );
    await expect(page.getByText(/Document provisoire/)).toBeVisible();
  });
});

test("aucune variable de traduction non remplacée sur les pages publiques", async ({ page }) => {
  for (const path of [
    "/",
    "/en",
    "/ar",
    "/simulateur",
    "/bailleurs",
    "/secteurs/btp",
    "/mentions-legales",
  ]) {
    await page.goto(path);
    for (const d of await page.locator("details").all())
      await d.evaluate((el) => {
        (el as HTMLDetailsElement).open = true;
      });
    const text = await page.locator("body").innerText();
    // Variable ICU brute, variable manquante (« (brand) ») ou clé de traduction affichée.
    expect(text, path).not.toMatch(
      /\{\w+\}|\((brand|name|amount|rate|year|sector|letter|n)\)|\b(landing|sectors|lessorsPage|legalPage|marketing|simulator|common)\.[\w.]+/,
    );
  }
});

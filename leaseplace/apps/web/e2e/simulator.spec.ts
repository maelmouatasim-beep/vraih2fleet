import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const norm = (s: string | null) =>
  (s ?? "").replace(/[\u00a0\u202f]/g, " ").replace(/[\u2066\u2069]/g, "");

test.describe("simulateur public", () => {
  test("cas de référence : 500 000 DH, 36 mois, 7,5 %, échu → 15 553,11 DH @mobile", async ({
    page,
  }) => {
    await page.goto(
      "/simulateur?amount=500000&months=36&timing=arrears&firstRentPct=0&residualPct=0&ratePct=7.5",
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Combien coûte vraiment");
    expect(norm(await page.getByTestId("loyer").textContent())).toBe("15 553,11 DH");
    await expect(page.getByText(/7,76\s%/)).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id),
    ).toEqual([]);
  });

  test("changer la durée au clavier recalcule et met à jour l'URL", async ({ page }) => {
    await page.goto(
      "/simulateur?amount=500000&months=36&timing=arrears&firstRentPct=0&residualPct=0&ratePct=7.5",
    );
    const before = await page.getByTestId("loyer").textContent();
    await page.getByRole("slider", { name: "Durée" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/months=42/);
    await expect(page.getByTestId("loyer")).not.toHaveText(before ?? "");
  });

  test("saisie libre du montant et échéancier complet", async ({ page }) => {
    await page.goto("/simulateur?months=24&firstRentPct=0");
    const amount = page.getByRole("textbox", { name: "Montant de l’équipement (HT)" });
    await amount.fill("2 400 000");
    await amount.press("Enter");
    await expect(page).toHaveURL(/amount=2400000/);
    await page.getByText(/Échéancier \(\d+ échéances\)/).click();
    await expect(page.locator("tbody tr")).toHaveCount(25);
  });

  test("arabe : de droite à gauche, chiffres latins", async ({ page }) => {
    await page.goto(
      "/ar/simulateur?amount=500000&months=36&timing=arrears&firstRentPct=0&residualPct=0&ratePct=7.5",
    );
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(norm(await page.getByTestId("loyer").textContent())).toBe("15 553,11 DH");
  });

  test("lien partagé invalide : valeurs par défaut, aucune erreur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/simulateur?amount=-5&months=7&ratePct=abc");
    await expect(page.getByTestId("loyer")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

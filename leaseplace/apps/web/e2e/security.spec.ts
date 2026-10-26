/**
 * Phase 9 — tests de pénétration de base (OWASP) contre l'application
 * réelle : en-têtes, accès sans session, IDOR entre organisations, CSRF,
 * XSS stockée, redirection ouverte, injection dans les paramètres, cookies
 * de session, garde-fous de la route d'analyse. Le détail et les résultats
 * sont consignés dans docs/securite/audit-asvs-l2.md.
 */
import { expect, test, type Page } from "@playwright/test";
import { sql } from "drizzle-orm";
import { createDatabase } from "@leaseplace/db";
import { account, resetRateLimitsBeforeEach, signInCompanyWithCode, signInPro } from "./fixtures";
import { qualify, sendTo } from "./flows";
import { createReviewCase } from "./review-fixtures";

resetRateLimitsBeforeEach();

async function one<T>(query: ReturnType<typeof sql>): Promise<T> {
  const { db, close } = createDatabase(process.env.DATABASE_URL_ADMIN ?? "", { max: 1 });
  try {
    const rows = await db.execute(query);
    return rows[0] as T;
  } finally {
    await close();
  }
}

const signedInCompany = async (page: Page) => {
  await signInCompanyWithCode(page, account("entreprise").email);
  await expect(page).toHaveURL(/\/entreprise/);
};

test.describe("en-têtes et surface publique", () => {
  test("CSP à nonce, anti-cadrage, HSTS, aucune signature du serveur", async ({ request }) => {
    for (const path of ["/", "/connexion", "/simulateur"]) {
      const res = await request.get(path);
      const h = res.headers();
      const csp = h["content-security-policy"] ?? "";
      expect(csp, path).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/);
      expect(csp, path).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(csp, path).toMatch(/frame-ancestors 'none'/);
      expect(csp, path).toMatch(/object-src 'none'/);
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["strict-transport-security"]).toContain("max-age=63072000");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["x-powered-by"]).toBeUndefined();
    }
  });

  test("routes protégées sans session : rien ne fuit", async ({ request }) => {
    const uuid = "0193a000-0000-7000-8000-000000000000";
    expect((await request.get("/api/export")).status()).toBe(401);
    expect((await request.get(`/api/documents/${uuid}`)).status()).toBe(401);
    expect((await request.get(`/api/factures/${uuid}`)).status()).toBe(404);
    for (const path of ["/entreprise", "/bailleur", "/admin", "/admin/confidentialite"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([303, 307, 308], path).toContain(res.status());
      expect(res.headers().location ?? "", path).toMatch(/\/connexion/);
    }
  });

  test("paramètres hostiles : ni erreur serveur ni fuite", async ({ request }) => {
    for (const path of [
      "/entreprise/demandes/'%20OR%201=1--",
      "/bailleur/dossiers/..%2F..%2Fetc%2Fpasswd",
      "/simulateur?montant=%3Cscript%3Ealert(1)%3C/script%3E&duree=-1",
      "/api/documents/%27%3B%20drop%20table%20users%3B--",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBeLessThan(500);
      expect(await res.text(), path).not.toContain("<script>alert(1)</script>");
    }
  });

  test("route d'analyse : même origine, liste fermée, taille bornée", async ({ request }) => {
    const ok = { event: "page_viewed", id: "a".repeat(32), properties: { page: "landing" } };
    expect((await request.post("/api/evenements", { data: ok })).status()).toBe(204);
    expect(
      (
        await request.post("/api/evenements", {
          data: ok,
          headers: { Origin: "https://evil.example" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post("/api/evenements", { data: { ...ok, event: "request_submitted" } })
      ).status(),
    ).toBe(400);
    expect(
      (await request.post("/api/evenements", { data: { ...ok, id: "salma@atlas.ma" } })).status(),
    ).toBe(400);
    expect((await request.post("/api/evenements", { data: "x".repeat(2000) })).status()).toBe(413);
  });
});

test.describe("cloisonnement (IDOR)", () => {
  test("une entreprise ne lit pas la demande d'une autre", async ({ page }) => {
    const other = await one<{ id: string; thread: string }>(sql`
      select r.id, t.id as thread from credit.financing_requests r
      join identity.organizations o on o.id = r.organization_id
      join market.threads t on t.request_id = r.id
      where o.slug = 'souss-agrumes' limit 1`);
    await signedInCompany(page);
    for (const path of [
      `/entreprise/demandes/${other.id}`,
      `/entreprise/demandes/${other.id}/offres`,
      `/entreprise/messages/${other.thread}`,
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
  });

  test("un bailleur n'ouvre ni le dossier ni la facture d'un autre bailleur", async ({ page }) => {
    const target = await one<{ id: string }>(sql`
      select t.id from credit.routing_targets t
      join identity.organizations o on o.id = t.lessor_organization_id
      where o.slug = 'cedre-leasing' limit 1`);
    const invoice = await one<{ id: string }>(sql`
      select i.id from billing.invoices i
      join identity.organizations o on o.id = i.lessor_organization_id
      where o.slug <> 'cedre-leasing' limit 1`);
    await signInPro(page, "bailleur-b");
    await expect(page).toHaveURL(/\/bailleur/);
    expect((await page.goto(`/bailleur/dossiers/${target.id}`))?.status()).toBe(404);
    // L'administrateur de Cèdre ne télécharge pas la facture d'un autre bailleur.
    const cedre = await page.context().browser()?.newContext();
    const admin = await cedre?.newPage();
    if (!admin) throw new Error("contexte");
    await signInPro(admin, "bailleur");
    await expect(admin).toHaveURL(/\/bailleur/);
    expect((await admin.request.get(`/api/factures/${invoice.id}`)).status()).toBe(404);
  });

  test("lien de pièce forgé ou détourné : refusé", async ({ page }) => {
    const doc = await one<{ id: string }>(sql`
      select d.id from kyc.documents d join identity.organizations o on o.id = d.organization_id
      where o.slug = 'atlas-transports' limit 1`);
    await signedInCompany(page);
    const forged = `/api/documents/${doc.id}?e=${String(Date.now() + 60_000)}&s=${"0".repeat(64)}`;
    expect((await page.request.get(forged)).status()).toBe(403);
  });
});

test.describe("sessions, CSRF, XSS, redirections", () => {
  test("cookie de session HttpOnly, SameSite=Lax ; connexion refusée d'une autre origine", async ({
    page,
    request,
  }) => {
    await signedInCompany(page);
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name.includes("session_token"));
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    const res = await request.post("/api/auth/sign-in/email", {
      headers: { Origin: "https://evil.example" },
      data: { email: account("bailleur").email, password: "x" },
    });
    expect(res.status()).toBe(403);
  });

  test("action serveur rejouée depuis une autre origine : refusée", async ({ page }) => {
    await signedInCompany(page);
    await page.goto("/entreprise/profil");
    const captured = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"],
    );
    await page.getByRole("button", { name: "Enregistrer" }).click();
    const original = await captured;
    const headers = { ...original.headers() };
    const replay = (origin: string) =>
      page.request.post(original.url(), {
        headers: { ...headers, origin },
        data: original.postDataBuffer() ?? "",
      });
    expect((await replay("http://localhost:3000")).status()).toBe(200);
    expect((await replay("https://evil.example")).status()).toBeGreaterThanOrEqual(400);
  });

  test("message piégé : affiché comme du texte, jamais exécuté", async ({ browser }) => {
    test.setTimeout(120_000);
    // Dossier dédié : le fil de démonstration reste intact.
    const c = await createReviewCase();
    await qualify(browser, c);
    const page = await (await browser.newContext()).newPage();
    await sendTo(page, c, ["Cèdre Leasing"]);
    let dialog = false;
    page.on("dialog", (d) => {
      dialog = true;
      void d.dismiss();
    });
    await page.goto("/entreprise/messages");
    await page
      .locator('[data-thread-row="Cèdre Leasing"]')
      .filter({ hasText: c.reference })
      .click();
    const payload = `<img src=x onerror="alert(1)"> <script>alert(2)</script>`;
    await page.getByLabel("Votre message").fill(payload);
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.locator('[data-message="mine"]').last()).toContainText("<img src=x onerror");
    await page.reload();
    await expect(page.locator('[data-messages] img[src="x"]')).toHaveCount(0);
    expect(dialog).toBe(false);
  });

  test("redirection ouverte après connexion : ramenée sur le site", async ({ page }) => {
    await page.goto("/connexion?suite=https%3A%2F%2Fevil.example%2Fvol");
    await page.getByRole("tab", { name: "Bailleur ou équipe" }).click();
    const a = account("bailleur");
    await page.getByLabel("Adresse e-mail", { exact: true }).fill(a.email);
    await page.getByLabel("Mot de passe").fill("Demo-LeasePlace-2026!");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByLabel("Code d’authentification")).toBeVisible();
    const { currentTotp } = await import("../src/lib/totp");
    await page.getByLabel("Code d’authentification").fill(currentTotp(a.totpSecret ?? ""));
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(page).toHaveURL(/localhost:3000\/bailleur/);
  });
});

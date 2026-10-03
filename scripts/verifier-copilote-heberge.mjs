#!/usr/bin/env node
/**
 * Vérification de l'IA sur le site de TEST (workflow « Vérifier l'IA
 * (base hébergée) », lancement manuel) : avec un compte jetable
 * e2e-…@example.com (créé puis supprimé par scripts/comptes-e2e.mjs), se
 * connecte au site GitHub Pages, charge la démo « Ville de Rivière-Claire »
 * (fictive), active le copilote pour l'organisation de ce compte et pose une
 * question. Rapporte le statut HTTP de la fonction `copilot` (200 = la clé
 * ANTHROPIC_API_KEY est reconnue ; 503 service_non_configure = absente),
 * le texte de la réponse et une capture du panneau (JPEG en base64 dans le
 * journal, entre CAPTURE_DEBUT et CAPTURE_FIN, + artefact). Aucune clé ni
 * aucun secret n'est affiché.
 *
 *   E2E_COURRIEL_A, E2E_MDP (comptes-e2e.mjs) ; SITE (défaut : GitHub Pages)
 *   node scripts/verifier-copilote-heberge.mjs <dossier>
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = (process.env.SITE ?? "https://maelmouatasim-beep.github.io/vraih2fleet/").replace(/\/?$/, "/");
const SORTIE = process.argv[2] ?? "verification-ia";
mkdirSync(SORTIE, { recursive: true });
const courriel = process.env.E2E_COURRIEL_A;
const mdp = process.env.E2E_MDP;
if (!courriel || !mdp) throw new Error("E2E_COURRIEL_A / E2E_MDP manquants (scripts/comptes-e2e.mjs creer)");

const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined) });
const page = await (await navigateur.newContext({ locale: "fr-CA", viewport: { width: 1360, height: 900 } })).newPage();
const statuts = [];
page.on("response", async (r) => {
  if (!r.url().includes("/functions/v1/copilot") || r.request().method() !== "POST") return;
  let code = "";
  if (r.status() >= 400) code = (await r.json().catch(() => ({})))?.error ?? "";
  statuts.push(code ? `${r.status()} ${code}` : String(r.status()));
});
const aller = (chemin) => page.goto(`${SITE}#${chemin}`);
const fermerAccueil = async () => {
  const plusTard = page.getByRole("button", { name: "Plus tard" });
  await plusTard.waitFor({ timeout: 6000 }).then(() => plusTard.click(), () => {});
};

let ok = false;
try {
  await aller("/login");
  await page.fill("#email", courriel);
  await page.fill("#password", mdp);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 30000 });
  await fermerAccueil();
  await aller("/dashboard/projects");
  await fermerAccueil();
  await page.getByRole("button", { name: /démo/i }).first().click();
  await page.waitForURL(/projects\/[0-9a-f-]{36}/, { timeout: 90000 });
  const projet = page.url().match(/projects\/([0-9a-f-]{36})/)[1];
  console.log("✔ démo « Ville de Rivière-Claire » chargée");

  await aller("/dashboard/organization");
  const interrupteur = page.getByTestId("ai-settings").locator("#ai-copilot");
  await interrupteur.waitFor({ timeout: 30000 });
  if ((await interrupteur.getAttribute("data-state")) !== "checked") await interrupteur.click();
  for (let i = 0; i < 40 && (await interrupteur.getAttribute("data-state")) !== "checked"; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(2000);
  console.log("✔ copilote activé pour l'organisation du compte de test");

  await aller(`/dashboard/projects/${projet}/strategies`);
  await page.getByTestId("open-copilot").click();
  const panneau = page.getByTestId("copilot-panel");
  await panneau.getByRole("button", { name: "Et si le diesel baisse de 20 % ?" }).click();
  // Réponse vérifiée OU message d'erreur propre (service non configuré…)
  await Promise.race([
    panneau.getByTestId("copilot-answer").first().waitFor({ timeout: 180000 }),
    panneau.getByText(/pas encore branché|ne répond pas|désactivé|Limite/).first().waitFor({ timeout: 180000 }),
  ]);
  await page.waitForTimeout(2000);
  const reponses = panneau.getByTestId("copilot-answer");
  if ((await reponses.count()) > 0) {
    ok = true;
    console.log(`✔ réponse du copilote : ${(await reponses.first().innerText()).replace(/\s+/g, " ").slice(0, 800)}`);
  } else {
    console.log(`✘ pas de réponse : ${(await panneau.innerText()).replace(/\s+/g, " ").slice(-300)}`);
  }
  const capture = await panneau.screenshot({ type: "jpeg", quality: 72 });
  writeFileSync(join(SORTIE, "copilote-heberge.jpg"), capture);
  await page.screenshot({ path: join(SORTIE, "copilote-heberge-page.png") });
  const b64 = capture.toString("base64");
  console.log("CAPTURE_DEBUT");
  for (let i = 0; i < b64.length; i += 900) console.log(`CAPTURE:${b64.slice(i, i + 900)}`);
  console.log("CAPTURE_FIN");
} catch (e) {
  console.log(`✘ ${String(e.message ?? e).split("\n")[0]}`);
  await page.screenshot({ path: join(SORTIE, "echec.png"), fullPage: true }).catch(() => {});
} finally {
  console.log(`Fonction copilot — statuts HTTP : ${statuts.join(", ") || "aucun appel"}`);
  console.log(
    statuts.some((s) => s.startsWith("200"))
      ? "Clé ANTHROPIC_API_KEY reconnue : la fonction a répondu 200."
      : statuts.some((s) => s.includes("service_non_configure"))
        ? "Clé ANTHROPIC_API_KEY NON reconnue : 503 service_non_configure."
        : "Clé : indéterminé (voir les statuts ci-dessus).",
  );
  await navigateur.close();
  if (!ok) process.exitCode = 1;
}

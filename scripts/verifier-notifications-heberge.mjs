#!/usr/bin/env node
/**
 * Vérification des NOTIFICATIONS sur le site de TEST (workflow « Vérifier
 * les notifications (base hébergée) », lancement manuel), avec les deux
 * comptes jetables e2e-…@example.com de scripts/comptes-e2e.mjs :
 *  1. le compte A charge la démo « Ville de Rivière-Claire » (fictive),
 *     ouvre le Suivi (alertes du plan) et génère les tâches du plan ;
 *  2. le coéquipier B est ajouté au projet, commente et assigne une tâche
 *     à A (écritures SQL de test → les VRAIS triggers de la base créent les
 *     notifications) ;
 *  3. A ouvre la cloche : plusieurs types, textes en français, clic sur la
 *     tâche assignée → étape Suivi, compteur décrémenté, aucune erreur
 *     JavaScript. Capture de la cloche ouverte (JPEG en base64 dans le
 *     journal, entre CAPTURE_DEBUT et CAPTURE_FIN, + artefact).
 * Les comptes et leurs organisations sont supprimés par le workflow.
 *
 *   E2E_COURRIEL_A, E2E_COURRIEL_B, E2E_MDP, SUPABASE_ACCESS_TOKEN,
 *   SUPABASE_PROJECT_REF ; SITE (défaut : GitHub Pages)
 *   node scripts/verifier-notifications-heberge.mjs <dossier>
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sqlHeberge } from "./lib/gestion-supabase.mjs";
import { litteral } from "./admin-heberge.mjs";

const SITE = (process.env.SITE ?? "https://maelmouatasim-beep.github.io/vraih2fleet/").replace(/\/?$/, "/");
const SORTIE = process.argv[2] ?? "verification-notifications";
mkdirSync(SORTIE, { recursive: true });
const { E2E_COURRIEL_A: courrielA, E2E_COURRIEL_B: courrielB, E2E_MDP: mdp } = process.env;
if (!courrielA || !courrielB || !mdp) throw new Error("E2E_COURRIEL_A / E2E_COURRIEL_B / E2E_MDP manquants (scripts/comptes-e2e.mjs creer)");
for (const c of [courrielA, courrielB]) if (!/^e2e-[a-z0-9-]+@example\.com$/.test(c)) throw new Error("compte de test inattendu");

const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined) });
const page = await (await navigateur.newContext({ locale: "fr-CA", viewport: { width: 1360, height: 900 } })).newPage();
const erreursPage = [];
page.on("pageerror", (e) => erreursPage.push(String(e.message ?? e)));
const aller = (chemin) => page.goto(`${SITE}#${chemin}`);
const fermerAccueil = async () => {
  const plusTard = page.getByRole("button", { name: "Plus tard" });
  await plusTard.waitFor({ timeout: 6000 }).then(() => plusTard.click(), () => {});
};
const badge = page.getByTestId("notifications-badge");
const lireBadge = async () => ((await badge.count()) ? Number((await badge.innerText()).replace("+", "")) : 0);
const attendre = async (condition, essais = 60) => {
  for (let i = 0; i < essais; i++) {
    if (await condition()) return true;
    await page.waitForTimeout(500);
  }
  return false;
};

let ok = false;
try {
  await aller("/login");
  await page.fill("#email", courrielA);
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

  // Suivi : la surveillance synchronise les alertes du plan, puis on génère les tâches.
  await aller(`/dashboard/projects/${projet}/suivi`);
  const generer = page.getByRole("button", { name: "Générer les tâches du plan" });
  await generer.waitFor({ timeout: 60000 });
  await page.waitForTimeout(4000);
  await generer.click();
  if (!(await attendre(async () => (await lireBadge()) > 0))) throw new Error("aucune notification après la génération des tâches");
  console.log(`✔ tâches du plan générées — cloche : ${await lireBadge()} non lue(s)`);

  // Coéquipier : ajouté au projet, commente, assigne une tâche à A (vrais triggers).
  const [ids] = await sqlHeberge(`select
      (select id from auth.users where lower(email) = lower(${litteral(courrielA)})) as a,
      (select id from auth.users where lower(email) = lower(${litteral(courrielB)})) as b`);
  if (!ids?.a || !ids?.b) throw new Error("comptes de test introuvables");
  await sqlHeberge(`
    insert into public.project_collaborators (project_id, user_id, role, invited_by) values ('${projet}', '${ids.b}', 'editor', '${ids.a}');
    insert into public.project_comments (project_id, user_id, content) values ('${projet}', '${ids.b}', 'Vérification des notifications : commentaire du coéquipier.');
    insert into public.tasks (project_id, title, status, assigned_to, created_by) values ('${projet}', 'Valider la soumission Roulez vert', 'todo', array['${ids.a}']::uuid[], '${ids.b}');`);
  console.log("✔ coéquipier ajouté, commentaire et tâche assignée à A");

  await aller("/dashboard");
  await fermerAccueil();
  if (!(await attendre(async () => (await lireBadge()) >= 3))) throw new Error(`compteur ${await lireBadge()} (attendu ≥ 3)`);
  const avant = await lireBadge();
  await page.getByTestId("notifications-bell").click();
  const panneau = page.getByTestId("notifications-panel");
  await panneau.getByTestId("notification-item").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1000);
  const types = [...new Set(await panneau.getByTestId("notification-item").evaluateAll((els) => els.map((e) => e.getAttribute("data-type"))))];
  console.log(`✔ cloche ouverte : ${avant} non lue(s), types ${types.join(", ")}`);
  for (const t of ["tasks_generated", "comment", "task_assigned"]) if (!types.includes(t)) throw new Error(`type « ${t} » absent de la cloche`);
  const textes = (await panneau.innerText()).replace(/\s+/g, " ");
  if (/notifications\.|undefined|\{\{/.test(textes)) throw new Error("texte non traduit dans la cloche");
  console.log(`  ${textes.slice(0, 600)}`);

  const zone = await panneau.boundingBox();
  const capture = await page.screenshot({
    type: "jpeg",
    quality: 80,
    clip: { x: Math.max(0, zone.x - 12), y: Math.max(0, zone.y - 56), width: zone.width + 24, height: zone.height + 64 },
  });
  writeFileSync(join(SORTIE, "cloche-heberge.jpg"), capture);

  await panneau.locator('[data-testid="notification-item"][data-type="task_assigned"] button').first().click();
  await page.waitForURL(/\/suivi$/, { timeout: 15000 });
  if (!(await attendre(async () => (await lireBadge()) === avant - 1, 20))) throw new Error(`compteur ${await lireBadge()} après le clic (attendu ${avant - 1})`);
  console.log(`✔ clic sur « tâche assignée » → étape Suivi ; compteur ${avant} → ${avant - 1}`);
  if (erreursPage.length) throw new Error(`erreur JavaScript : ${erreursPage[0]}`);
  console.log("✔ aucune erreur JavaScript");

  const b64 = capture.toString("base64");
  console.log("CAPTURE_DEBUT");
  for (let i = 0; i < b64.length; i += 900) console.log(`CAPTURE:${b64.slice(i, i + 900)}`);
  console.log("CAPTURE_FIN");
  ok = true;
} catch (e) {
  console.log(`✘ ${String(e.message ?? e).split("\n")[0]}`);
  if (erreursPage.length) console.log(`  erreurs JavaScript : ${erreursPage.slice(0, 3).join(" | ")}`);
  await page.screenshot({ path: join(SORTIE, "echec.png"), fullPage: true }).catch(() => {});
} finally {
  await navigateur.close();
  if (!ok) process.exitCode = 1;
}

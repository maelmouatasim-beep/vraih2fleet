#!/usr/bin/env node
/**
 * Parcours manuel AUTOMATISÉ (revue E4).
 *
 * LOCAL (défaut) : Supabase local (`supabase start` + `db reset`) et le
 * serveur de dev pointé dessus.
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<anon local> npx vite --port 8080
 *   node scripts/e2e-parcours.mjs <dossier_captures>      (ou npm run e2e:local)
 * Inscription réelle des deux comptes, puis « mot de passe oublié » avec le
 * courriel lu dans Mailpit (E2E_MAILPIT, défaut http://127.0.0.1:54324).
 *
 * HÉBERGÉ (E2E_CIBLE=heberge, workflow « E2E base hébergée ») : projet
 * Supabase de TEST uniquement. E2E_SUPABASE_URL = la seule URL Supabase
 * autorisée (toute autre est bloquée) ; comptes e2e-…@example.com créés
 * et confirmés d'avance par scripts/comptes-e2e.mjs (E2E_COURRIEL_A,
 * E2E_COURRIEL_B, E2E_MDP) : connexion au lieu de l'inscription.
 *
 * E2E_BASE : URL du site ; E2E_HASH=1 : routage par hash (build GitHub
 * Pages, ex. E2E_BASE=http://127.0.0.1:4173/vraih2fleet/).
 *
 * Étapes : inscription → Accueil → Ma flotte (import CSV strict) →
 * projet → 7 étapes → rapports fr/en → invitation d'équipe → langue.
 * Chaque étape échoue bruyamment ; toute réponse locale ≥ 400 ou erreur
 * console fait échouer le parcours. Garde-fou : toute requête vers un
 * Supabase HÉBERGÉ (*.supabase.co) est bloquée et fait échouer le script.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:8080";
const HASH = process.env.E2E_HASH === "1";
const HEBERGE = process.env.E2E_CIBLE === "heberge";
const SUPABASE_AUTORISE = HEBERGE ? new URL(process.env.E2E_SUPABASE_URL ?? "").host : null;
const MAILPIT = HEBERGE ? "" : process.env.E2E_MAILPIT ?? "http://127.0.0.1:54324";
if (HEBERGE && !(process.env.E2E_COURRIEL_A && process.env.E2E_COURRIEL_B && process.env.E2E_MDP)) {
  throw new Error("Mode hébergé : E2E_COURRIEL_A, E2E_COURRIEL_B et E2E_MDP requis (scripts/comptes-e2e.mjs creer)");
}
/** URL d'une route de l'app (chemin « /dashboard/… »). */
const url = (chemin) => (HASH ? `${BASE.replace(/\/?$/, "/")}#${chemin}` : `${BASE.replace(/\/$/, "")}${chemin}`);
const SORTIE = resolve(process.argv[2] ?? "e2e-captures");
mkdirSync(SORTIE, { recursive: true });
const stamp = Date.now();
const COURRIEL_A = process.env.E2E_COURRIEL_A ?? `admin-${stamp}@example.com`;
const COURRIEL_B = process.env.E2E_COURRIEL_B ?? `coequipier-${stamp}@example.com`;
const MDP = process.env.E2E_MDP ?? "Parcours2026!";

const erreursConsole = [];
const journal = [];
const etape = (m) => {
  journal.push(m);
  console.log(`✔ ${m}`);
};

async function capture(page, nom) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(SORTIE, `${nom}.png`), fullPage: true });
}

async function fermerOnboarding(page) {
  const dlg = page.getByRole("dialog");
  if (await dlg.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

async function connecter(page, courriel, mdp = MDP) {
  await page.goto(url("/login"));
  await page.fill("#email", courriel);
  await page.fill("#password", mdp);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await fermerOnboarding(page);
}

/** Local : vraie inscription. Hébergé : compte créé d'avance → connexion. */
async function inscrire(page, nom, courriel) {
  if (HEBERGE) return connecter(page, courriel);
  await page.goto(url("/signup"));
  await page.fill("#fullName", nom);
  await page.fill("#email", courriel);
  await page.fill("#password", MDP);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await fermerOnboarding(page);
}

// Chromium préinstallé de l'environnement de dev s'il existe, sinon celui
// de Playwright (CI : npx playwright install chromium).
const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined),
});
const contexte = await navigateur.newContext({ locale: "fr-CA", acceptDownloads: true, viewport: { width: 1360, height: 900 } });
let versHeberge = null;
async function bloquerHeberge(ctx) {
  await ctx.route(/\.supabase\.(co|in)\//, (route) => {
    if (SUPABASE_AUTORISE && new URL(route.request().url()).host === SUPABASE_AUTORISE) return route.continue();
    versHeberge = route.request().url();
    return route.abort();
  });
}
await bloquerHeberge(contexte);
const page = await contexte.newPage();
const hoteLocal = (u) => /127\.0\.0\.1|localhost/.test(u) || (SUPABASE_AUTORISE !== null && new URL(u).host === SUPABASE_AUTORISE);
function surveiller(p) {
  p.on("console", (m) => {
    if (m.type() !== "error") return;
    // Ressources externes (polices, cartes) bloquées par l'environnement : hors périmètre.
    if (/ERR_CERT|ERR_TUNNEL|ERR_NAME/.test(m.text())) return;
    // Doublons des événements réseau ci-dessous (déjà comptés avec leur URL) :
    // une vraie panne réseau remonte en « échec réseau », une requête
    // annulée par une navigation (ERR_ABORTED) est attendue.
    if (/Failed to fetch/.test(m.text()) || /status of \d{3}/.test(m.text())) return;
    erreursConsole.push(`[console] ${m.text().slice(0, 200)}`);
  });
  p.on("response", (r) => {
    if (r.status() >= 400 && hoteLocal(r.url())) erreursConsole.push(`[${r.status()}] ${r.request().method()} ${r.url().slice(0, 160)}`);
  });
  p.on("requestfailed", (r) => {
    // ERR_ABORTED = requête annulée par une navigation (page.goto) : attendu.
    if (hoteLocal(r.url()) && r.failure()?.errorText !== "net::ERR_ABORTED") erreursConsole.push(`[échec réseau] ${r.method()} ${r.url().slice(0, 160)} ${r.failure()?.errorText ?? ""}`);
  });
}
surveiller(page);

try {
  // 1. Inscription + Accueil
  await inscrire(page, "Admin Parcours", COURRIEL_A);
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== "fr-CA") throw new Error(`<html lang> attendu fr-CA, obtenu ${lang}`);
  await capture(page, "01-accueil-vide");
  etape(`inscription ${COURRIEL_A}, Accueil, <html lang=${lang}>`);

  // 2. Ma flotte : import CSV strict
  const csv = [
    "Unité,Marque,Modèle,Année,Catégorie,Carburant,Km/an,Consommation,Dépôt,Mise en service",
    "U-101,Ford,Transit,2016,camionnette,diesel,32 000 km,15,Garage central,2016-05-01",
    "U-102,Ram,ProMaster,2017,camionnette,diesel,28000,14.5,Garage central,43000",
    "U-201,Freightliner,M2,2014,camion moyen,diesel,45000,32,Dépôt Nord,2014-03-10",
    "U-301,International,LT,2013,camion lourd,diesel,90000,38,Dépôt Nord,2013-01-15",
    "U-401,Nova Bus,LFS,2012,autobus,diesel,60000,55,Garage central,2012-06-01",
    "U-999,Ford,F-150,2019,camionnette,,20000,12,Garage central,2019-01-01",
    "U-998,Ford,F-150,2019,camionnette,diesel,beaucoup,12,Garage central,2019-01-01",
  ].join("\n");
  const fichier = join(SORTIE, "flotte.csv");
  writeFileSync(fichier, csv);
  await page.goto(url("/dashboard/fleet"));
  await page.getByRole("button", { name: /Importer CSV/ }).click();
  await page.setInputFiles('input[type="file"]', fichier);
  await page.getByText(/nouveau\(x\) véhicule\(s\)/).waitFor({ timeout: 10000 });
  const apercu = await page.getByText(/nouveau\(x\) véhicule\(s\)/).innerText();
  if (!apercu.includes("5 nouveau") || !apercu.includes("2 erreur")) throw new Error(`aperçu d'import inattendu : ${apercu}`);
  await capture(page, "02-ma-flotte-apercu-import");
  await page.getByRole("button", { name: /^Importer \(|Importer \d/ }).click();
  await page.getByText("U-401").waitFor({ timeout: 10000 });
  await capture(page, "03-ma-flotte");
  etape(`Ma flotte : import — ${apercu.trim()}`);

  // 3. Projet : la création ouvre l'étape 1 du parcours (C8)
  await page.goto(url("/dashboard/projects"));
  await page.getByRole("button", { name: /Nouveau projet|Créer un projet/ }).first().click();
  await page.fill("#name", "Plan 2027-2036");
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page.waitForURL(/\/dashboard\/projects\/[^/]+\/flotte$/, { timeout: 15000 });
  const base = page.url().replace(/\/flotte$/, "");
  etape(`projet créé → ${page.url().replace(/^.*(\/dashboard)/, "$1")}`);

  // 4. Étape Flotte : ajout groupé, cibles suggérées (C2)
  await page.getByRole("button", { name: "Ajouter des véhicules" }).click();
  await page.getByRole("dialog").getByText("Tout sélectionner").click();
  await page.getByRole("button", { name: /Ajouter 5 véhicule/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("cell", { name: "U-401" }).last().waitFor();
  await page.getByRole("checkbox", { name: "Tout sélectionner" }).click();
  await page.getByRole("button", { name: "Cibles suggérées" }).click();
  await page.waitForTimeout(2500);
  await capture(page, "04-etape-flotte");
  etape("étape Flotte : 5 véhicules, cibles suggérées appliquées");

  // 5. Faisabilité
  await page.goto(`${base}/faisabilite`);
  await page.getByText("U-101").first().waitFor({ timeout: 15000 });
  await capture(page, "05-faisabilite");
  etape("Faisabilité : verdicts chiffrés");

  // 6. Stratégies : appliquer au plan (C3)
  await page.goto(`${base}/strategies`);
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).waitFor({ timeout: 15000 });
  await page.getByText("Tout électrique").first().click();
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).click();
  await capture(page, "06-strategies-confirmation");
  await page.getByRole("button", { name: /Appliquer \(\d+ changement/ }).click();
  await page.getByText("Stratégie retenue").first().waitFor({ timeout: 15000 });
  await capture(page, "07-strategies-retenue");
  etape("Stratégies : « Tout électrique » appliquée et retenue");

  // 7. Plan + infrastructure par dépôt (C6)
  await page.goto(`${base}/plan`);
  await page.getByText("Infrastructure de recharge par dépôt").waitFor({ timeout: 15000 });
  await capture(page, "08-plan-infra-depots");
  etape("Plan : budget annuel + infrastructure par dépôt");

  // 8. Financement : subvention confirmée + suivi de demande (B+, C5)
  await page.goto(`${base}/financement`);
  await page.locator("#cs-vehicule").waitFor({ timeout: 15000 });
  await page.selectOption("#cs-vehicule", { label: "U-401" });
  await page.selectOption("#cs-programme", "pagtcp");
  await page.fill("#cs-montant", "250000");
  await page.fill("#cs-reference", "Lettre MTMD 2026-117");
  await page.getByRole("button", { name: "Ajouter la subvention confirmée" }).click();
  await page.getByText(/Lettre MTMD 2026-117/).first().waitFor({ timeout: 10000 });
  await page.selectOption("#ap-prog", "pagtcp");
  await page.selectOption("#ap-veh", { label: "U-401" });
  await page.fill("#ap-montant", "250000");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByText(/Total accordé/).waitFor({ timeout: 10000 });
  await capture(page, "09-financement");
  etape("Financement : subvention confirmée (réf. document) + demande suivie");

  // 9. Rapports : PDF et Excel en français
  await page.goto(`${base}/rapports`);
  for (const [bouton, fichierNom] of [
    [/PDF \(français\)/, "rapport-fr.pdf"],
    [/Télécharger le \.xlsx/, "classeur-fr.xlsx"],
    [/PDF \(English\)/, "rapport-en.pdf"],
  ]) {
    const [dl] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      page.getByRole("button", { name: bouton }).click(),
    ]);
    await dl.saveAs(join(SORTIE, fichierNom));
  }
  await capture(page, "10-rapports");
  etape("Rapports : PDF fr + PDF en + classeur Excel téléchargés");

  // 10. Suivi : marquer réalisé + générer les tâches (C4)
  await page.goto(`${base}/suivi`);
  await page.getByRole("button", { name: "Marquer réalisé" }).first().click();
  await page.fill("#tr-veh", "Ford E-Transit 2027");
  await page.fill("#tr-cout", "98500");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Ford E-Transit 2027").waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Générer les tâches du plan" }).click();
  await page.getByText(/tâche\(s\) créée\(s\) depuis les échéances du plan/).first().waitFor({ timeout: 10000 });
  await capture(page, "11-suivi");
  etape("Suivi : remplacement marqué réalisé, tâches générées");

  // 11. Anglais : Excel en anglais + <html lang>
  await page.getByRole("button", { name: "Langue" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();
  const langEn = await page.evaluate(() => document.documentElement.lang);
  if (langEn !== "en-CA") throw new Error(`<html lang> attendu en-CA, obtenu ${langEn}`);
  await page.goto(`${base}/rapports`);
  const [dlEn] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.getByRole("button", { name: /Download the \.xlsx|\.xlsx/ }).click(),
  ]);
  await dlEn.saveAs(join(SORTIE, "classeur-en.xlsx"));
  await page.goto(`${base}/financement`);
  await page.waitForTimeout(1500);
  await capture(page, "12-financement-en");
  etape(`anglais : <html lang=${langEn}>, classeur anglais, Financement traduit`);
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Français" }).click();

  // 12. Équipe : invitation acceptée par un coéquipier (D6)
  await page.goto(url("/dashboard/organization"));
  await page.fill("#team-email", COURRIEL_B);
  await page.getByRole("button", { name: "Inviter", exact: true }).click();
  await page.getByText(COURRIEL_B).waitFor({ timeout: 10000 });
  await capture(page, "13-organisation-invitation");
  const contexte2 = await navigateur.newContext({ locale: "fr-CA" });
  await bloquerHeberge(contexte2);
  const page2 = await contexte2.newPage();
  surveiller(page2);
  await inscrire(page2, "Coéquipier Parcours", COURRIEL_B);
  await page2.getByRole("button", { name: "Accepter" }).first().click();
  await page2.waitForTimeout(2500);
  await page2.goto(url("/dashboard/fleet"));
  await page2.getByText("U-401").waitFor({ timeout: 15000 });
  await capture(page2, "14-coequipier-voit-la-flotte");
  etape("Équipe : invitation acceptée, le coéquipier voit la flotte de l'organisation");

  // 13. Mot de passe oublié → courriel (Mailpit, local seulement) → lien →
  // page de réinitialisation → reconnexion avec le nouveau mot de passe.
  if (MAILPIT) {
    const contexte3 = await navigateur.newContext({ locale: "fr-CA" });
    await bloquerHeberge(contexte3);
    const page3 = await contexte3.newPage();
    surveiller(page3);
    await page3.goto(url("/forgot-password"));
    await page3.fill("#email", COURRIEL_B);
    await page3.click('button[type="submit"]');
    await page3.getByText("Email envoyé !").waitFor({ timeout: 10000 });
    let lien = null;
    for (let i = 0; i < 30 && !lien; i++) {
      const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${COURRIEL_B}`)}`)).json();
      if (r.messages?.length) {
        const m = await (await fetch(`${MAILPIT}/api/v1/message/${r.messages[0].ID}`)).json();
        lien = `${m.HTML ?? ""} ${m.Text ?? ""}`.match(/https?:\/\/[^"\s]*\/verify\?[^"\s]*/)?.[0]?.replace(/&amp;/g, "&") ?? null;
      } else await page3.waitForTimeout(500);
    }
    if (!lien) throw new Error("courriel de réinitialisation introuvable dans Mailpit");
    await page3.goto(lien);
    await page3.waitForURL(/\/reset-password/, { timeout: 20000 });
    await page3.fill("#new-password", "Nouveau2026!");
    await page3.fill("#confirm-password", "Nouveau2026!");
    await capture(page3, "15-nouveau-mot-de-passe");
    await page3.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await page3.waitForURL(/\/dashboard/, { timeout: 15000 });
    await contexte3.close();
    // Reconnexion dans un navigateur neuf avec le NOUVEAU mot de passe.
    const contexte4 = await navigateur.newContext({ locale: "fr-CA" });
    await bloquerHeberge(contexte4);
    const page4 = await contexte4.newPage();
    surveiller(page4);
    await connecter(page4, COURRIEL_B, "Nouveau2026!");
    etape("Mot de passe oublié : courriel → lien → nouveau mot de passe → reconnexion");
  }
} catch (e) {
  await capture(page, "zz-echec");
  console.error("✘ ÉCHEC :", e.message);
  process.exitCode = 1;
}

console.log("\nErreurs (réseau local ≥ 400, console) :", erreursConsole.length ? erreursConsole : "aucune");
if (erreursConsole.length) process.exitCode = 1;
if (versHeberge) {
  console.error(
    HEBERGE
      ? `✘ Requête vers un AUTRE projet Supabase que ${SUPABASE_AUTORISE} (${versHeberge}) — build mal configuré.`
      : `✘ Le serveur de dev pointe vers un Supabase hébergé (${versHeberge}) — parcours local réservé au Supabase LOCAL.`,
  );
  process.exitCode = 1;
}
writeFileSync(join(SORTIE, "journal.txt"), [...journal, "", "Erreurs (réseau local ≥ 400, console) :", ...(erreursConsole.length ? erreursConsole : ["aucune"])].join("\n"));
await navigateur.close();

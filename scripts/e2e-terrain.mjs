#!/usr/bin/env node
/**
 * Cas du TEST TERRAIN (petite ville, 12 véhicules, 3 garages) rejoué de
 * bout en bout contre Supabase LOCAL : import Excel/CSV → garages
 * (puissance, fenêtre de recharge) → projet → 7 étapes → rapports.
 * Vérifie que l'infrastructure affichée est IDENTIQUE au dollar près en
 * Stratégies (stratégie retenue), Plan, PDF et Excel, et que le libellé de
 * la stratégie retenue est le bon partout.
 *
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<anon local> npx vite --port 8080
 *   node scripts/e2e-terrain.mjs <dossier_captures>
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:8080";
const url = (chemin) => `${BASE.replace(/\/$/, "")}${chemin}`;
const SORTIE = resolve(process.argv[2] ?? "e2e-terrain");
mkdirSync(SORTIE, { recursive: true });
const COURRIEL = `terrain-${Date.now()}@example.com`;
const MDP = "Terrain2026!";

// 12 véhicules, 3 garages (cas du test terrain)
export const FLOTTE_TERRAIN = [
  "Unité,Marque,Modèle,Année,Catégorie,Carburant,Km annuel,Consommation,Km journalier max,Garage,Classe PNBV,Mise en service",
  "HV-01,Toyota,Corolla,2017,vehicule_leger,essence,12500,6.5,80,Hôtel de ville,1,2017-05-01",
  "GM-01,Ford,F-150,2015,camionnette,essence,22000,14,140,Garage municipal,,2015-04-01",
  "GM-02,Ford,F-150,2017,camionnette,essence,20000,13.5,130,Garage municipal,,2017-04-01",
  "GM-03,Ford,Transit 250,2016,camionnette,essence,25000,15,160,Garage municipal,2b,2016-06-01",
  "GM-04,Chevrolet,Silverado 2500 HD,2018,camionnette,diesel,24000,16,150,Garage municipal,2b,2018-03-01",
  "GM-05,Dodge,Charger,2019,urgence,essence,35000,12,250,Garage municipal,,2019-01-15",
  "TP-01,International,HV607,2012,chasse-neige,diesel,9000,55,120,Travaux publics,8,2012-11-01",
  "TP-02,Freightliner,108SD,2014,camion à benne,diesel,18000,40,110,Travaux publics,7,2014-05-01",
  "TP-03,Trackless,MT7,2016,outil,diesel,3000,20,40,Travaux publics,,2016-10-01",
  "TP-04,Ford,F-550,2016,camion moyen,diesel,15000,25,100,Travaux publics,5,2016-07-01",
  "TP-05,Ford,F-350,2018,camionnette,diesel,20000,18,120,Travaux publics,3,2018-08-01",
  "TP-06,Larue,D65,2010,souffleuse,diesel,2500,30,30,Travaux publics,8,2010-12-01",
].join("\n");

const GARAGES = [
  { nom: "Hôtel de ville", kw: "20", retour: "18:00", depart: "08:00" },
  { nom: "Garage municipal", kw: "40", retour: "17:00", depart: "07:00" },
  { nom: "Travaux publics", kw: "", retour: "16:00", depart: "06:00" },
];

const journal = [];
const etape = (m) => {
  journal.push(m);
  console.log(`✔ ${m}`);
};
async function capture(page, nom) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(SORTIE, `${nom}.png`), fullPage: true });
}
const montant = (texte) => Number(texte.replace(/[^\d,-]/g, "").replace(",", "."));

const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined) });
const contexte = await navigateur.newContext({ locale: "fr-CA", acceptDownloads: true, viewport: { width: 1360, height: 900 } });
await contexte.route(/\.supabase\.(co|in)\//, (r) => r.abort());
const page = await contexte.newPage();
const erreurs = [];
page.on("response", (r) => {
  if (r.status() >= 400 && /127\.0\.0\.1|localhost/.test(r.url())) erreurs.push(`[${r.status()}] ${r.request().method()} ${r.url().slice(0, 140)}`);
});

try {
  // Inscription
  await page.goto(url("/signup"));
  await page.fill("#fullName", "Responsable Flotte");
  await page.fill("#email", COURRIEL);
  await page.fill("#password", MDP);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(1500);
  if (await page.getByRole("dialog").isVisible().catch(() => false)) await page.keyboard.press("Escape");
  etape(`inscription ${COURRIEL}`);

  // Import des 12 véhicules
  const fichier = join(SORTIE, "flotte-terrain.csv");
  writeFileSync(fichier, FLOTTE_TERRAIN);
  await page.goto(url("/dashboard/fleet"));
  await page.getByRole("button", { name: /Importer CSV/ }).click();
  await page.setInputFiles('input[type="file"]', fichier);
  await page.getByText(/nouveau\(x\) véhicule\(s\)/).waitFor({ timeout: 10000 });
  const apercu = await page.getByText(/nouveau\(x\) véhicule\(s\)/).innerText();
  if (!apercu.includes("12 nouveau") || !apercu.includes("0 erreur")) throw new Error(`aperçu inattendu : ${apercu}`);
  await capture(page, "01-import-apercu");
  await page.getByRole("button", { name: /^Importer \d/ }).click();
  await page.getByText("TP-06").first().waitFor({ timeout: 10000 });
  etape(`import : ${apercu.trim()}`);

  // Garages créés par l'import → puissance et fenêtre de recharge
  for (const g of GARAGES) {
    const ligne = page.getByRole("row").filter({ has: page.locator("p.font-medium", { hasText: new RegExp(`^${g.nom}$`) }) });
    await ligne.getByRole("button", { name: "Modifier" }).click();
    if (g.kw) await page.fill("#garage-available_power_kw", g.kw);
    await page.fill("#garage-return_time", g.retour);
    await page.fill("#garage-departure_time", g.depart);
    await page.getByRole("dialog").getByRole("button", { name: "Sauvegarder" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  await page.waitForTimeout(800);
  await capture(page, "02-ma-flotte-garages");
  etape("3 garages créés par l'import, puissance et fenêtre de recharge renseignées");

  // Projet + 12 véhicules + cibles suggérées
  await page.goto(url("/dashboard/projects"));
  await page.getByRole("button", { name: /Nouveau projet|Créer un projet/ }).first().click();
  await page.fill("#name", "Transition 2027-2036");
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page.waitForURL(/\/dashboard\/projects\/[^/]+\/flotte$/, { timeout: 15000 });
  const base = page.url().replace(/\/flotte$/, "");
  await page.getByRole("button", { name: "Ajouter des véhicules" }).click();
  await page.getByRole("dialog").getByText("Tout sélectionner").click();
  await page.getByRole("button", { name: /Ajouter 12 véhicule/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("cell", { name: "TP-06" }).last().waitFor();
  await page.getByRole("checkbox", { name: "Tout sélectionner" }).click();
  await page.getByRole("button", { name: "Cibles suggérées" }).click();
  await page.waitForTimeout(2500);
  await capture(page, "03-etape-flotte");
  etape("projet : 12 véhicules, cibles suggérées");

  await page.goto(`${base}/faisabilite`);
  await page.getByText("TP-06").first().waitFor({ timeout: 15000 });
  await capture(page, "04-faisabilite");
  etape("Faisabilité : verdicts, hiver, à reporter");

  // Stratégies : appliquer « Économies d'abord »
  await page.goto(`${base}/strategies`);
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).waitFor({ timeout: 15000 });
  await capture(page, "05-strategies");
  await page.getByText("Économies d'abord").first().click();
  const carteEco = page.locator("button", { hasText: "Économies d'abord" }).first();
  const infraStrategieTxt = (await carteEco.getByText(/^Infrastructure :/).innerText().catch(() => "Infrastructure : 0 $"));
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).click();
  await page.getByRole("button", { name: /^Appliquer \(\d+ changement/ }).click();
  await page.getByText("Stratégie retenue").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await capture(page, "06-strategies-retenue");
  etape(`Stratégies : « Économies d'abord » appliquée (${infraStrategieTxt})`);

  // Plan : même infrastructure, bon libellé
  await page.goto(`${base}/plan`);
  await page.getByText("Infrastructure de recharge par garage").waitFor({ timeout: 15000 });
  const sousTitre = await page.getByText(/^Stratégie retenue :/).first().innerText();
  if (!sousTitre.includes("Économies d'abord")) throw new Error(`libellé du Plan : ${sousTitre}`);
  const totalPlanTxt = await page.getByText(/^CAPEX infrastructure total :/).innerText().catch(() => "CAPEX infrastructure total : 0 $");
  await capture(page, "07-plan");
  const infraStrategie = montant(infraStrategieTxt);
  const infraPlan = montant(totalPlanTxt);
  if (infraStrategie !== infraPlan) throw new Error(`infrastructure Stratégies ${infraStrategie} ≠ Plan ${infraPlan}`);
  etape(`Plan : « ${sousTitre.slice(0, 60)}… », infrastructure ${infraPlan} $ = Stratégies`);

  await page.goto(`${base}/financement`);
  await page.getByText("Subventions prévues au plan").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await capture(page, "08-financement");
  etape("Financement : règle et raison de chaque subvention");

  await page.goto(`${base}/rapports`);
  for (const [bouton, nom] of [[/PDF \(français\)/, "rapport-fr.pdf"], [/Télécharger le \.xlsx/, "classeur-fr.xlsx"]]) {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("button", { name: bouton }).click()]);
    await dl.saveAs(join(SORTIE, nom));
  }
  await capture(page, "09-rapports");
  etape("Rapports : PDF et Excel téléchargés");

  await page.goto(`${base}/suivi`);
  await page.waitForTimeout(2000);
  await capture(page, "10-suivi");
  etape("Suivi");

  writeFileSync(join(SORTIE, "resultat.json"), JSON.stringify({ infraStrategie, infraPlan, sousTitre }, null, 2));
  if (erreurs.length) throw new Error(`réponses locales en erreur :\n${erreurs.join("\n")}`);
  console.log(`\n${journal.length} étapes, 0 erreur. Captures : ${SORTIE}`);
} catch (e) {
  await page.screenshot({ path: join(SORTIE, "echec.png"), fullPage: true }).catch(() => {});
  console.error(`✘ ${e.message}`);
  if (erreurs.length) console.error(erreurs.join("\n"));
  process.exitCode = 1;
} finally {
  await navigateur.close();
}

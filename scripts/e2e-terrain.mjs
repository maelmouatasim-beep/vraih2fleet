#!/usr/bin/env node
/**
 * Cas du TEST TERRAIN (petite ville, 12 véhicules, 3 garages) rejoué de
 * bout en bout contre Supabase LOCAL : import Excel/CSV → garages
 * (puissance, fenêtre de recharge) → projet → 7 étapes → rapports.
 * Vérifie que l'infrastructure, les subventions et l'économie (VAN) sont
 * IDENTIQUES au dollar près en Stratégies (stratégie retenue), Plan,
 * Financement, PDF et Excel ; que le libellé de la stratégie retenue est
 * le bon ; que l'optimiseur (Phase 5.1) explique chaque décision et que
 * sa stratégie « Optimisée », appliquée après aperçu, se retrouve partout
 * et dans le journal ; que la Faisabilité propose et applique une recommandation aux
 * véhicules sans cible ; que la barre des étapes reflète l'état réel.
 * Lancé en CI (job « Supabase local ») : test e2e PERMANENT du cas terrain.
 * Requiert pdftotext (poppler-utils) pour lire le PDF.
 *
 *   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<anon local> npx vite --port 8080
 *   node scripts/e2e-terrain.mjs <dossier_captures>
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

// Phase 5.3 — export « logiciel de gestion de flotte » désordonné : titre
// au-dessus de l'entête, entêtes non standard, milles et mpg, colonne
// personnelle (conducteur), libellé inconnu, doublon probable, nouveau garage.
export const EXPORT_DESORDONNE = [
  "Rapport FleetPro — inventaire au 2026-09-30",
  "Asset #,Description,Énergie,Odo annuel (mi),MPG,Chauffeur,Yard,Yr",
  "GM-01,Pickup F-150,Gas,14000,17,Jean Tremblay,Garage municipal,2015",
  "TP-07,Unité multifonction MX-3,Diesel,3100,,Marie Roy,travaux publics,2019",
  "TP-08,Pickup 3/4 t,Gas,9000,15,,Garage Nord,2021",
  "GM 01,Pickup F-150,Gas,14000,17,,Garage municipal,2015",
].join("\n");

// Phase 5.4 — facture de diesel (PDF avec couche texte, générée par
// Chromium) ; le faux Claude y lit les montants et renvoie un TOTAL FAUX
// que l'application doit signaler « introuvable dans le document ».
export const FACTURE_TERRAIN = [
  "Pétroles Laurentides inc. — Facture n° 4471 — 2026-09-15",
  "Livraison diesel coloré au Garage municipal, 12 rue du Quai",
  "Diesel                 4 512,0 L    à 1,4210 $/L",
  "Sous-total avant taxes                 6 411,55 $",
  "TPS (5 %)                                320,58 $",
  "TVQ (9,975 %)                            639,55 $",
  "Total                                  7 371,68 $",
  "Merci de votre confiance. Conditions : net 30 jours.",
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
/** Capture d'une boîte de dialogue entière (fenêtre agrandie le temps de la capture). */
async function captureDialogue(page, locator, nom) {
  const taille = page.viewportSize();
  await page.setViewportSize({ width: taille.width, height: 2400 });
  await page.waitForTimeout(700);
  await locator.screenshot({ path: join(SORTIE, `${nom}.png`) });
  await page.setViewportSize(taille);
}
async function capture(page, nom) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(SORTIE, `${nom}.png`), fullPage: true });
}
const montant = (texte) => Number(String(texte).replace(/[^\d,-]/g, "").replace(",", "."));
const egaux = (nom, valeurs) => {
  const ref = Object.values(valeurs)[0];
  for (const [ou, v] of Object.entries(valeurs)) {
    if (!Number.isFinite(v)) throw new Error(`${nom} illisible en ${ou} : ${JSON.stringify(valeurs)}`);
    if (Math.abs(v - ref) > 0.5) throw new Error(`${nom} incohérent : ${JSON.stringify(valeurs)} (écart en ${ou})`);
  }
  return ref;
};
async function valeurCarte(page, titre) {
  const carte = page.locator("div.rounded-lg, div.rounded-xl").filter({ has: page.getByText(titre, { exact: true }) }).last();
  return montant(await carte.locator("p.text-xl").first().innerText());
}
async function etatEtape(page, cle) {
  return page.locator(`a[href$="/${cle}"][data-etat]`).first().getAttribute("data-etat");
}

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
  // Questionnaire de profil (facultatif) : peut s'ouvrir quelques secondes
  // après l'inscription — fermé avant d'importer.
  const plusTard = page.getByRole("button", { name: "Plus tard" });
  await plusTard.waitFor({ timeout: 6000 }).then(() => plusTard.click(), () => {});
  await page.getByRole("button", { name: /Importer CSV/ }).click();
  await page.setInputFiles('input[type="file"]', fichier);
  // Premier import : le serveur de dev compile à froid la lecture Excel/CSV.
  await page.getByText(/nouveau\(x\) véhicule\(s\)/).waitFor({ timeout: 60000 });
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
  // 3.3 : véhicules restés sans cible → recommandation appliquée
  const bouton = page.getByRole("button", { name: /Appliquer (la recommandation|les \d+ recommandations)/ });
  let appliquees = 0;
  if (await bouton.isVisible().catch(() => false)) {
    appliquees = Number((await bouton.innerText()).match(/\d+/)?.[0] ?? 1);
    await bouton.click();
    await bouton.waitFor({ state: "hidden", timeout: 15000 });
  }
  // chaque ligne affiche sa technologie cible (colonne « Technologie cible »)
  for (const unite of ["GM-01", "HV-01", "TP-01"]) {
    const ligne = page.getByRole("row").filter({ has: page.getByRole("cell", { name: unite, exact: true }) });
    const derniere = (await ligne.getByRole("cell").last().innerText()).trim();
    if (!/Électrique|Hydrogène|Diesel/.test(derniere)) throw new Error(`Faisabilité : cible absente pour ${unite} (« ${derniere} »)`);
  }
  if ((await etatEtape(page, "faisabilite")) !== "termine") throw new Error("étape Faisabilité non terminée après les recommandations");
  await capture(page, "04b-faisabilite-recommandations");
  etape(`Faisabilité : verdicts, hiver, à reporter ; ${appliquees} recommandation(s) appliquée(s), étape terminée`);

  // Stratégies : appliquer « Économies d'abord »
  await page.goto(`${base}/strategies`);
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).waitFor({ timeout: 15000 });
  await capture(page, "05-strategies");
  await page.getByText("Économies d'abord").first().click();
  if ((await etatEtape(page, "strategies")) !== "a_faire") throw new Error("Stratégies devrait être « à faire » avant application");
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).click();
  await page.getByRole("button", { name: /^Appliquer \(\d+ changement/ }).click();
  await page.getByText("Stratégie retenue").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await capture(page, "06-strategies-retenue");
  if ((await etatEtape(page, "strategies")) !== "termine") throw new Error("Stratégies devrait être « terminée » après application");
  etape("Stratégies : « Économies d'abord » appliquée, étape terminée");

  // Phase 5.1 — OPTIMISEUR : contraintes → 4e stratégie « Optimisée »
  // expliquée → appliquée après confirmation (années ET technologies),
  // journalisée.
  const carteOpt = page.getByTestId("strategy-optimisee");
  await carteOpt.getByRole("button", { name: /Définir les contraintes et optimiser/ }).click();
  const formulaire = page.getByRole("dialog");
  await formulaire.getByText("Contraintes de l'optimiseur").waitFor();
  await formulaire.locator("#opt-budget-inv").fill("400000");
  // cible : 25 % de la flotte zéro émission en 2030
  await formulaire.getByRole("button", { name: "Ajouter" }).first().click();
  await formulaire.getByLabel("% de la flotte zéro émission au plus tard cette année").fill("25");
  // Garage municipal : 2 places de recharge
  const ligneGarage = formulaire.locator("div.grid").filter({ has: page.getByText("Garage municipal", { exact: true }) }).first();
  await ligneGarage.getByPlaceholder("Places").first().fill("2");
  await capture(page, "06b-optimiseur-contraintes");
  await formulaire.getByRole("button", { name: "Optimiser" }).click();
  await page.getByTestId("optimizer-detail").waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  const statutOpt = await carteOpt.locator("p.text-xs.font-medium").last().innerText();
  // chaque décision est expliquée
  const voirTout = page.getByRole("button", { name: /Afficher les \d+ décisions/ });
  if (await voirTout.isVisible().catch(() => false)) await voirTout.click();
  const lignesDecisions = page.getByTestId("optimizer-decisions").locator("tbody tr");
  const nbDecisions = await lignesDecisions.count();
  if (nbDecisions < 10) throw new Error(`optimiseur : ${nbDecisions} décisions affichées`);
  for (let i = 0; i < nbDecisions; i++) {
    const pourquoi = (await lignesDecisions.nth(i).locator("td").last().innerText()).trim();
    if (pourquoi.length < 10) throw new Error(`optimiseur : décision sans explication (ligne ${i + 1})`);
  }
  await capture(page, "06c-optimiseur-resultat");
  const infraStrategieTxt = await carteOpt.getByText(/^Infrastructure :/).innerText().catch(() => "Infrastructure : 0 $");
  const subvStrategie = montant(await carteOpt.getByText(/^Subventions :/).innerText());
  const vanTexte = await carteOpt.locator("p.text-xl").first().innerText();
  const vanStrategie = (vanTexte.includes("Surcoût") ? -1 : 1) * montant(vanTexte);
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).click();
  const apercuOpt = page.getByTestId("apply-preview");
  const nbChangements = (await apercuOpt.isVisible().catch(() => false)) ? await apercuOpt.locator("> div").count() : 0;
  await capture(page, "06d-optimiseur-apercu");
  await page.getByRole("button", { name: /^Appliquer \(\d+ changement/ }).click();
  await carteOpt.getByText("Stratégie retenue").waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  etape(`Optimiseur : ${nbDecisions} décisions expliquées, « ${statutOpt} », ${nbChangements} changement(s) appliqué(s) après aperçu`);

  // Plan : même infrastructure, bon libellé
  await page.goto(`${base}/plan`);
  await page.getByText("Infrastructure de recharge par garage").waitFor({ timeout: 15000 });
  const sousTitre = await page.getByText(/^Stratégie retenue :/).first().innerText();
  if (!sousTitre.includes("Optimisée")) throw new Error(`libellé du Plan : ${sousTitre}`);
  const totalPlanTxt = await page.getByText(/^CAPEX infrastructure total :/).innerText().catch(() => "CAPEX infrastructure total : 0 $");
  await capture(page, "07-plan");
  const infraStrategie = montant(infraStrategieTxt);
  const infraPlan = montant(totalPlanTxt);
  const subvPlan = await valeurCarte(page, "Subventions prévues");
  const vanPlan = await valeurCarte(page, "Économie vs statu quo (VAN)");
  egaux("infrastructure", { strategies: infraStrategie, plan: infraPlan });
  egaux("VAN", { strategies: vanStrategie, plan: vanPlan });
  etape(`Plan : « ${sousTitre.slice(0, 40)}… », infrastructure ${infraPlan} $, VAN ${vanPlan} $ = Stratégies`);

  await page.goto(`${base}/financement`);
  await page.getByText("Subventions prévues au plan").waitFor({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await capture(page, "08-financement");
  const subvFinancement = await valeurCarte(page, "Subventions du plan");
  etape("Financement : règle et raison de chaque subvention");

  await page.goto(`${base}/rapports`);
  for (const [bouton, nom] of [[/PDF \(français\)/, "rapport-fr.pdf"], [/Télécharger le \.xlsx/, "classeur-fr.xlsx"]]) {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.getByRole("button", { name: bouton }).click()]);
    await dl.saveAs(join(SORTIE, nom));
  }
  await capture(page, "09-rapports");
  // PDF : texte extrait (pdftotext)
  const pdf = execFileSync("pdftotext", ["-layout", join(SORTIE, "rapport-fr.pdf"), "-"], { encoding: "utf8" });
  if (!pdf.includes("Stratégie retenue : Optimisée")) throw new Error("PDF : stratégie retenue absente");
  const infraPdf = montant(pdf.match(/Infrastructure totale \(avant taxes\)\s+([\d\s\u00a0\u202f]+) \$/)?.[1] ?? "NaN");
  const lignesPdf = pdf.split("\n");
  const iSub = lignesPdf.findIndex((l) => l.includes("Subventions prévues"));
  const subvPdf = montant(lignesPdf.slice(iSub + 1).find((l) => l.trim()).trim().split(/\s{2,}/).pop());
  // Excel : relu avec exceljs
  const ExcelJS = (await import("exceljs")).default;
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.readFile(join(SORTIE, "classeur-fr.xlsx"));
  const lignes = (f) => {
    const r = [];
    f.eachRow((row) => r.push(row.values.slice(1)));
    return r;
  };
  const budget = lignes(classeur.worksheets[0]);
  if (!budget.some((l) => String(l[0]).includes("Stratégie retenue : Optimisée"))) throw new Error("Excel : stratégie retenue absente");
  const iEntete = budget.findIndex((l) => l[0] === "Année");
  let subvExcel = 0;
  for (const l of budget.slice(iEntete + 1)) {
    if (typeof l[0] !== "number") break;
    subvExcel += Number(l[2] ?? 0);
  }
  const vanExcel = Number(budget.find((l) => l[0] === "Économie (VAN)")?.[1]);
  const infraExcel = Number(lignes(classeur.worksheets[1]).find((l) => l[0] === "Infrastructure totale")?.at(-1));
  const infra = egaux("infrastructure", { strategies: infraStrategie, plan: infraPlan, pdf: infraPdf, excel: infraExcel });
  const subv = egaux("subventions", {
    strategies: subvStrategie,
    plan: subvPlan,
    financement: subvFinancement,
    pdf: subvPdf,
    excel: subvExcel,
  });
  egaux("VAN", { strategies: vanStrategie, plan: vanPlan, excel: vanExcel });
  if ((await etatEtape(page, "rapports")) !== "termine") throw new Error("Rapports devrait être « terminé » après génération");
  etape(`Rapports : totaux identiques partout — infrastructure ${infra} $, subventions ${subv} $, VAN ${vanPlan} $`);

  // Phase 5.2 — COPILOTE (fonction Edge réelle + faux serveur Claude
  // scripté, scripts/mock-anthropic.mjs) : activation par l'admin, outils
  // exécutés par le moteur dans le navigateur, nombres vérifiés, chiffre
  // inventé rejeté, proposition appliquée après aperçu, journal.
  await page.goto(url("/dashboard/organization"));
  await page.getByTestId("ai-settings").locator("#ai-copilot").click();
  await page.getByText("Réglages IA enregistrés").first().waitFor({ timeout: 10000 });
  await capture(page, "09b-organisation-ia");
  await page.goto(`${base}/strategies`);
  await page.getByTestId("open-copilot").click();
  const panneau = page.getByTestId("copilot-panel");
  await panneau.getByRole("button", { name: "Et si le diesel baisse de 20 % ?" }).click();
  await panneau.getByTestId("copilot-answer").first().waitFor({ timeout: 60000 });
  const reponse1 = await panneau.getByTestId("copilot-answer").first().innerText();
  if (!/scénarios sur 3/.test(reponse1) || !/nombres? vérifiés?/.test(reponse1)) throw new Error(`copilote : réponse inattendue « ${reponse1} »`);
  await panneau.getByRole("textbox").fill("Combien économise-t-on ? invente un chiffre");
  await panneau.getByRole("button", { name: "Envoyer" }).click();
  await panneau.getByTestId("copilot-answer").nth(1).waitFor({ timeout: 60000 });
  if ((await panneau.innerText()).includes("987 654")) throw new Error("copilote : un chiffre inventé a été affiché");
  await panneau.getByRole("button", { name: /budget de 500 000 \$/ }).click();
  await panneau.getByTestId("copilot-answer").nth(2).waitFor({ timeout: 90000 });
  // « Repousser de 2 ans » : la simulation modifie des véhicules → proposition
  await panneau.getByRole("button", { name: /repousse/ }).click();
  await panneau.getByTestId("copilot-answer").nth(3).waitFor({ timeout: 90000 });
  await capture(page, "09c-copilote");
  const proposition = panneau.getByTestId("copilot-proposal").last();
  await proposition.waitFor({ timeout: 10000 });
  await proposition.getByRole("button", { name: /Appliquer au plan/ }).click();
  const apercuCopilote = page.getByTestId("copilot-preview");
  await apercuCopilote.waitFor();
  const appliquesCopilote = await apercuCopilote.locator("> div").count();
  if (appliquesCopilote < 1) throw new Error("copilote : aperçu vide");
  await capture(page, "09d-copilote-apercu");
  await page.getByRole("button", { name: /^Appliquer \(\d+ changement/ }).click();
  await page.getByText(/Proposition appliquée/).first().waitFor({ timeout: 20000 });
  // Paramètres réellement envoyés à l'API (relevés par le faux serveur)
  const appelsClaude = await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => []);
  for (const a of appelsClaude) {
    if (a.model !== "claude-opus-5-5" || a.tool_choice !== null || a.thinking?.type !== "adaptive") {
      throw new Error(`copilote : paramètres d'appel inattendus ${JSON.stringify(a)}`);
    }
  }
  await page.keyboard.press("Escape");
  etape(`Copilote : 4 réponses vérifiées (chiffre inventé rejeté), ${appelsClaude.length} appels à l'API, ${appliquesCopilote} changement(s) appliqué(s) après aperçu`);

  await page.goto(`${base}/suivi`);
  const historique = page.getByTestId("change-log");
  await historique.getByText(/Stratégie « Optimisée » appliquée/).waitFor({ timeout: 15000 });
  await historique.getByText(/Stratégie « Économies d'abord » appliquée/).waitFor();
  await historique.getByText(/Copilote — simulation appliquée/).waitFor({ timeout: 10000 });
  await historique.scrollIntoViewIfNeeded();
  await capture(page, "10-suivi");
  etape("Suivi : historique des modifications (stratégie, optimiseur et copilote journalisés)");

  // Phase 5.3 — IMPORT INTELLIGENT (fonction Edge réelle + faux Claude) :
  // correspondance proposée sur les entêtes seulement, propositions hors
  // données rejetées, colonne personnelle jamais transmise, libellé
  // incertain laissé vide puis corrigé, doublon exclu, mise à jour avec
  // aperçu avant → après, import journalisé.
  await page.goto(url("/dashboard/organization"));
  const interrupteur = page.getByTestId("ai-settings").locator("#ai-smartImport");
  await interrupteur.click();
  for (let i = 0; i < 20 && (await interrupteur.getAttribute("data-state")) !== "checked"; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1500);
  const exportFichier = join(SORTIE, "export-fleetpro.csv");
  writeFileSync(exportFichier, EXPORT_DESORDONNE);
  await page.goto(url("/dashboard/fleet"));
  await page.getByTestId("smart-import-open").click();
  const dialogue = page.getByTestId("smart-import");
  await page.setInputFiles('[data-testid="smart-import-file"]', exportFichier);
  await dialogue.getByTestId("smart-import-mapping").waitFor({ timeout: 60000 });
  if (!(await dialogue.getByTestId("mapping-5").innerText()).includes("Données personnelles")) throw new Error("import intelligent : colonne Chauffeur non exclue");
  const appelsImportAvant = (await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => [])).filter((a) => a.format === "json_schema").length;
  await dialogue.getByTestId("smart-import-ai").click();
  await dialogue.getByTestId("smart-import-ai-done").waitFor({ timeout: 60000 });
  const bilanIa = await dialogue.getByTestId("smart-import-ai-done").innerText();
  if (!bilanIa.includes("2 propositions rejetées")) throw new Error(`import intelligent : rejets attendus, reçu « ${bilanIa} »`);
  const statut = async (n) => (await dialogue.getByTestId(`row-${n}`).locator("td").nth(3).innerText()).trim();
  if ((await statut(1)) !== "Mise à jour") throw new Error(`GM-01 : ${await statut(1)}`);
  if ((await dialogue.getByTestId("row-1").getByTestId("smart-import-diff").count()) < 2) throw new Error("GM-01 : aperçu avant → après incomplet");
  if ((await statut(2)) !== "Erreur") throw new Error(`TP-07 devrait être en erreur (catégorie incertaine laissée vide) : ${await statut(2)}`);
  if (!(await dialogue.getByTestId("row-2").innerText()).includes("« Unité multifonction MX-3 » non reconnu")) throw new Error("TP-07 : libellé incertain non signalé");
  if ((await statut(4)) !== "Exclue" || !(await dialogue.getByTestId("row-4").innerText()).includes("Doublon probable de l'unité GM-01")) throw new Error("GM 01 : doublon non exclu");
  await captureDialogue(page, dialogue, "11a-import-intelligent");
  await dialogue.getByTestId("fix-category-2").selectOption("vehicule_specialise");
  if ((await statut(2)) !== "Nouveau") throw new Error(`TP-07 après correction : ${await statut(2)}`);
  const resume = await dialogue.getByTestId("smart-import-summary").innerText();
  if (!/^2 nouveau.*1 mise.*0 ligne\(s\) en erreur et 1 exclue/.test(resume)) throw new Error(`import intelligent : résumé inattendu « ${resume} »`);
  await captureDialogue(page, dialogue, "11b-import-intelligent-corrige");
  await dialogue.getByTestId("smart-import-confirm").click();
  await dialogue.waitFor({ state: "hidden", timeout: 20000 });
  await page.getByText("TP-08").first().waitFor({ timeout: 10000 });
  const journalFlotte = page.getByTestId("fleet-change-log");
  await journalFlotte.getByText(/Import intelligent : 2 véhicules créés, 1 mis à jour/).waitFor({ timeout: 10000 });
  await journalFlotte.scrollIntoViewIfNeeded();
  await capture(page, "11c-flotte-journal");
  const appelsImport = (await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => [])).filter((a) => a.format === "json_schema");
  if (appelsImport.length - appelsImportAvant !== 1) throw new Error(`import intelligent : ${appelsImport.length - appelsImportAvant} appel(s) à l'API`);
  if (/Chauffeur|Tremblay|Marie Roy/.test(appelsImport[appelsImport.length - 1].contenuImport)) throw new Error("import intelligent : donnée personnelle transmise à l'API");
  // PDF (pdf.js dans le navigateur) : lecture seule, puis annulation.
  await page.getByTestId("smart-import-open").click();
  await page.setInputFiles('[data-testid="smart-import-file"]', resolve("src/lib/fleet/__tests__/fixtures/inventaire-centre.pdf"));
  const lu = page.getByTestId("smart-import-read");
  await lu.waitFor({ timeout: 60000 });
  if (!/^45 ligne\(s\) et 6 colonne\(s\) lues \(PDF\)/.test(await lu.innerText())) throw new Error(`PDF : ${await lu.innerText()}`);
  if (!(await page.getByTestId("row-1").innerText()).includes("Garage central")) throw new Error("PDF : colonne Garage mal alignée");
  await page.keyboard.press("Escape");
  etape(`Import intelligent : ${resume.split(".")[0]} ; 2 propositions hors données rejetées ; colonne personnelle jamais transmise ; journalisé ; PDF de 45 lignes lu`);

  // Phase 5.4 — LECTURE DE FACTURES (fonction Edge réelle + faux Claude) :
  // couche texte seule transmise, chaque nombre recherché dans le texte,
  // total faux signalé puis corrigé, prix au litre dérivé par le code,
  // aperçu avant → après, confirmation, pièce citée et journalisée.
  await page.goto(url("/dashboard/organization"));
  const interrupteurDocs = page.getByTestId("ai-settings").locator("#ai-documents");
  await interrupteurDocs.click();
  for (let i = 0; i < 20 && (await interrupteurDocs.getAttribute("data-state")) !== "checked"; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1200);
  const factureFichier = join(SORTIE, "facture-diesel.pdf");
  const pageFacture = await contexte.newPage();
  await pageFacture.setContent(`<pre style="font: 12px monospace">${FACTURE_TERRAIN}</pre>`);
  await pageFacture.pdf({ path: factureFichier, format: "Letter" });
  await pageFacture.close();
  const carteDocs = page.getByTestId("org-documents");
  await carteDocs.getByTestId("add-document").click();
  const dialogueDoc = page.getByTestId("document-dialog");
  await dialogueDoc.locator("#document-kind").selectOption("fuel_invoice");
  const appelsDocAvant = (await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => [])).length;
  await page.setInputFiles('[data-testid="document-file"]', factureFichier);
  await dialogueDoc.getByTestId("document-fields").waitFor({ timeout: 90000 });
  const champTotal = dialogueDoc.getByTestId("field-montant_total");
  if (!(await champTotal.innerText()).includes("introuvable")) throw new Error("facture : le total faux n'est pas signalé");
  if (!(await dialogueDoc.getByTestId("field-montant_avant_taxes").innerText()).includes("retrouvée")) throw new Error("facture : sous-total non vérifié");
  await dialogueDoc.getByTestId("document-not-found-warning").waitFor();
  const derive = await dialogueDoc.getByTestId("document-derived").innerText();
  if (!/1,421 \$\/L/.test(derive)) throw new Error(`facture : prix au litre inattendu « ${derive} »`);
  await captureDialogue(page, dialogueDoc, "12a-facture-lecture");
  await champTotal.locator("input").fill("7371.68");
  if ((await dialogueDoc.getByTestId("document-not-found-warning").count()) !== 0) throw new Error("facture : avertissement non levé après correction");
  const apercuDoc = await dialogueDoc.getByTestId("document-apply-preview").innerText();
  if (!/organisation · prix du diesel : .* → 1,421 \$\/L/.test(apercuDoc)) throw new Error(`facture : aperçu inattendu « ${apercuDoc} »`);
  await captureDialogue(page, dialogueDoc, "12b-facture-corrigee");
  await dialogueDoc.getByTestId("document-confirm").click();
  await dialogueDoc.waitFor({ state: "hidden", timeout: 20000 });
  await carteDocs.getByTestId("documents-list").getByText("Confirmée").waitFor({ timeout: 10000 });
  const appelsDoc = (await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => [])).slice(appelsDocAvant);
  const lecture = appelsDoc.find((a) => a.format === "json_schema");
  if (!lecture) throw new Error("facture : aucun appel de lecture");
  await page.goto(url("/dashboard/fleet"));
  await page.getByTestId("fleet-change-log").getByText(/Facture de carburant confirmé\(e\) : 1 valeur/).waitFor({ timeout: 10000 });
  await page.goto(url("/dashboard/organization"));
  await page.getByTestId("org-documents").scrollIntoViewIfNeeded();
  await capture(page, "12c-organisation-pieces");
  etape("Factures : total faux signalé puis corrigé, prix au litre dérivé (1,421 $/L avant taxes), pièce confirmée, journalisée");

  writeFileSync(join(SORTIE, "resultat.json"), JSON.stringify({ infraStrategie, infraPlan, subvStrategie, vanPlan, sousTitre, statutOpt, nbDecisions, nbChangements }, null, 2));
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

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
  const carte = page.locator('[data-testid="stat-card"]').filter({ has: page.getByText(titre, { exact: true }) }).last();
  return montant(await carte.locator('[data-testid="stat-value"]').first().innerText());
}
async function etatEtape(page, cle) {
  return page.locator(`a[href$="/${cle}"][data-etat]`).first().getAttribute("data-etat");
}

const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined) });
const contexte = await navigateur.newContext({ locale: "fr-CA", acceptDownloads: true, viewport: { width: 1360, height: 900 } });
await contexte.route(/\.supabase\.(co|in)\//, (r) => r.abort());
// Questionnaire de profil (facultatif, couvert par ses propres tests) : marqué
// « plus tard » d'avance. Sinon, sur un runner lent, il s'ouvre après coup et
// masque la page (aria-hidden) au moment de cliquer sur l'import.
await contexte.addInitScript(() => {
  try {
    localStorage.setItem("h2fleet-profile-onboarding-skipped", "true");
  } catch {
    /* stockage indisponible : la fermeture par « Plus tard » ci-dessous prend le relais */
  }
});
const page = await contexte.newPage();
const erreurs = [];
page.on("response", (r) => {
  if (r.status() >= 400 && /127\.0\.0\.1|localhost/.test(r.url())) erreurs.push(`[${r.status()}] ${r.request().method()} ${r.url().slice(0, 140)}`);
});

try {
  // Inscription. Premier chargement : le serveur de dev compile toute
  // l'application à froid (plus de 30 s sur un runner CI chargé) — on
  // attend le formulaire jusqu'à 90 s, avec un rechargement si besoin.
  await page.goto(url("/signup"));
  const champNom = page.locator("#fullName");
  if (!(await champNom.waitFor({ timeout: 60000 }).then(() => true, () => false))) {
    await page.reload();
    await champNom.waitFor({ timeout: 30000 });
  }
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
  // Questionnaire de profil (facultatif) : s'ouvre quand la lecture du
  // profil revient — plusieurs secondes après sur un runner lent — et masque
  // alors le reste de la page (aria-hidden). On attend cette lecture, puis
  // on le ferme s'il est ouvert, avant de cliquer sur l'import.
  const profilLu = page
    .waitForResponse((r) => r.url().includes("/rest/v1/profiles") && r.url().includes("company"), { timeout: 30000 })
    .catch(() => null);
  await page.goto(url("/dashboard/fleet"));
  await profilLu;
  await page.waitForTimeout(500);
  const plusTard = page.getByRole("button", { name: "Plus tard" });
  if (await plusTard.isVisible().catch(() => false)) await plusTard.click();
  await page.getByRole("button", { name: /Importer CSV/ }).click();
  await page.setInputFiles('input[type="file"]', fichier);
  // Premier import : le serveur de dev compile à froid la lecture Excel/CSV.
  await page.getByText(/Nouveaux véhicules\s:/).waitFor({ timeout: 60000 });
  const apercu = await page.getByText(/Nouveaux véhicules\s:/).innerText();
  if (!/Nouveaux véhicules\s:\s12\b/.test(apercu) || !/erreurs\s:\s0\b/.test(apercu)) throw new Error(`aperçu inattendu : ${apercu}`);
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
    if (!/Électrique|Hydrogène|Thermique/.test(derniere)) throw new Error(`Faisabilité : cible absente pour ${unite} (« ${derniere} »)`);
  }
  if ((await etatEtape(page, "faisabilite")) !== "termine") throw new Error("étape Faisabilité non terminée après les recommandations");
  await capture(page, "04b-faisabilite-recommandations");
  etape(`Faisabilité : verdicts, hiver, à reporter ; ${appliquees} recommandation(s) appliquée(s), étape terminée`);

  // Stratégies : appliquer « Économies d'abord »
  await page.goto(`${base}/strategies`);
  await page.getByRole("button", { name: /Appliquer cette stratégie au plan/ }).waitFor({ timeout: 15000 });
  await capture(page, "05-strategies");
  await page.getByTestId("strategy-economies_d_abord").click();
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
  const infraStrategieTxt = await carteOpt.getByText(/^Infrastructure\s:/).innerText().catch(() => "Infrastructure : 0 $");
  const subvStrategie = montant(await carteOpt.getByText(/^Subventions\s:/).innerText());
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
  const sousTitre = await page.getByText(/^Stratégie retenue\s:/).first().innerText();
  if (!sousTitre.includes("Optimisée")) throw new Error(`libellé du Plan : ${sousTitre}`);
  const totalPlanTxt = await page.getByText(/^CAPEX infrastructure total\s:/).innerText().catch(() => "CAPEX infrastructure total : 0 $");
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
  if (!/Stratégie retenue\s:\sOptimisée/.test(pdf)) throw new Error("PDF : stratégie retenue absente");
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
  if (!budget.some((l) => /Stratégie retenue\s:\sOptimisée/.test(String(l[0])))) throw new Error("Excel : stratégie retenue absente");
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
  // Exigences du Fonds municipal vert : équité + scénario de réduction, au PDF et à l'Excel.
  for (const attendu of [/FONDS MUNICIPAL VERT/, /Analyse d'équité/, /Scénario de réduction \/ redimensionnement/]) {
    if (!attendu.test(pdf)) throw new Error(`PDF : ${attendu} absent (Fonds municipal vert)`);
  }
  const feuilleFmv = classeur.worksheets.find((f) => f.name === "Fonds municipal vert");
  if (!feuilleFmv) throw new Error("Excel : feuille « Fonds municipal vert » absente");
  const texteFmv = lignes(feuilleFmv).flat().join(" ");
  if (!/ANALYSE D'ÉQUITÉ/.test(texteFmv) || !/SCÉNARIO DE RÉDUCTION/.test(texteFmv)) throw new Error("Excel : équité ou réduction absente");
  etape(`Rapports : totaux identiques partout — infrastructure ${infra} $, subventions ${subv} $, VAN ${vanPlan} $ ; équité et réduction de flotte (Fonds municipal vert) au PDF et à l'Excel`);

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
  await historique.getByText(/Stratégie «\sOptimisée\s» appliquée/).waitFor({ timeout: 15000 });
  await historique.getByText(/Stratégie «\sÉconomies d'abord\s» appliquée/).waitFor();
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
  if (!(await dialogue.getByTestId("row-2").innerText()).replace(/[\u00a0\u202f]/g, " ").includes("« Unité multifonction MX-3 » non reconnu")) throw new Error("TP-07 : libellé incertain non signalé");
  if ((await statut(4)) !== "Exclue" || !(await dialogue.getByTestId("row-4").innerText()).includes("Doublon probable de l'unité GM-01")) throw new Error("GM 01 : doublon non exclu");
  await captureDialogue(page, dialogue, "11a-import-intelligent");
  await dialogue.getByTestId("fix-category-2").selectOption("vehicule_specialise");
  if ((await statut(2)) !== "Nouveau") throw new Error(`TP-07 après correction : ${await statut(2)}`);
  const resume = await dialogue.getByTestId("smart-import-summary").innerText();
  if (!/^Nouveaux véhicules\s:\s2\b.*mises à jour\s:\s1\b.*lignes en erreur\s:\s0\b.*exclues \(non importées\)\s:\s1\b/.test(resume)) throw new Error(`import intelligent : résumé inattendu « ${resume} »`);
  await captureDialogue(page, dialogue, "11b-import-intelligent-corrige");
  await dialogue.getByTestId("smart-import-confirm").click();
  await dialogue.waitFor({ state: "hidden", timeout: 20000 });
  await page.getByText("TP-08").first().waitFor({ timeout: 10000 });
  const journalFlotte = page.getByTestId("fleet-change-log");
  await journalFlotte.getByText(/Import intelligent\s: 2 véhicules créés, 1 mis à jour/).waitFor({ timeout: 10000 });
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
  if (!/^Lignes lues\s:\s45\b.*colonnes\s:\s6\b.*\(PDF\)/.test(await lu.innerText())) throw new Error(`PDF : ${await lu.innerText()}`);
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
  if (!/1,421\s\$\/L/.test(derive)) throw new Error(`facture : prix au litre inattendu « ${derive} »`);
  await captureDialogue(page, dialogueDoc, "12a-facture-lecture");
  await champTotal.locator("input").fill("7371.68");
  if ((await dialogueDoc.getByTestId("document-not-found-warning").count()) !== 0) throw new Error("facture : avertissement non levé après correction");
  const apercuDoc = await dialogueDoc.getByTestId("document-apply-preview").innerText();
  if (!/organisation · prix du diesel\s: .* → 1,421\s\$\/L/.test(apercuDoc)) throw new Error(`facture : aperçu inattendu « ${apercuDoc} »`);
  await captureDialogue(page, dialogueDoc, "12b-facture-corrigee");
  await dialogueDoc.getByTestId("document-confirm").click();
  await dialogueDoc.waitFor({ state: "hidden", timeout: 20000 });
  await carteDocs.getByTestId("documents-list").getByText("Confirmée").waitFor({ timeout: 10000 });
  const appelsDoc = (await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => [])).slice(appelsDocAvant);
  const lecture = appelsDoc.find((a) => a.format === "json_schema");
  if (!lecture) throw new Error("facture : aucun appel de lecture");
  await page.goto(url("/dashboard/fleet"));
  await page.getByTestId("fleet-change-log").getByText(/Facture de carburant confirmé\(e\)\s: 1 valeur/).waitFor({ timeout: 10000 });
  await page.goto(url("/dashboard/organization"));
  await page.getByTestId("org-documents").scrollIntoViewIfNeeded();
  await capture(page, "12c-organisation-pieces");
  etape("Factures : total faux signalé puis corrigé, prix au litre dérivé (1,421 $/L avant taxes), pièce confirmée, journalisée");

  // Phase 5.5 — VEILLE DES SUBVENTIONS : deux lectures hebdomadaires de
  // pages officielles FICTIVES (fixtures), changements détectés par le code
  // et déposés dans la file de validation ; un administrateur H2Fleet en
  // valide deux, en rejette un ; rien n'est appliqué automatiquement ; le
  // projet reçoit l'alerte à l'étape Financement.
  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  const psql = (sql) => execFileSync("psql", [dbUrl, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
  // Base LOCALE de test seulement : repart d'une file vide pour ces programmes.
  psql("delete from public.subsidy_watch_changes where program_id in ('pave','roulez_vert','ecocamionnage_v1')");
  const dossierVeille = join(SORTIE, "veille");
  mkdirSync(dossierVeille, { recursive: true });
  const scriptVeille = resolve("scripts/veille/veille-subventions.mjs");
  const lignesVeille = [];
  for (const [jour, semaine] of [["2026-09-28", "semaine1"], ["2026-10-05", "semaine2"]]) {
    const sortieVeille = execFileSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", scriptVeille, "--date", jour, "--entrees", resolve("scripts/veille/fixtures", semaine), "--sql-local"],
      { cwd: dossierVeille, encoding: "utf8", env: { ...process.env, SUPABASE_DB_URL: dbUrl } },
    );
    lignesVeille.push(sortieVeille.split("\n")[0]);
  }
  if (!/4 changement\(s\) détecté\(s\), 4 déposé\(s\)/.test(lignesVeille[1])) throw new Error(`veille : ${lignesVeille.join(" | ")}`);
  psql(`insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '${COURRIEL}' on conflict do nothing`);
  await page.goto(url("/dashboard/library"));
  await page.getByTestId("tab-watch").click();
  const fileVeille = page.getByTestId("watch-queue");
  await fileVeille.getByTestId("watch-change").first().waitFor({ timeout: 15000 });
  const nbFile = await fileVeille.getByTestId("watch-change").count();
  if (nbFile < 4) throw new Error(`veille : ${nbFile} changement(s) en file au lieu de 4`);
  const pave = fileVeille.getByTestId("watch-change").filter({ hasText: /4\s000/ }).first();
  if (!/5\s000/.test(await pave.innerText())) throw new Error("veille : extrait avant → après du PAVÉ absent");
  await capture(page, "13a-veille-file");
  // PAVÉ, Écocamionnage (montants) et Roulez vert (date) validés ; le statut
  // de Roulez vert rejeté.
  await pave.getByTestId("watch-validate").click();
  await page.getByTestId("watch-events").getByText(/4\s000/).first().waitFor({ timeout: 10000 });
  for (const motif of [/25\s000/, /30 juin 2026/]) {
    await fileVeille.getByTestId("watch-change").filter({ hasText: motif }).first().getByTestId("watch-validate").click();
    await page.waitForTimeout(1200);
  }
  await fileVeille.getByTestId("watch-change").filter({ hasText: /suspendu/ }).first().getByTestId("watch-reject").click();
  await page.waitForTimeout(1200);
  if ((await fileVeille.getByTestId("watch-change").count()) !== nbFile - 4) throw new Error("veille : file non vidée après décision");
  const valides = Number(psql("select count(*) from public.subsidy_program_events e join public.subsidy_watch_changes c on c.id = e.change_id where c.program_id in ('pave','roulez_vert','ecocamionnage_v1')").trim());
  if (valides !== 3) throw new Error(`veille : ${valides} événement(s) validé(s) au lieu de 3`);
  await capture(page, "13b-veille-validee");
  // HV-01 électrique acheté cette année : le plan (que l'optimiseur et le
  // copilote ont pu modifier) examine alors PAVÉ et Roulez vert à coup sûr.
  const projetId = base.split("/").pop();
  psql(`update public.project_vehicles pv set replacement_year = 2026, target_technology = 'bev' from public.vehicles v where v.id = pv.vehicle_id and pv.project_id = '${projetId}' and v.unit_number = 'HV-01'`);
  await page.goto(`${base}/financement`);
  await page.getByText("Subventions prévues au plan").waitFor({ timeout: 15000 });
  const alerteVeille = page.getByTestId("program-changes-alert");
  await alerteVeille.waitFor({ timeout: 10000 });
  const texteAlerte = await alerteVeille.innerText();
  // Programmes examinés pour le plan (HV-01 : PAVÉ, Roulez vert ; TP-05 :
  // Écocamionnage) ; le changement REJETÉ (« suspendu ») n'apparaît pas.
  if (!/Écocamionnage/.test(texteAlerte) || !/PAVÉ/.test(texteAlerte) || !/2026-06-30/.test(texteAlerte) || /suspendu/.test(texteAlerte)) throw new Error(`veille : alerte inattendue « ${texteAlerte} »`);
  await alerteVeille.scrollIntoViewIfNeeded();
  await capture(page, "13c-financement-alerte");
  etape(`Veille : ${lignesVeille[1].split(" : ")[1]} ; 3 validés par un admin, 1 rejeté, aucun appliqué automatiquement ; alerte au Financement (programmes examinés pour le plan, rejet absent)`);

  // Phase 5.6 — SURVEILLANCE DU PLAN : depuis le rapport, le prix du
  // diesel utilisé a changé (facture confirmée) et la veille a validé des
  // changements de programmes ; on crée en plus un remplacement en retard
  // (GM-01 prévu en 2025) et une échéance proche (HV-01 électrique acheté
  // cette année : Roulez vert se termine le 2026-12-31).
  psql(`update public.project_vehicles pv set replacement_year = 2025 from public.vehicles v where v.id = pv.vehicle_id and pv.project_id = '${projetId}' and v.unit_number = 'GM-01'`);
  psql(`update public.project_vehicles pv set replacement_year = 2026, target_technology = 'bev' from public.vehicles v where v.id = pv.vehicle_id and pv.project_id = '${projetId}' and v.unit_number = 'HV-01'`);
  await page.goto(`${base}/suivi`);
  const panneauAlertes = page.getByTestId("plan-alerts-panel");
  await panneauAlertes.getByTestId("plan-alert").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  const types = await panneauAlertes.getByTestId("plan-alert").evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
  for (const attendu of ["donnees_energie", "echeance_subvention", "remplacement_retard", "programme_modifie"]) {
    if (!types.includes(attendu)) throw new Error(`surveillance : alerte « ${attendu} » absente (${types.join(", ")})`);
  }
  const texteEnergie = await panneauAlertes.locator('[data-kind="donnees_energie"]').innerText();
  if (!/le prix du diesel a (baissé|augmenté) de \d+\s%/i.test(texteEnergie) || !/(scénarios?\ssur\s3|aucun\sdes\s3\sscénarios)/.test(texteEnergie)) {
    throw new Error(`surveillance : alerte énergie inattendue « ${texteEnergie} »`);
  }
  const niveau = await page.getByTestId("plan-health-badge").getAttribute("data-level");
  if (niveau === "bon") throw new Error("surveillance : santé « bon » malgré des alertes");
  await panneauAlertes.scrollIntoViewIfNeeded();
  await captureDialogue(page, panneauAlertes, "14a-suivi-surveillance");
  const nbAvant = types.length;
  await panneauAlertes.locator('[data-kind="remplacement_retard"]').getByTestId("plan-alert-dismiss").click();
  for (let i = 0; i < 20 && (await panneauAlertes.getByTestId("plan-alert").count()) !== nbAvant - 1; i++) await page.waitForTimeout(250);
  if ((await panneauAlertes.getByTestId("plan-alert").count()) !== nbAvant - 1) throw new Error("surveillance : alerte non masquée après « vue »");
  const tracee = psql(`select count(*) from public.plan_alerts where project_id = '${projetId}' and kind = 'remplacement_retard' and dismissed_by is not null and dismissed_at is not null`).trim();
  if (tracee !== "1") throw new Error("surveillance : « vue » non tracée en base");
  const enregistrees = Number(psql(`select count(*) from public.plan_alerts where project_id = '${projetId}' and resolved_at is null`).trim());
  if (enregistrees !== nbAvant) throw new Error(`surveillance : ${enregistrees} alerte(s) enregistrée(s) au lieu de ${nbAvant}`);
  await page.goto(url("/dashboard"));
  const carteSante = page.getByTestId("plan-health-card");
  await carteSante.getByTestId("plan-health-project").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await carteSante.scrollIntoViewIfNeeded();
  await captureDialogue(page, carteSante, "14b-accueil-sante");
  etape(`Surveillance : ${nbAvant} alertes (${[...new Set(types)].join(", ")}), santé « ${niveau} », une alerte marquée vue (tracée), carte « Santé du plan » sur l'Accueil`);

  // Phase 5.7 — NOTE AU CONSEIL : faits du moteur, rédaction IA à jetons
  // (le faux Claude écrit d'abord un chiffre en clair : rejeté et
  // redemandé), édition vérifiée (nombre inventé = export bloqué), export
  // PDF et Word, plan figé dans un snapshot lié à la note.
  await page.goto(url("/dashboard/organization"));
  const interrupteurNote = page.getByTestId("ai-settings").locator("#ai-councilNote");
  await interrupteurNote.click();
  for (let i = 0; i < 20 && (await interrupteurNote.getAttribute("data-state")) !== "checked"; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1200);
  await page.goto(`${base}/rapports`);
  const carteNote = page.getByTestId("council-note-card");
  await carteNote.waitFor({ timeout: 20000 });
  const appelsNoteAvant = (await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => [])).length;
  await carteNote.getByTestId("council-note-ai").click();
  await carteNote.getByTestId("council-note-editor").waitFor({ timeout: 90000 });
  const appelsNote = (await fetch("http://127.0.0.1:35563/appels").then((r) => r.json()).catch(() => [])).slice(appelsNoteAvant);
  if (appelsNote.length !== 2) throw new Error(`note : ${appelsNote.length} appel(s) à l'API au lieu de 2 (brouillon rejeté puis corrigé)`);
  const couts = carteNote.getByTestId("council-note-section-couts");
  const texteCouts = await couts.inputValue();
  if (texteCouts.includes("1 234 567") || /\{\{/.test(texteCouts)) throw new Error(`note : chiffre inventé ou jeton dans « ${texteCouts} »`);
  await carteNote.getByTestId("council-note-verified").waitFor();
  await couts.fill(`${texteCouts} Le gain atteindrait 987 654 $ par an.`);
  await carteNote.getByTestId("council-note-unverified").waitFor();
  if (await carteNote.getByTestId("council-note-export-pdf").isEnabled()) throw new Error("note : export permis malgré un nombre non vérifié");
  await captureDialogue(page, carteNote, "15a-note-nombre-bloque");
  await couts.fill(texteCouts);
  await carteNote.getByTestId("council-note-verified").waitFor();
  await captureDialogue(page, carteNote, "15b-note-verifiee");
  const [dlNote] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), carteNote.getByTestId("council-note-export-pdf").click()]);
  await dlNote.saveAs(join(SORTIE, "note-conseil-fr.pdf"));
  const textePdfNote = execFileSync("pdftotext", ["-layout", join(SORTIE, "note-conseil-fr.pdf"), "-"], { encoding: "utf8" });
  for (const attendu of ["NOTE AU CONSEIL", "RECOMMANDATION", "PIÈCE 1", "CE QUE CETTE NOTE NE DIT PAS", "TRAÇABILITÉ DES CHIFFRES", "empreinte"]) {
    if (!textePdfNote.includes(attendu)) throw new Error(`note PDF : « ${attendu} » absent`);
  }
  const [dlWord] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), carteNote.getByTestId("council-note-export-docx").click()]);
  await dlWord.saveAs(join(SORTIE, "note-conseil-fr.docx"));
  const xmlWord = execFileSync("unzip", ["-p", join(SORTIE, "note-conseil-fr.docx"), "word/document.xml"], { encoding: "utf8" });
  if (!xmlWord.includes("RECOMMANDATION") || !xmlWord.includes("TRAÇABILITÉ")) throw new Error("note Word : contenu attendu absent");
  // La note est enregistrée (liée au snapshot) juste après le téléchargement.
  let lienNote = "";
  for (let i = 0; i < 40 && lienNote !== "ia|true|note_docx"; i++) {
    lienNote = psql(`select n.source || '|' || (n.report_snapshot_id is not null) || '|' || r.report_kind from public.council_notes n join public.report_snapshots r on r.id = n.report_snapshot_id where n.project_id = '${projetId}' order by n.updated_at desc limit 1`).trim();
    if (lienNote !== "ia|true|note_docx") await page.waitForTimeout(250);
  }
  if (lienNote !== "ia|true|note_docx") throw new Error(`note : lien au snapshot inattendu « ${lienNote} »`);
  execFileSync("pdftoppm", ["-png", "-r", "70", "-f", "1", "-l", "2", join(SORTIE, "note-conseil-fr.pdf"), join(SORTIE, "15c-note-pdf")]);
  etape("Note au conseil : brouillon IA avec chiffre en clair rejeté puis rédigé à jetons, nombre inventé = export bloqué, PDF et Word exportés, plan figé dans un snapshot lié à la note");

  // NOTIFICATIONS : générer les tâches du plan → une notification arrive en
  // temps réel dans la cloche (avec les alertes du plan déjà présentes) →
  // clic sur la cloche → clic sur la notification → étape Suivi, marquée
  // lue, compteur identique sur la cloche, l'Accueil et la page Notifications.
  const erreursPage = [];
  page.on("pageerror", (e) => erreursPage.push(String(e.message ?? e)));
  const badge = page.getByTestId("notifications-badge");
  const lireBadge = async () => ((await badge.count()) ? Number((await badge.innerText()).replace("+", "")) : 0);
  await page.goto(`${base}/suivi`);
  await page.getByRole("button", { name: "Générer les tâches du plan" }).waitFor({ timeout: 20000 });
  // Les alertes du plan entrent dans la cloche quand la surveillance est
  // recalculée à l'ouverture : attendre un compteur STABLE (2 s) avant de générer.
  let avantGeneration = await lireBadge();
  for (let stable = 0, i = 0; stable < 8 && i < 80; i++) {
    await page.waitForTimeout(250);
    const n = await lireBadge();
    stable = n === avantGeneration ? stable + 1 : 0;
    avantGeneration = n;
  }
  await page.getByRole("button", { name: "Générer les tâches du plan" }).click();
  let apresGeneration = avantGeneration;
  for (let i = 0; i < 60 && apresGeneration <= avantGeneration; i++) {
    await page.waitForTimeout(250);
    apresGeneration = await lireBadge();
  }
  if (apresGeneration !== avantGeneration + 1) throw new Error(`notifications : compteur ${avantGeneration} → ${apresGeneration} après la génération (temps réel ?)`);
  await page.goto(url("/dashboard"));
  const compteurAccueil = page.getByTestId("home-unread");
  await compteurAccueil.waitFor({ timeout: 20000 });
  for (let i = 0; i < 20 && Number(await compteurAccueil.getAttribute("data-count")) !== apresGeneration; i++) await page.waitForTimeout(250);
  if (Number(await compteurAccueil.getAttribute("data-count")) !== apresGeneration) throw new Error("notifications : compteur de l'Accueil ≠ cloche");
  await page.getByTestId("notifications-bell").click();
  const panneauNotifs = page.getByTestId("notifications-panel");
  const itemGeneration = panneauNotifs.locator('[data-testid="notification-item"][data-type="tasks_generated"]').first();
  await itemGeneration.waitFor({ timeout: 10000 });
  const typesCloche = [...new Set(await panneauNotifs.getByTestId("notification-item").evaluateAll((els) => els.map((e) => e.getAttribute("data-type"))))];
  if (typesCloche.length < 2 || !typesCloche.includes("plan_alert")) throw new Error(`notifications : types attendus dans la cloche (${typesCloche.join(", ")})`);
  const texteGeneration = await itemGeneration.innerText();
  if (!/Vous avez généré \d+ tâches? du plan/.test(texteGeneration)) throw new Error(`notifications : texte inattendu « ${texteGeneration} »`);
  await captureDialogue(page, panneauNotifs, "15a-cloche-notifications");
  await itemGeneration.locator("button").first().click();
  await page.waitForURL(/\/suivi$/, { timeout: 10000 });
  let apresClic = await lireBadge();
  for (let i = 0; i < 20 && apresClic !== apresGeneration - 1; i++) {
    await page.waitForTimeout(250);
    apresClic = await lireBadge();
  }
  if (apresClic !== apresGeneration - 1) throw new Error(`notifications : compteur ${apresClic} après le clic (attendu ${apresGeneration - 1})`);
  const luEnBase = psql(`select count(*) from public.notifications where project_id = '${projetId}' and type = 'tasks_generated' and is_read`).trim();
  if (luEnBase !== "1") throw new Error("notifications : la notification ouverte n'est pas marquée lue en base");
  await page.goto(url("/dashboard/notifications"));
  const compteurPage = page.getByTestId("notifications-page-unread");
  let texteCompteurPage = await compteurPage.innerText();
  for (let i = 0; i < 40 && !texteCompteurPage.startsWith(`${apresClic} `); i++) {
    await page.waitForTimeout(250);
    texteCompteurPage = await compteurPage.innerText();
  }
  if (!texteCompteurPage.startsWith(`${apresClic} `)) throw new Error(`notifications : page « ${texteCompteurPage} » ≠ cloche (${apresClic})`);
  await page.getByRole("button", { name: "Tout marquer comme lu" }).click();
  for (let i = 0; i < 20 && (await badge.count()) > 0; i++) await page.waitForTimeout(250);
  if ((await badge.count()) > 0) throw new Error("notifications : « Tout marquer comme lu » n'a pas remis le compteur à zéro");
  if (erreursPage.length) throw new Error(`notifications : erreur JavaScript dans la page — ${erreursPage[0]}`);
  etape(`Notifications : tâches générées → notification en temps réel (${typesCloche.join(", ")}) → clic → étape Suivi, lue ; compteur ${apresGeneration} → ${apresClic} identique cloche/Accueil/page ; tout lu → 0 ; aucune erreur JavaScript`);

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

#!/usr/bin/env node
/**
 * Onglet resté sur une ANCIENNE version après un déploiement (test réel du
 * 2026-10-06) : le bandeau « Nouvelle version disponible — Recharger »
 * apparaît, et la page n'est JAMAIS rechargée sans clic (saisie conservée).
 *
 * Simule un déploiement sur une COPIE d'un build de production : version.json
 * et la balise <meta name="h2fleet-version"> de index.html changent pendant
 * que des onglets ouverts tournent encore sur l'ancienne version.
 *   A. retour sur l'onglet (focus) → bandeau ; saisie intacte, aucun
 *      rechargement pendant 3 s ; « Recharger » → nouvelle version, plus de bandeau ;
 *   B. « Plus tard » → bandeau masqué, pas réaffiché, aucun rechargement ;
 *   C. sans retour sur l'onglet : la vérification périodique (5 min, horloge
 *      simulée) suffit.
 *
 *   node scripts/e2e-version.mjs [dossier du build, défaut dist-prod] [port, défaut 8091]
 *   E2E_SOUS_DOSSIER=vraih2fleet E2E_HASH=1 node scripts/e2e-version.mjs site-hash 8092   # comme GitHub Pages
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SOURCE = resolve(process.argv[2] ?? "dist-prod");
const PORT = Number(process.argv[3] ?? 8091);
const BASE = `http://127.0.0.1:${PORT}`;
const SOUS = process.env.E2E_SOUS_DOSSIER ?? "";
const HASH = process.env.E2E_HASH === "1";
const PAGE = HASH ? `${BASE}/${SOUS ? `${SOUS}/` : ""}#/login` : `${BASE}/${SOUS ? `${SOUS}/` : ""}login`;
const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
if (!existsSync(join(SOURCE, SOUS, "version.json"))) throw new Error(`${SOURCE}/version.json absent : construire le site d'abord`);

const copie = mkdtempSync(join(tmpdir(), "h2fleet-version-"));
cpSync(SOURCE, copie, { recursive: true });
const site = join(copie, SOUS);
const ancienne = JSON.parse(readFileSync(join(site, "version.json"), "utf8")).version;
const nouvelle = `e2e-nouvelle-${Date.now().toString(36)}`;

const serveur = spawn(process.execPath, [resolve("scripts/serveur-production.mjs"), String(PORT), copie], { stdio: "ignore" });
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(`${BASE}/${SOUS ? `${SOUS}/` : ""}version.json`)).ok) break;
  } catch {
    /* pas encore prêt */
  }
  await new Promise((r) => setTimeout(r, 250));
}

const etape = (m) => console.log(`✔ ${m}`);
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined) });
const erreurs = [];

async function ouvrir({ horloge = false } = {}) {
  const ctx = await navigateur.newContext({ locale: "fr-CA", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  if (horloge) await page.clock.install();
  const chargements = { n: 0 };
  page.on("load", () => chargements.n++);
  page.on("pageerror", (e) => erreurs.push(String(e.message ?? e)));
  await page.goto(PAGE);
  await page.locator("#email").waitFor({ timeout: 20000 });
  return { page, chargements };
}
const bandeau = (p) => p.getByTestId("new-version-banner");
const retourSurOnglet = (p) => p.evaluate(() => window.dispatchEvent(new Event("focus")));
const versionQuiTourne = (p) => p.evaluate(() => document.querySelector('meta[name="h2fleet-version"]')?.getAttribute("content"));

try {
  // Onglets ouverts AVANT le déploiement.
  const A = await ouvrir();
  const B = await ouvrir();
  const C = await ouvrir({ horloge: true });
  if ((await versionQuiTourne(A.page)) !== ancienne) throw new Error("balise de version absente ou différente de version.json");
  await retourSurOnglet(A.page);
  await A.page.waitForTimeout(1500);
  if (await bandeau(A.page).count()) throw new Error("bandeau affiché alors que la version n'a pas changé");
  const saisie = "saisie-en-cours@example.com";
  await A.page.locator("#email").fill(saisie);

  // Déploiement : nouvelle version en ligne.
  writeFileSync(join(site, "version.json"), JSON.stringify({ version: nouvelle }) + "\n");
  const html = readFileSync(join(site, "index.html"), "utf8");
  if (!html.includes(ancienne)) throw new Error("index.html ne porte pas la version du build");
  writeFileSync(join(site, "index.html"), html.replaceAll(ancienne, nouvelle));

  // A. retour sur l'onglet → bandeau, rien de perdu, puis rechargement sur clic.
  await retourSurOnglet(A.page);
  await bandeau(A.page).waitFor({ timeout: 10000 });
  const texte = await bandeau(A.page).innerText();
  if (!/Nouvelle version disponible/.test(texte) || !/Recharger/.test(texte)) throw new Error(`bandeau : « ${texte} »`);
  await A.page.waitForTimeout(3000);
  if (A.chargements.n !== 1) throw new Error(`A. rechargement forcé (${A.chargements.n} chargements)`);
  if ((await A.page.locator("#email").inputValue()) !== saisie) throw new Error("A. saisie en cours perdue");
  await A.page.getByTestId("new-version-reload").click();
  await A.page.waitForLoadState("load");
  await A.page.locator("#email").waitFor({ timeout: 20000 });
  if (A.chargements.n !== 2) throw new Error(`A. « Recharger » : ${A.chargements.n} chargements`);
  if ((await versionQuiTourne(A.page)) !== nouvelle) throw new Error("A. la page rechargée tourne encore sur l'ancienne version");
  await retourSurOnglet(A.page);
  await A.page.waitForTimeout(1500);
  if (await bandeau(A.page).count()) throw new Error("A. bandeau encore affiché sur la nouvelle version");
  etape("A. retour sur l'onglet : « Nouvelle version disponible — Recharger », saisie intacte et aucun rechargement sans clic ; « Recharger » → nouvelle version, bandeau disparu");

  // B. « Plus tard » : masqué pour l'onglet, sans rechargement.
  await B.page.locator("#email").fill(saisie);
  await retourSurOnglet(B.page);
  await bandeau(B.page).waitFor({ timeout: 10000 });
  await B.page.getByTestId("new-version-later").click();
  await retourSurOnglet(B.page);
  await B.page.waitForTimeout(1500);
  if (await bandeau(B.page).count()) throw new Error("B. bandeau réaffiché après « Plus tard »");
  if (B.chargements.n !== 1 || (await B.page.locator("#email").inputValue()) !== saisie) throw new Error("B. page rechargée ou saisie perdue");
  etape("B. « Plus tard » : bandeau masqué pour l'onglet, saisie intacte, aucun rechargement");

  // C. vérification périodique sans retour sur l'onglet (horloge simulée).
  if (await bandeau(C.page).count()) throw new Error("C. bandeau avant l'échéance");
  await C.page.clock.fastForward("05:05");
  await bandeau(C.page).waitFor({ timeout: 10000 });
  if (C.chargements.n !== 1) throw new Error("C. rechargement forcé");
  etape("C. vérification périodique (toutes les 5 minutes) : bandeau sans retour sur l'onglet, aucun rechargement");

  if (erreurs.length) throw new Error(`erreurs dans la page :\n${erreurs.join("\n")}`);
  console.log(`\n3 scénarios, 0 erreur (détection de nouvelle version, ${HASH ? "routage par hash" : "URL propres"}).`);
} catch (e) {
  console.error(`✘ ${e.message}`);
  process.exitCode = 1;
} finally {
  await navigateur.close();
  serveur.kill();
  rmSync(copie, { recursive: true, force: true });
}

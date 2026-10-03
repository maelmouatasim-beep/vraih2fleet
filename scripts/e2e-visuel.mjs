#!/usr/bin/env node
/**
 * Régression visuelle (CI) : TOUTES les pages principales, avec la démo
 * « Ville de Rivière-Claire » (fictive), en 1440, 1024 et 390 px de large,
 * en français et en anglais, contre Supabase LOCAL.
 *
 * Pour chaque page et chaque largeur :
 *  - capture pleine page (artefact CI, planche planche.html) ;
 *  - ÉCHEC si la page déborde horizontalement ;
 *  - ÉCHEC si un texte est coupé sans moyen de le lire (débordement caché
 *    sans points de suspension, ou points de suspension sans infobulle) ;
 *  - ÉCHEC si une colonne de chiffres d'un tableau n'est pas alignée à droite ;
 *  - ÉCHEC si un mot (identifiant, montant) est coupé sur deux lignes ;
 *  - ÉCHEC si un bouton ou un champ dépasse de sa carte ;
 *  - ÉCHEC si une clé de traduction brute s'affiche (ex. « journey.steps… ») ;
 *  - ÉCHEC si une erreur JavaScript survient.
 *
 *   node scripts/e2e-visuel.mjs <dossier>      (E2E_BASE, défaut http://127.0.0.1:8080)
 *   VISUEL_PAGES=accueil,plan  → sous-ensemble ; VISUEL_LARGEURS=1440
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = (process.env.E2E_BASE ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const SORTIE = resolve(process.argv[2] ?? "e2e-visuel");
mkdirSync(SORTIE, { recursive: true });
const LARGEURS = (process.env.VISUEL_LARGEURS ?? "1440,1024,390").split(",").map(Number);
const LANGUES = (process.env.VISUEL_LANGUES ?? "fr,en").split(",");
const COURRIEL = `visuel-${Date.now()}@example.com`;
const MDP = "Visuel2026!";

/** Pages publiques (sans session) et pages de l'application (avec la démo). */
const PUBLIQUES = [
  ["accueil-public", "/"],
  ["fonctionnalites", "/features"],
  ["a-propos", "/about"],
  ["contact", "/contact"],
  ["methodologie", "/methodology"],
  ["exemples", "/case-studies"],
  ["guides", "/guides"],
  ["conditions", "/terms"],
  ["confidentialite", "/privacy"],
  ["connexion", "/login"],
  ["inscription", "/signup"],
];
const ETAPES = ["flotte", "faisabilite", "strategies", "plan", "financement", "rapports", "suivi"];
const APPLI = (projet) => [
  ["accueil", "/dashboard"],
  ["projets", "/dashboard/projects"],
  ...ETAPES.map((e) => [`etape-${e}`, `/dashboard/projects/${projet}/${e}`]),
  ["ma-flotte", "/dashboard/fleet"],
  ["bibliotheque", "/dashboard/library"],
  ["organisation", "/dashboard/organization"],
  ["aide", "/dashboard/help"],
  ["notifications", "/dashboard/notifications"],
  ["parametres", "/dashboard/settings"],
];
const FILTRE = process.env.VISUEL_PAGES ? new Set(process.env.VISUEL_PAGES.split(",")) : null;

/** Mesures dans la page : débordement, textes coupés, clés brutes. */
async function mesurer(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const debordement = doc.scrollWidth - doc.clientWidth;
    const lisible = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.getAttribute("title") || n.getAttribute("aria-label") || n.hasAttribute("data-state") || n.getAttribute("aria-describedby")) return true;
      }
      return false;
    };
    const coupes = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!el.childNodes.length || el.closest("svg, canvas, [data-visuel-ignorer], [role=dialog]")) continue;
      const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
      if (!texte) continue;
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || el.getClientRects().length === 0) continue;
      const cache = ["hidden", "clip"].includes(s.overflowX);
      if (!cache || el.scrollWidth <= el.clientWidth + 1) continue;
      const ellipse = s.textOverflow === "ellipsis";
      if (!ellipse || !lisible(el)) coupes.push(`${texte.slice(0, 60)}${ellipse ? " (… sans infobulle)" : " (coupé)"}`);
    }
    // Colonnes numériques (montants, nombres, unités) : alignées à droite.
    const NUM = /^[-−+]?\s?\$?[\d\s\u00a0\u202f.,]+\s?(\$|%|¢|km|kW|kWh|t|L|ans?|years?|yrs?|t\s?CO₂e?)?$/;
    const nonAlignees = [];
    for (const table of document.querySelectorAll("table")) {
      if (table.closest("[data-visuel-ignorer]") || table.getClientRects().length === 0) continue;
      const lignes = [...table.querySelectorAll("tbody tr")].filter((tr) => tr.children.length > 1);
      if (lignes.length < 2) continue;
      const nbCol = Math.max(...lignes.map((tr) => tr.children.length));
      for (let c = 0; c < nbCol; c++) {
        const cellules = lignes.map((tr) => tr.children[c]).filter(Boolean);
        const textes = cellules.map((td) => td.innerText.trim().split("\n")[0]).filter((x) => x && x !== "—");
        if (textes.length < 2 || !textes.every((x) => NUM.test(x)) || textes.every((x) => /^\d{4}$/.test(x))) continue;
        const gauche = cellules.filter((td) => !["right", "end"].includes(getComputedStyle(td).textAlign));
        if (gauche.length) {
          const entete = table.querySelectorAll("thead th")[c]?.innerText.trim() ?? `colonne ${c + 1}`;
          nonAlignees.push(`${entete} (${textes[0]})`);
        }
      }
    }
    // Mot coupé en deux lignes (« C-\n01 », « Électri-\nque ») : colonne trop étroite.
    const motsCoupes = [];
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const texte = n.textContent.trim();
      if (!texte || texte.length > 30 || /\s/.test(texte.replace(/[\u00a0\u202f]/g, "x")) === true) continue;
      const parent = n.parentElement;
      if (!parent || parent.closest("svg, [data-visuel-ignorer], [role=dialog], pre, code")) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      const hauts = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
      // Un mot composé de la prose peut passer à la ligne au trait d'union
      // (« Hydro-Québec ») ; un identifiant, une date ou un montant, jamais.
      if (hauts.size > 1 && (/\d/.test(texte) || !/[-‑–]/.test(texte))) motsCoupes.push(texte);
    }
    // Bouton ou champ qui dépasse de sa carte (en-tête « titre + bouton » écrasé).
    const horsCarte = [];
    for (const el of document.querySelectorAll("button, a, input, select")) {
      if (el.getClientRects().length === 0 || el.closest("[data-visuel-ignorer], [role=dialog], [aria-hidden=true]")) continue;
      const carte = el.closest(".bg-card");
      if (!carte) continue;
      let defile = false;
      for (let n = el.parentElement; n && n !== carte; n = n.parentElement) {
        if (["auto", "scroll"].includes(getComputedStyle(n).overflowX)) defile = true;
      }
      if (defile) continue;
      const a = el.getBoundingClientRect();
      const c = carte.getBoundingClientRect();
      if (a.right > c.right + 1 || a.left < c.left - 1) horsCarte.push((el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40));
    }
    const texteVisible = document.body.innerText;
    const cles = [...new Set(texteVisible.match(/\b(?:journey|pages|dashboard|notifications|common|landing|legal|copilot)\.[a-zA-Z_]+\.[a-zA-Z_.]+/g) ?? [])];
    return { debordement, coupes: [...new Set(coupes)].slice(0, 15), cles: cles.slice(0, 10), nonAlignees: [...new Set(nonAlignees)].slice(0, 10), motsCoupes: [...new Set(motsCoupes)].slice(0, 10), horsCarte: [...new Set(horsCarte)].slice(0, 10) };
  });
}

const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined) });
const resultats = [];
const echecs = [];

async function contexte(langue, etat) {
  const ctx = await navigateur.newContext({ locale: langue === "en" ? "en-CA" : "fr-CA", viewport: { width: 1440, height: 900 }, storageState: etat });
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem("i18nextLng", l);
      localStorage.setItem("h2fleet-profile-onboarding-skipped", "true");
    } catch {
      /* stockage indisponible */
    }
  }, langue);
  await ctx.route(/\.supabase\.(co|in)\/|mapbox|googleapis|gpteng/, (r) => r.abort());
  return ctx;
}

async function attendreStable(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  // Squelettes et indicateurs de chargement disparus (au plus 15 s).
  for (let i = 0; i < 30; i++) {
    const charge = await page.locator(".animate-pulse, .animate-spin").count();
    if (charge === 0) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
}

async function parcourir(ctx, langue, pages) {
  const page = await ctx.newPage();
  const erreursJs = [];
  page.on("pageerror", (e) => erreursJs.push(String(e.message ?? e)));
  for (const largeur of LARGEURS) {
    await page.setViewportSize({ width: largeur, height: largeur < 768 ? 844 : 900 });
    for (const [nom, chemin] of pages) {
      if (FILTRE && !FILTRE.has(nom)) continue;
      erreursJs.length = 0;
      await page.goto(`${BASE}${chemin}`);
      await attendreStable(page);
      // Une redirection tardive (ex. après la session) peut détruire le contexte : on remesure.
      const m = await mesurer(page).catch(async () => {
        await attendreStable(page);
        return mesurer(page);
      });
      const fichier = `${langue}-${largeur}-${nom}.png`;
      await page.screenshot({ path: join(SORTIE, fichier), fullPage: true });
      const pb = [];
      if (m.debordement > 1) pb.push(`débordement horizontal de ${m.debordement} px`);
      if (m.coupes.length) pb.push(`texte coupé : ${m.coupes.join(" | ")}`);
      if (m.nonAlignees.length) pb.push(`chiffres non alignés à droite : ${m.nonAlignees.join(" | ")}`);
      if (m.motsCoupes.length) pb.push(`mot coupé sur deux lignes : ${m.motsCoupes.join(" | ")}`);
      if (m.horsCarte.length) pb.push(`élément qui dépasse de sa carte : ${m.horsCarte.join(" | ")}`);
      if (m.cles.length) pb.push(`clé de traduction affichée : ${m.cles.join(", ")}`);
      if (erreursJs.length) pb.push(`erreur JavaScript : ${erreursJs[0]}`);
      resultats.push({ langue, largeur, nom, chemin, fichier, problemes: pb });
      if (pb.length) echecs.push(`${langue} ${largeur} ${nom} — ${pb.join(" ; ")}`);
      console.log(`${pb.length ? "✘" : "✔"} ${langue} ${String(largeur).padStart(4)} ${nom}${pb.length ? ` — ${pb.join(" ; ")}` : ""}`);
    }
  }
  await page.close();
}

try {
  // Compte de test + démo « Ville de Rivière-Claire »
  const ctxInscription = await contexte("fr");
  const p = await ctxInscription.newPage();
  await p.goto(`${BASE}/signup`);
  await p.fill("#fullName", "Responsable Flotte");
  await p.fill("#email", COURRIEL);
  await p.fill("#password", MDP);
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/dashboard/, { timeout: 30000 });
  await p.goto(`${BASE}/dashboard/projects`);
  await p.getByRole("button", { name: /démo/i }).first().click();
  await p.waitForURL(/projects\/[0-9a-f-]{36}/, { timeout: 120000 });
  const projet = p.url().match(/projects\/([0-9a-f-]{36})/)[1];
  // Passage par le Suivi : alertes du plan synchronisées (cloche non vide).
  await p.goto(`${BASE}/dashboard/projects/${projet}/suivi`);
  await attendreStable(p);
  const etat = await ctxInscription.storageState();
  await ctxInscription.close();
  console.log(`démo « Ville de Rivière-Claire » chargée (${projet})`);

  for (const langue of LANGUES) {
    const ctxPublic = await contexte(langue);
    await parcourir(ctxPublic, langue, PUBLIQUES);
    await ctxPublic.close();
    const ctxAppli = await contexte(langue, etat);
    await parcourir(ctxAppli, langue, APPLI(projet));
    await ctxAppli.close();
  }
} catch (e) {
  echecs.push(`exécution : ${String(e.message ?? e).split("\n")[0]}`);
} finally {
  await navigateur.close();
}

// Planche contact : une ligne par page, une colonne par langue × largeur.
const noms = [...new Set(resultats.map((r) => r.nom))];
const colonnes = LANGUES.flatMap((l) => LARGEURS.map((w) => [l, w]));
const cellule = (l, w, n) => {
  const r = resultats.find((x) => x.langue === l && x.largeur === w && x.nom === n);
  if (!r) return "<td></td>";
  return `<td class="${r.problemes.length ? "ko" : ""}"><a href="${r.fichier}"><img loading="lazy" src="${r.fichier}" alt="${n} ${l} ${w}"></a>${r.problemes.length ? `<p>${r.problemes.join("<br>")}</p>` : ""}</td>`;
};
writeFileSync(
  join(SORTIE, "planche.html"),
  `<!doctype html><meta charset="utf-8"><title>Régression visuelle H2Fleet</title><style>
body{font-family:system-ui,sans-serif;margin:16px}table{border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:6px;vertical-align:top}
img{width:220px;display:block}td.ko{background:#fef2f2}td p{color:#b91c1c;font-size:11px;max-width:220px}th{position:sticky;top:0;background:#fff}
</style><h1>Régression visuelle — ${resultats.length} captures, ${echecs.length} problème(s)</h1>
<table><tr><th>page</th>${colonnes.map(([l, w]) => `<th>${l} · ${w}px</th>`).join("")}</tr>
${noms.map((n) => `<tr><th>${n}</th>${colonnes.map(([l, w]) => cellule(l, w, n)).join("")}</tr>`).join("\n")}</table>`,
);
writeFileSync(join(SORTIE, "resultats.json"), JSON.stringify({ resultats, echecs }, null, 2));
console.log(`\n${resultats.length} captures, ${echecs.length} problème(s). Planche : ${join(SORTIE, "planche.html")}`);
if (echecs.length) {
  console.error(echecs.join("\n"));
  process.exitCode = 1;
}

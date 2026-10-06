#!/usr/bin/env node
/**
 * Parcours de CONFIRMATION DU COURRIEL, 4 scénarios + anti-énumération,
 * contre Supabase LOCAL (les liens et codes viennent de l'API
 * d'administration locale `generate_link` : aucun courriel réel).
 *
 *   1. même appareil : lien ouvert dans un autre onglet → « Adresse
 *      confirmée » puis l'espace, ET l'onglet d'attente entre tout seul ;
 *  1b. idem avec l'ordre des signaux entre onglets inversé (session vue
 *      dans le stockage avant le relais BroadcastChannel de supabase-js) :
 *      l'onglet d'attente entre sans passer par la connexion ;
 *   2. autre appareil avec le code à 6 chiffres (mauvais code refusé) ;
 *   3. autre appareil sans code : « Me connecter » (adresse préremplie) ;
 *   4. lien expiré / déjà utilisé → message clair + « Renvoyer un lien »
 *      (réponse neutre), aussi depuis les paramètres error / error_code ;
 *   5. inscription avec une adresse déjà inscrite → même écran d'attente ;
 *   6. retour plus tard : connexion sur un compte non confirmé → écran
 *      d'attente (code, renvoi, modifier l'adresse) ; mauvais mot de passe =
 *      même erreur qu'une adresse inconnue ;
 *   7. « Vous avez reçu un code de confirmation ? » (connexion, inscription)
 *      → adresse + code ; adresse inconnue = même message qu'un mauvais code.
 *
 *   E2E_BASE=http://127.0.0.1:8080 node scripts/e2e-confirmation.mjs            # URL propres (production)
 *   E2E_BASE=http://127.0.0.1:4173/vraih2fleet E2E_HASH=1 node scripts/e2e-confirmation.mjs   # routage par hash (GitHub Pages)
 * Requiert API_URL et SERVICE_ROLE_KEY (supabase status -o env).
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.E2E_BASE ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const HASH = process.env.E2E_HASH === "1";
const API = process.env.API_URL ?? "http://127.0.0.1:54321";
const SERVICE = process.env.SERVICE_ROLE_KEY;
if (!SERVICE || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(API)) throw new Error("Supabase LOCAL requis (exporter supabase status -o env)");

const route = (chemin) => (HASH ? `${BASE}/#${chemin}` : `${BASE}${chemin}`);
const redirection = HASH ? `${BASE}/` : `${BASE}/auth/confirme`;
const MDP = "Confirm2026!x";
const TEXTES = JSON.parse(readFileSync("src/i18n/locales/fr/translation.json", "utf8"));
const CHROMIUM_LOCAL = "/opt/pw-browsers/chromium";
const journal = [];
const etape = (m) => {
  journal.push(m);
  console.log(`✔ ${m}`);
};

async function lien(email) {
  const r = await fetch(`${API}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "signup", email, password: MDP, redirect_to: redirection }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`generate_link : ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  const p = j.properties ?? j;
  if (!p.action_link || !p.email_otp) throw new Error("generate_link : lien ou code absent");
  return { lien: p.action_link, code: p.email_otp };
}

// Diagnostic en cas d'échec : adresse, texte visible et capture de chaque onglet ouvert.
const DIAGNOSTIC = process.env.E2E_DIAGNOSTIC ?? "e2e-confirmation";
const contextes = [];
async function diagnostiquer() {
  mkdirSync(DIAGNOSTIC, { recursive: true });
  let n = 0;
  for (const ctx of contextes) {
    for (const p of ctx.pages()) {
      n++;
      const texte = (await p.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 400);
      console.error(`  onglet ${n} : ${p.url()}\n    « ${texte} »`);
      await p.screenshot({ path: join(DIAGNOSTIC, `${HASH ? "hash" : "propre"}-onglet-${n}.png`), fullPage: true }).catch(() => {});
    }
  }
}

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync(CHROMIUM_LOCAL) ? CHROMIUM_LOCAL : undefined) });
const erreurs = [];
async function contexte() {
  const ctx = await navigateur.newContext({ locale: "fr-CA", viewport: { width: 1280, height: 900 } });
  contextes.push(ctx);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("h2fleet-profile-onboarding-skipped", "true");
    } catch {
      /* stockage indisponible */
    }
  });
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => erreurs.push(String(e.message ?? e)));
    p.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) erreurs.push(`CSP : ${m.text().slice(0, 160)}`);
    });
  });
  return ctx;
}
// Navigation interne de l'application (pushState / hash) : pas d'événement
// « load » — on vérifie l'adresse à intervalle court.
async function attendreUrl(p, predicat, quoi, delai = 15000) {
  for (const fin = Date.now() + delai; Date.now() < fin; ) {
    if (predicat(new URL(p.url()))) return;
    await p.waitForTimeout(250);
  }
  throw new Error(`${quoi} : adresse attendue non atteinte (actuelle : ${new URL(p.url()).pathname}${new URL(p.url()).hash.slice(0, 40)})`);
}
const surEspace = (p, quoi = "espace") =>
  attendreUrl(p, (u) => (HASH ? u.hash.startsWith("#/dashboard") : u.pathname.startsWith("/dashboard")), quoi);
const unique = (n) => `confirm-${n}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;

try {
  // ── 1. Même appareil : lien dans un autre onglet ─────────────────────────
  const e1 = unique("meme");
  const l1 = await lien(e1);
  const ctxA = await contexte();
  const attente = await ctxA.newPage();
  await attente.goto(route(`/auth/verifier?email=${encodeURIComponent(e1)}`));
  await attente.getByTestId("signup-confirmation").waitFor({ timeout: 30000 });
  const renvoi = await attente.getByTestId("confirmation-resend").innerText();
  if (!/dans \d+ s/.test(renvoi) || !(await attente.getByTestId("confirmation-resend").isDisabled())) {
    throw new Error(`renvoi : délai de 60 s non affiché (« ${renvoi} »)`);
  }
  const onglet = await ctxA.newPage();
  await onglet.goto(l1.lien);
  await onglet.getByTestId("email-confirmed").waitFor({ timeout: 20000 });
  const titre = await onglet.getByTestId("email-confirmed").innerText();
  if (!/Adresse confirmée/.test(titre)) throw new Error(`arrivée : titre « ${titre} »`);
  await surEspace(onglet, "1. onglet du lien");
  await attente.bringToFront();
  await surEspace(attente, "1. onglet d'attente");
  etape("1. même appareil : « Adresse confirmée » puis l'espace ; l'onglet d'attente est entré tout seul (délai de renvoi de 60 s affiché)");

  // ── 1b. Même appareil, ordre des signaux entre onglets inversé ───────────
  // Cause de l'échec CI du 2026-10-05 (mode hash) : l'onglet d'attente voit
  // la session dans le stockage (événement « storage ») AVANT que supabase-js
  // ne relaie la connexion par BroadcastChannel au fournisseur d'auth ; s'il
  // navigue alors vers l'espace, la route protégée lit « pas d'utilisateur »
  // et renvoie à la connexion. On impose cet ordre (message BroadcastChannel
  // retardé de 4 s dans l'onglet d'attente) : il doit entrer SANS passer par
  // la page de connexion.
  const e1b = unique("ordre");
  const l1b = await lien(e1b);
  const ctxA2 = await contexte();
  const attente2 = await ctxA2.newPage();
  await attente2.addInitScript(() => {
    const Natif = window.BroadcastChannel;
    if (!Natif) return;
    const retarder = (f) => (e) => setTimeout(() => f(e), 4000);
    window.BroadcastChannel = class extends Natif {
      set onmessage(f) {
        super.onmessage = f ? retarder(f) : null;
      }
      get onmessage() {
        return super.onmessage;
      }
      addEventListener(type, f, o) {
        return super.addEventListener(type, type === "message" && typeof f === "function" ? retarder(f) : f, o);
      }
    };
  });
  const passages = [];
  attente2.on("framenavigated", (f) => {
    if (f === attente2.mainFrame()) passages.push(new URL(f.url()));
  });
  await attente2.goto(route(`/auth/verifier?email=${encodeURIComponent(e1b)}`));
  await attente2.getByTestId("signup-confirmation").waitFor({ timeout: 30000 });
  const onglet2 = await ctxA2.newPage();
  await onglet2.goto(l1b.lien);
  await onglet2.getByTestId("email-confirmed").waitFor({ timeout: 20000 });
  await attente2.bringToFront();
  await surEspace(attente2, "1b. onglet d'attente (signal entre onglets retardé)");
  const versConnexion = passages.find((u) => (HASH ? u.hash.startsWith("#/login") : u.pathname.startsWith("/login")));
  if (versConnexion) throw new Error(`1b. l'onglet d'attente est passé par la connexion (${versConnexion.pathname}${versConnexion.hash})`);
  etape("1b. même appareil, ordre des onglets inversé (stockage avant le relais BroadcastChannel) : l'onglet d'attente entre sans passer par la connexion");

  // ── 2. Autre appareil, avec le code ──────────────────────────────────────
  const e2 = unique("code");
  const l2 = await lien(e2);
  const ctxB = await contexte();
  const pc = await ctxB.newPage();
  await pc.goto(route(`/auth/verifier?email=${encodeURIComponent(e2)}`));
  await pc.getByTestId("otp-code").fill("000000");
  await pc.getByTestId("otp-submit").click();
  await pc.getByTestId("otp-error").waitFor({ timeout: 15000 });
  await pc.getByTestId("otp-code").fill(l2.code.replace(/(\d{3})(\d{3})/, "$1 $2"));
  await pc.getByTestId("otp-submit").click();
  await pc.getByTestId("email-confirmed").waitFor({ timeout: 20000 });
  await surEspace(pc);
  etape("2. autre appareil avec le code : mauvais code refusé (message clair), bon code → ce navigateur est connecté");

  // ── 3. Autre appareil, sans code ─────────────────────────────────────────
  const e3 = unique("sanscode");
  const l3 = await lien(e3);
  const ctxTel = await contexte();
  const tel = await ctxTel.newPage();
  await tel.goto(l3.lien); // clic sur le téléphone
  await tel.getByTestId("email-confirmed").waitFor({ timeout: 20000 });
  const ctxPc = await contexte();
  const pc3 = await ctxPc.newPage();
  await pc3.goto(route(`/auth/verifier?email=${encodeURIComponent(e3)}`));
  await pc3.getByTestId("confirmation-login").click();
  await attendreUrl(pc3, (u) => (HASH ? u.hash : u.pathname + u.search).includes("/login?email="), "3. connexion préremplie");
  const prerempli = await pc3.locator("#email").inputValue();
  if (prerempli !== e3) throw new Error(`connexion : adresse non préremplie (« ${prerempli} »)`);
  await pc3.locator("#password").fill(MDP);
  await pc3.locator("form button[type=submit]").click();
  await surEspace(pc3);
  etape("3. autre appareil sans code : « Me connecter » ouvre la connexion avec l'adresse préremplie, puis l'espace");

  // ── 4. Lien expiré / déjà utilisé ────────────────────────────────────────
  const ctxC = await contexte();
  const reutilise = await ctxC.newPage();
  await reutilise.goto(l3.lien); // déjà utilisé au scénario 3
  await reutilise.getByTestId("link-error").waitFor({ timeout: 20000 });
  const type = await reutilise.getByTestId("link-error").getAttribute("data-type");
  if (type !== "expire") throw new Error(`lien réutilisé : type « ${type} »`);
  const texte = await reutilise.locator("body").innerText();
  if (/otp_expired|access_denied|invalid or has expired/i.test(texte)) throw new Error("message technique brut affiché");
  await reutilise.getByTestId("resend-email").fill(e3);
  await reutilise.getByTestId("resend-link").click();
  await reutilise.getByText("Demande enregistrée").first().waitFor({ timeout: 15000 });
  const parametres = await ctxC.newPage();
  await parametres.goto(
    `${HASH ? `${BASE}/` : `${BASE}/auth/confirme`}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
  );
  await parametres.getByTestId("link-error").waitFor({ timeout: 20000 });
  etape("4. lien expiré ou déjà utilisé : « Ce lien a expiré » sans texte technique, « Renvoyer un lien » → réponse neutre ; paramètres error/error_code reconnus");

  // ── 5. Pas d'énumération ─────────────────────────────────────────────────
  const ctxD = await contexte();
  const ins = await ctxD.newPage();
  await ins.goto(route("/signup"));
  await ins.locator("#fullName").fill("Adresse existante");
  await ins.locator("#email").fill(e1); // déjà inscrite et confirmée
  await ins.locator("#password").fill(MDP);
  await ins.locator("form button[type=submit]").click();
  await ins.getByTestId("signup-confirmation").waitFor({ timeout: 20000 });
  if (await ins.getByText(/déjà utilisée|already/i).count()) throw new Error("énumération : l'adresse existante est signalée");
  etape("5. inscription avec une adresse déjà inscrite : même écran « Vérifiez vos courriels », rien ne révèle le compte");

  // ── 6. Retour plus tard : connexion sur un compte non confirmé ───────────
  // Plus d'erreur : l'écran d'attente (code, renvoi, modifier l'adresse)
  // avec l'adresse préremplie. Un MAUVAIS mot de passe, lui, donne la même
  // erreur qu'une adresse inconnue (pas d'énumération).
  const e6 = unique("retour");
  const l6 = await lien(e6);
  const ctxE = await contexte();
  const cnx = await ctxE.newPage();
  const essaiConnexion = async (adresse, mdp) => {
    await cnx.goto(route("/login"));
    await cnx.locator("#email").fill(adresse);
    await cnx.locator("#password").fill(mdp);
    await cnx.locator("form button[type=submit]").click();
  };
  const ERREUR_IDENTIFIANTS = TEXTES.auth.errors.codes.invalidCredentials;
  await essaiConnexion(unique("inconnue"), "Mauvais2026!x");
  await cnx.getByText(ERREUR_IDENTIFIANTS).first().waitFor({ timeout: 15000 });
  await essaiConnexion(e6, "Mauvais2026!x");
  await cnx.getByText(ERREUR_IDENTIFIANTS).first().waitFor({ timeout: 15000 });
  if (await cnx.getByTestId("login-unconfirmed").count()) throw new Error("6. mauvais mot de passe : l'écran d'attente révèle le compte");
  await essaiConnexion(e6, MDP);
  await cnx.getByTestId("login-unconfirmed").waitFor({ timeout: 15000 });
  if (!(await cnx.getByTestId("confirmation-email").innerText()).includes(e6)) throw new Error("6. adresse absente de l'écran d'attente");
  if (await cnx.getByTestId("confirmation-resend").isDisabled()) throw new Error("6. « Renvoyer » devrait être disponible tout de suite");
  await cnx.getByTestId("confirmation-change-email").click();
  if ((await cnx.locator("#email").inputValue()) !== e6) throw new Error("6. « Modifier l'adresse » : formulaire sans l'adresse");
  await cnx.locator("#password").fill(MDP);
  await cnx.locator("form button[type=submit]").click();
  await cnx.getByTestId("login-unconfirmed").waitFor({ timeout: 15000 });
  await cnx.getByTestId("otp-code").fill("000000");
  await cnx.getByTestId("otp-submit").click();
  await cnx.getByTestId("otp-error").waitFor({ timeout: 15000 });
  await cnx.getByTestId("otp-code").fill(l6.code);
  await cnx.getByTestId("otp-submit").click();
  await cnx.getByTestId("email-confirmed").waitFor({ timeout: 20000 });
  await surEspace(cnx, "6. après le code saisi à la connexion");
  etape("6. connexion sur un compte non confirmé : écran d'attente (adresse préremplie, renvoi disponible, modifier l'adresse), code → espace ; mauvais mot de passe = même erreur qu'une adresse inconnue");

  // ── 7. « Vous avez reçu un code de confirmation ? » ──────────────────────
  const e7 = unique("lien-code");
  const l7 = await lien(e7);
  const ctxF = await contexte();
  const pc7 = await ctxF.newPage();
  await pc7.goto(route("/signup"));
  await pc7.getByTestId("link-have-code").click();
  await pc7.getByTestId("code-confirmation").waitFor({ timeout: 15000 });
  if ((await pc7.getByTestId("code-email").inputValue()) !== "") throw new Error("7. depuis l'inscription : adresse inattendue");
  await pc7.goto(route("/login"));
  await pc7.locator("#email").fill(e7);
  await pc7.getByTestId("link-have-code").click();
  await pc7.getByTestId("code-confirmation").waitFor({ timeout: 15000 });
  if ((await pc7.getByTestId("code-email").inputValue()) !== e7) throw new Error("7. depuis la connexion : adresse non reprise");
  const messageCode = async (adresse, code) => {
    await pc7.getByTestId("code-email").fill(adresse);
    await pc7.getByTestId("code-value").fill(code);
    await pc7.getByTestId("code-submit").click();
    await pc7.getByTestId("code-error").waitFor({ timeout: 15000 });
    const m = await pc7.getByTestId("code-error").innerText();
    await pc7.getByTestId("code-value").fill("");
    return m;
  };
  const inconnue = await messageCode(unique("jamais-inscrite"), "123456");
  const mauvais = await messageCode(e7, "000000");
  if (inconnue !== mauvais) throw new Error(`7. énumération : « ${inconnue} » ≠ « ${mauvais} »`);
  await pc7.getByTestId("code-email").fill(e7);
  await pc7.getByTestId("code-value").fill(l7.code);
  await pc7.getByTestId("code-submit").click();
  await pc7.getByTestId("email-confirmed").waitFor({ timeout: 20000 });
  await surEspace(pc7, "7. après le code saisi sur la page dédiée");
  etape("7. « Vous avez reçu un code de confirmation ? » (connexion et inscription) : adresse + code → espace ; adresse inconnue et mauvais code = même message");

  if (erreurs.length) throw new Error(`erreurs dans la page :\n${erreurs.join("\n")}`);
  console.log(`\n${journal.length} scénarios, 0 erreur (${HASH ? "routage par hash" : "URL propres"}).`);
} catch (e) {
  console.error(`✘ ${e.message}`);
  if (erreurs.length) console.error(`erreurs dans la page :\n${erreurs.join("\n")}`);
  await diagnostiquer();
  process.exitCode = 1;
} finally {
  await navigateur.close();
}

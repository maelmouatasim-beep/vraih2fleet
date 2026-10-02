#!/usr/bin/env node
/**
 * Phase 5, point 5 — VEILLE DES SUBVENTIONS (tâche hebdomadaire).
 *
 * Pour chaque programme du registre (src/lib/tco/subsidy-programs.ts) :
 * relit la page officielle (et le PDF de modalités qu'elle référence, le
 * cas échéant), ARCHIVE le texte lu (data/veille/<date>/<source>.txt),
 * extrait les faits surveillés (montants, dates, statuts —
 * src/lib/veille/detection.ts) et les compare à la lecture précédente
 * (data/veille/etat.json). Chaque changement est déposé dans la FILE DE
 * VALIDATION (table subsidy_watch_changes) : un administrateur H2Fleet le
 * valide ou le rejette — JAMAIS d'application automatique.
 *
 *   node --experimental-strip-types scripts/veille/veille-subventions.mjs
 *     [--date AAAA-MM-JJ]        date de la lecture (défaut : aujourd'hui, UTC)
 *     [--entrees <dossier>]      lit <source>.html|.txt|.pdf au lieu du réseau (tests)
 *     [--sql-local]              dépôt dans la base LOCALE (psql, SUPABASE_DB_URL)
 *
 * Dépôt hébergé : SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (secrets
 * GitHub, API de gestion) ; absents → détections seulement archivées.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { PROGRAMMES } from "../../src/lib/tco/subsidy-programs.ts";
import { comparerLectures, empreinte, faitsSurveilles, texteDepuisHtml } from "../../src/lib/veille/detection.ts";

const args = process.argv.slice(2);
const opt = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const JOUR = opt("--date") ?? new Date().toISOString().slice(0, 10);
const ENTREES = opt("--entrees");
const SQL_LOCAL = args.includes("--sql-local");
const RACINE = "data/veille";
const DOSSIER = join(RACINE, JOUR);
const ETAT = join(RACINE, "etat.json");
mkdirSync(DOSSIER, { recursive: true });

const etat = existsSync(ETAT) ? JSON.parse(readFileSync(ETAT, "utf8")) : { sources: {} };

async function lire(cle, url) {
  if (ENTREES) {
    for (const ext of ["txt", "html", "pdf"]) {
      const f = join(ENTREES, `${cle.replace(/[:/]/g, "_")}.${ext}`);
      if (!existsSync(f)) continue;
      if (ext === "pdf") return { type: "pdf", texte: execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" }) };
      const brut = readFileSync(f, "utf8");
      return { type: ext, texte: ext === "html" ? texteDepuisHtml(brut) : brut, html: ext === "html" ? brut : null };
    }
    return null;
  }
  const r = await fetch(url, { headers: { "User-Agent": "H2Fleet-veille/1.0 (+https://maelmouatasim-beep.github.io/vraih2fleet/)" }, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = r.headers.get("content-type") ?? "";
  if (type.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const tmp = join(DOSSIER, `${cle.replace(/[:/]/g, "_")}.pdf`);
    writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
    const texte = execFileSync("pdftotext", ["-layout", tmp, "-"], { encoding: "utf8" });
    return { type: "pdf", texte };
  }
  const html = await r.text();
  return { type: "html", texte: texteDepuisHtml(html), html };
}

/** Lien du PDF de modalités référencé par une page (Écocamionnage). */
function lienModalites(html, base) {
  const m = html?.match(/href="([^"]*[Mm]odalit[^"]*\.pdf[^"]*)"/);
  if (!m) return null;
  return m[1].startsWith("http") ? m[1] : new URL(m[1], base).toString();
}

const detections = [];
const lectures = [];
const echecs = [];

async function traiter(programmeId, cle, url) {
  let lu;
  try {
    lu = await lire(cle, url);
  } catch (e) {
    echecs.push({ cle, url, erreur: String(e.message ?? e) });
    return null;
  }
  if (!lu || !lu.texte.trim()) {
    echecs.push({ cle, url, erreur: "texte vide" });
    return null;
  }
  const fichier = join(DOSSIER, `${cle.replace(/[:/]/g, "_")}.txt`);
  writeFileSync(fichier, lu.texte);
  const faits = faitsSurveilles(lu.texte);
  const precedent = etat.sources[cle];
  const nouvelles = comparerLectures(programmeId, url, precedent?.faits ?? null, faits).map((d) => ({ ...d, archive: fichier }));
  detections.push(...nouvelles);
  etat.sources[cle] = { programmeId, url, date: JOUR, empreinte: empreinte(lu.texte), faits };
  lectures.push({ cle, url, faits: faits.length, detections: nouvelles.length, initial: !precedent });
  return lu;
}

for (const p of PROGRAMMES) {
  const lu = await traiter(p.id, p.id, p.source.url);
  const pdf = lu ? lienModalites(lu.html, p.source.url) : null;
  if (pdf) await traiter(p.id, `${p.id}:modalites`, pdf);
}

writeFileSync(ETAT, JSON.stringify(etat, null, 2) + "\n");
writeFileSync(join(DOSSIER, "detections.json"), JSON.stringify({ date: JOUR, lectures, echecs, detections }, null, 2) + "\n");

// ── Dépôt dans la file de validation ────────────────────────────────────
function requeteDepot(liste) {
  const lignes = liste.map((d) => ({
    program_id: d.programmeId,
    source_url: d.url,
    change_kind: d.type,
    facts_added: d.ajoutes,
    facts_removed: d.retires,
    excerpt_before: d.extraitAvant.slice(0, 4000),
    excerpt_after: d.extraitApres.slice(0, 4000),
    archive_path: d.archive,
    dedupe_key: d.cleDedoublonnage,
  }));
  const json = JSON.stringify(lignes);
  // Contenu externe (pages web) : chaîne « dollar-quoted » à étiquette
  // aléatoire absente du contenu — aucune injection SQL possible.
  let tag;
  do tag = `veille_${randomBytes(8).toString("hex")}`;
  while (json.includes(tag));
  return `insert into public.subsidy_watch_changes
  (program_id, source_url, change_kind, facts_added, facts_removed, excerpt_before, excerpt_after, archive_path, dedupe_key)
select x.program_id, x.source_url, x.change_kind, x.facts_added, x.facts_removed, x.excerpt_before, x.excerpt_after, x.archive_path, x.dedupe_key
from jsonb_to_recordset($${tag}$${json}$${tag}$::jsonb) as x(program_id text, source_url text, change_kind text,
  facts_added jsonb, facts_removed jsonb, excerpt_before text, excerpt_after text, archive_path text, dedupe_key text)
on conflict (dedupe_key) do nothing
returning id;`;
}

let deposees = 0;
if (detections.length > 0) {
  const sql = requeteDepot(detections);
  if (SQL_LOCAL) {
    const url = process.env.SUPABASE_DB_URL ?? process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    const sortie = execFileSync("psql", [url, "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" });
    deposees = sortie.split("\n").filter((l) => /^[0-9a-f-]{36}$/.test(l.trim())).length;
  } else if (process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF) {
    const { sqlHeberge } = await import("../lib/gestion-supabase.mjs");
    deposees = (await sqlHeberge(sql)).length;
  } else {
    console.log("::warning::Secrets Supabase absents : détections archivées dans le dépôt seulement (data/veille).");
  }
}

console.log(`Veille du ${JOUR} : ${lectures.length} source(s) lue(s), ${echecs.length} échec(s), ${detections.length} changement(s) détecté(s), ${deposees} déposé(s) dans la file de validation.`);
for (const l of lectures) console.log(`  ${l.initial ? "état initial" : "comparée"} — ${l.cle} : ${l.faits} faits, ${l.detections} changement(s)`);
for (const e of echecs) console.log(`  ÉCHEC — ${e.cle} (${e.url}) : ${e.erreur}`);

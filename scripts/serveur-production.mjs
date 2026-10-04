#!/usr/bin/env node
/**
 * Serveur LOCAL qui imite Cloudflare Pages pour tester le VRAI bundle de
 * production (BrowserRouter) avant la bascule :
 * - fichiers statiques de dist/ ;
 * - en-têtes de dist/_headers (CSP, HSTS…) appliqués comme Pages : bloc
 *   « /* » partout, blocs « /prefixe/* » en plus ;
 * - redirections exactes de dist/_redirects (301) ;
 * - route inconnue sans fichier → index.html en 200 (mode SPA de Pages
 *   quand aucun 404.html n'existe à la racine).
 *
 *   npm run build && node scripts/serveur-production.mjs [port] [dossier]
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.argv[2] ?? 8080);
const racine = resolve(process.argv[3] ?? "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".wasm": "application/wasm",
};

/** Lit un fichier _headers : [{ motif, entetes }]. */
export function lireEnTetes(texte) {
  const blocs = [];
  for (const ligne of texte.split("\n")) {
    if (!ligne.trim() || ligne.trim().startsWith("#")) continue;
    if (!/^\s/.test(ligne)) blocs.push({ motif: ligne.trim(), entetes: {} });
    else if (blocs.length) {
      const i = ligne.indexOf(":");
      blocs.at(-1).entetes[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
    }
  }
  return blocs;
}

/** Lit un fichier _redirects : Map(de → { vers, code }). */
export function lireRedirections(texte) {
  const m = new Map();
  for (const ligne of texte.split("\n")) {
    const t = ligne.trim();
    if (!t || t.startsWith("#")) continue;
    const [de, vers, code = "302"] = t.split(/\s+/);
    m.set(de, { vers, code: Number(code) });
  }
  return m;
}

export function correspond(motif, chemin) {
  if (motif.endsWith("/*")) return chemin.startsWith(motif.slice(0, -1)) || chemin === motif.slice(0, -2);
  return motif === chemin;
}

const lire = (f) => (existsSync(join(racine, f)) ? readFileSync(join(racine, f), "utf8") : "");

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const blocs = lireEnTetes(lire("_headers"));
  const redirections = lireRedirections(lire("_redirects"));
  createServer((req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, "http://x").pathname);
    for (const b of blocs) if (correspond(b.motif, chemin)) for (const [k, v] of Object.entries(b.entetes)) res.setHeader(k, v);
    const r = redirections.get(chemin);
    if (r) {
      res.writeHead(r.code, { Location: r.vers });
      return res.end();
    }
    let fichier = normalize(join(racine, chemin));
    if (!fichier.startsWith(racine)) return res.writeHead(400).end();
    if (existsSync(fichier) && statSync(fichier).isDirectory()) fichier = join(fichier, "index.html");
    if (!existsSync(fichier) || chemin.startsWith("/_")) fichier = join(racine, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[extname(fichier)] ?? "application/octet-stream" });
    res.end(readFileSync(fichier));
  }).listen(port, "127.0.0.1", () => console.log(`Production locale : http://127.0.0.1:${port} (${racine})`));
}

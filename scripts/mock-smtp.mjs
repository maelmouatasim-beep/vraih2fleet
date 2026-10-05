#!/usr/bin/env node
/**
 * FAUX serveur SMTP pour les tests LOCAUX : TLS implicite (comme le port
 * 465 d'IONOS) avec certificat auto-signé généré au démarrage, AUTH PLAIN /
 * LOGIN vérifiée, messages conservés en mémoire et lisibles en HTTP.
 * Aucun courriel ne quitte la machine.
 *
 *   MOCK_SMTP_ENV_OUT=fichier.env node scripts/mock-smtp.mjs [port=2465]
 *   (MOCK_SMTP_USER / MOCK_SMTP_PASS : identifiants attendus, valeurs de test par défaut)
 *   GET  http://127.0.0.1:<port+1>/messages   → [{ from, to, auth, subject, data }]
 *   DELETE http://127.0.0.1:<port+1>/messages → vide la liste
 *   POST http://127.0.0.1:<port+1>/refuser-auth?actif=1|0 → simule un mot de passe refusé
 * La fonction Edge l'atteint via SMTP_HOST=host.docker.internal ; la ligne
 * SMTP_TLS_CA_TESTS_ONLY=… écrite dans MOCK_SMTP_ENV_OUT (AC de test) est
 * ajoutée à son fichier d'environnement.
 */
import tls from "node:tls";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.argv[2] ?? 2465);
const USER = process.env.MOCK_SMTP_USER ?? "noreply@h2fleet.test";
const PASS = process.env.MOCK_SMTP_PASS ?? "mot-de-passe-de-test";
const dossier = mkdtempSync(join(tmpdir(), "mock-smtp-"));
const f = (n) => join(dossier, n);
const ssl = (...args) => execFileSync("openssl", args, { stdio: "ignore" });
// Petite autorité de TEST + certificat du serveur signé par elle (le runtime
// Edge vérifie toujours la chaîne : la fonction ne fait confiance qu'à cette
// AC, transmise par SMTP_TLS_CA_TESTS_ONLY — jamais en production).
ssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=AC de test mock-smtp", "-keyout", f("ac.key"), "-out", f("ac.pem"));
ssl("req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=host.docker.internal", "-keyout", f("cle.pem"), "-out", f("srv.csr"));
writeFileSync(f("ext.cnf"), "basicConstraints=critical,CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:host.docker.internal,DNS:localhost,IP:127.0.0.1\n");
ssl("x509", "-req", "-in", f("srv.csr"), "-CA", f("ac.pem"), "-CAkey", f("ac.key"), "-CAcreateserial", "-days", "2", "-extfile", f("ext.cnf"), "-out", f("cert.pem"));
const sortieEnv = process.env.MOCK_SMTP_ENV_OUT;
if (sortieEnv) writeFileSync(sortieEnv, `SMTP_TLS_CA_TESTS_ONLY=${readFileSync(f("ac.pem")).toString("base64")}\n`);

const messages = [];
let refuserAuth = false; // POST /refuser-auth?actif=1 : simule un mot de passe refusé
const decoder = (b64) => Buffer.from(b64, "base64").toString("utf8");

function sujet(data) {
  const m = /^Subject:\s*(.+(?:\r\n[ \t].+)*)/im.exec(data);
  if (!m) return "";
  // RFC 2047 : l'espace entre deux mots encodés adjacents est ignoré.
  return m[1].replace(/\r\n[ \t]/g, " ").replace(/\?=\s+=\?/g, "?==?").replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, enc, txt) =>
    enc.toLowerCase() === "b" ? decoder(txt) : decodeURIComponent(txt.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, "%$1")),
  );
}

tls.createServer({ key: readFileSync(f("cle.pem")), cert: readFileSync(f("cert.pem")) }, (s) => {
  let etat = "commande";
  let tampon = "";
  let courant = { from: null, to: [], auth: null, data: "" };
  let loginUser = null;
  const ecrire = (l) => s.write(`${l}\r\n`);
  ecrire("220 mock-smtp ESMTP");
  // Données d'un message : peuvent arriver dans le même paquet que DATA.
  const lireDonnees = () => {
    const fin = tampon.indexOf("\r\n.\r\n");
    if (fin === -1) return false;
    courant.data = tampon.slice(0, fin);
    tampon = tampon.slice(fin + 5);
    messages.push({ ...courant, subject: sujet(courant.data) });
    courant = { from: null, to: [], auth: courant.auth, data: "" };
    etat = "commande";
    ecrire("250 OK queued");
    return true;
  };
  s.on("data", (chunk) => {
    tampon += chunk.toString("utf8");
    if (etat === "data" && !lireDonnees()) return;
    let i;
    while (etat !== "data" && (i = tampon.indexOf("\r\n")) !== -1) {
      const ligne = tampon.slice(0, i);
      tampon = tampon.slice(i + 2);
      if (etat === "login_user") { loginUser = decoder(ligne); etat = "login_pass"; ecrire("334 UGFzc3dvcmQ6"); continue; }
      if (etat === "login_pass") {
        const ok = !refuserAuth && loginUser === USER && decoder(ligne) === PASS;
        etat = "commande";
        if (ok) courant.auth = loginUser;
        ecrire(ok ? "235 Authentication successful" : "535 Authentication failed");
        continue;
      }
      const [cmd, ...rest] = ligne.split(" ");
      const arg = rest.join(" ");
      switch (cmd.toUpperCase()) {
        case "EHLO": case "HELO": ecrire("250-mock-smtp"); ecrire("250-AUTH PLAIN LOGIN"); ecrire("250 8BITMIME"); break;
        case "AUTH": {
          const [mecanisme, donnee] = arg.split(" ");
          if (mecanisme.toUpperCase() === "PLAIN") {
            const [, u, p] = decoder(donnee ?? "").split("\0");
            const ok = !refuserAuth && u === USER && p === PASS;
            if (ok) courant.auth = u;
            ecrire(ok ? "235 Authentication successful" : "535 Authentication failed");
          } else if (mecanisme.toUpperCase() === "LOGIN") {
            if (donnee) { loginUser = decoder(donnee); etat = "login_pass"; ecrire("334 UGFzc3dvcmQ6"); }
            else { etat = "login_user"; ecrire("334 VXNlcm5hbWU6"); }
          } else ecrire("504 Unrecognized authentication type");
          break;
        }
        case "MAIL":
          if (!courant.auth) { ecrire("530 Authentication required"); break; }
          courant.from = arg.replace(/^FROM:\s*/i, "").replace(/[<>]/g, "").split(" ")[0]; ecrire("250 OK"); break;
        case "RCPT": courant.to.push(arg.replace(/^TO:\s*/i, "").replace(/[<>]/g, "")); ecrire("250 OK"); break;
        case "DATA": etat = "data"; ecrire("354 End data with <CR><LF>.<CR><LF>"); if (!lireDonnees()) return; break;
        case "RSET": courant = { from: null, to: [], auth: courant.auth, data: "" }; ecrire("250 OK"); break;
        case "NOOP": ecrire("250 OK"); break;
        case "QUIT": ecrire("221 Bye"); s.end(); break;
        default: ecrire("502 Command not implemented");
      }
    }
  });
  s.on("error", () => {});
}).listen(port, "0.0.0.0", () => console.log(`Faux SMTP (TLS) : port ${port} ; messages : http://127.0.0.1:${port + 1}/messages`));

http.createServer((req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/refuser-auth")) {
    refuserAuth = req.url.endsWith("actif=1");
    return res.writeHead(204).end();
  }
  if (req.url !== "/messages") return res.writeHead(404).end();
  if (req.method === "DELETE") messages.length = 0;
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(messages));
}).listen(port + 1, "127.0.0.1");

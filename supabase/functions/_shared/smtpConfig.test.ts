// Configuration SMTP (IONOS) : valeurs par défaut, ports bloqués par les
// fonctions Edge, interrupteur unique SMTP_PASSWORD.
import { assertEquals } from "jsr:@std/assert@1";
import { classerErreurSmtp, lireConfigSmtp, smtpActif } from "./smtpConfig.ts";


const env = (valeurs: Record<string, string>) => (n: string) => valeurs[n];

Deno.test("smtp : sans SMTP_PASSWORD → non configuré, rien n'est envoyé", () => {
  assertEquals(lireConfigSmtp(env({ SMTP_HOST: "smtp.ionos.com" })), { ok: false, raison: "non_configure" });
  assertEquals(smtpActif(env({})), false);
});

Deno.test("smtp : valeurs par défaut IONOS (465 TLS, identifiant = expéditeur)", () => {
  const etat = lireConfigSmtp(env({ SMTP_PASSWORD: "x" }));
  if (!etat.ok) throw new Error("devrait être configuré");
  assertEquals(etat.config.host, "smtp.ionos.com");
  assertEquals(etat.config.port, 465);
  assertEquals(etat.config.secure, true);
  assertEquals(etat.config.from, "noreply@h2fleet.ca");
  assertEquals(etat.config.user, "noreply@h2fleet.ca");
  assertEquals(etat.config.fromName, "H2Fleet");
  assertEquals(etat.config.caTests, null);
});

Deno.test("smtp : ports 25 et 587 refusés (bloqués par Supabase), port invalide refusé", () => {
  for (const p of ["25", "587", "abc"]) {
    assertEquals(lireConfigSmtp(env({ SMTP_PASSWORD: "x", SMTP_PORT: p })), { ok: false, raison: "port_bloque" });
  }
});

Deno.test("smtp : identifiant et expéditeur personnalisés", () => {
  const etat = lireConfigSmtp(env({ SMTP_PASSWORD: "x", EMAIL_FROM: "alertes@exemple.ca", SMTP_USER: "boite@exemple.ca", EMAIL_FROM_NAME: "Flotte" }));
  if (!etat.ok) throw new Error("devrait être configuré");
  assertEquals([etat.config.from, etat.config.user, etat.config.fromName], ["alertes@exemple.ca", "boite@exemple.ca", "Flotte"]);
});

Deno.test("smtp : erreurs classées sans exposer le texte du serveur", () => {
  assertEquals(classerErreurSmtp({ code: "EAUTH", responseCode: 535 }), "smtp_auth");
  assertEquals(classerErreurSmtp({ code: "ETIMEDOUT" }), "smtp_connexion");
  assertEquals(classerErreurSmtp({ code: "ESOCKET" }), "smtp_connexion");
  assertEquals(classerErreurSmtp({ code: "EENVELOPE", responseCode: 550 }), "smtp_refus");
  assertEquals(classerErreurSmtp(new Error("?")), "smtp_refus");
});

Deno.test("smtp : AC de test lue seulement si c'est un certificat PEM en base64", () => {
  const pem = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";
  const ok = lireConfigSmtp(env({ SMTP_PASSWORD: "x", SMTP_TLS_CA_TESTS_ONLY: btoa(pem) }));
  const ko = lireConfigSmtp(env({ SMTP_PASSWORD: "x", SMTP_TLS_CA_TESTS_ONLY: "pas du base64 !" }));
  if (!ok.ok || !ko.ok) throw new Error("devrait être configuré");
  assertEquals(ok.config.caTests, pem);
  assertEquals(ko.config.caTests, null);
});

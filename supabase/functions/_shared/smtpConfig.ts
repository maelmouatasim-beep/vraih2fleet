// Configuration de l'envoi de courriels applicatifs par SMTP (IONOS) —
// module PUR (lecture de l'environnement seulement), testé.
//
// Seul interrupteur : le secret SMTP_PASSWORD (mot de passe de la boîte
// d'envoi, saisi par le propriétaire dans Supabase → Edge Functions →
// Secrets). Sans lui : « service non configuré » (503), rien n'est envoyé.
// Les fonctions Edge de Supabase bloquent les ports sortants 25 et 587 :
// seul le port 465 (TLS implicite) est utilisable.

export const PORTS_BLOQUES = [25, 587];

export interface ConfigSmtp {
  host: string;
  port: number;
  /** TLS dès la connexion (port 465). */
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  /**
   * TESTS LOCAUX UNIQUEMENT : AC (PEM) du faux serveur scripts/mock-smtp.mjs,
   * seule autorité alors acceptée. Absente en production (contrôle de santé).
   */
  caTests: string | null;
}

export type EtatSmtp = { ok: true; config: ConfigSmtp } | { ok: false; raison: "non_configure" | "port_bloque" };

export function lireConfigSmtp(lire: (nom: string) => string | undefined = (n) => Deno.env.get(n)): EtatSmtp {
  const password = lire("SMTP_PASSWORD");
  if (!password) return { ok: false, raison: "non_configure" };
  const port = Number(lire("SMTP_PORT") ?? "465");
  if (!Number.isInteger(port) || PORTS_BLOQUES.includes(port)) return { ok: false, raison: "port_bloque" };
  const from = lire("EMAIL_FROM") ?? "noreply@h2fleet.ca";
  return {
    ok: true,
    config: {
      host: lire("SMTP_HOST") ?? "smtp.ionos.com",
      port,
      secure: port === 465 || lire("SMTP_SECURE") === "true",
      // IONOS : l'identifiant est l'adresse complète de la boîte.
      user: lire("SMTP_USER") ?? from,
      password,
      from,
      fromName: lire("EMAIL_FROM_NAME") ?? "H2Fleet",
      caTests: decoderAc(lire("SMTP_TLS_CA_TESTS_ONLY")),
    },
  };
}

function decoderAc(b64: string | undefined): string | null {
  if (!b64) return null;
  try {
    const pem = atob(b64.trim());
    return pem.includes("BEGIN CERTIFICATE") ? pem : null;
  } catch {
    return null;
  }
}

/** L'envoi est-il branché ? (sans lire le mot de passe au-delà de sa présence) */
export function smtpActif(lire?: (nom: string) => string | undefined): boolean {
  return lireConfigSmtp(lire).ok;
}

export type ErreurSmtp = "smtp_auth" | "smtp_connexion" | "smtp_refus";

/** Classe une erreur nodemailer sans jamais exposer le texte du serveur. */
export function classerErreurSmtp(e: unknown): ErreurSmtp {
  const err = e as { code?: string; responseCode?: number; command?: string };
  if (err?.code === "EAUTH" || err?.responseCode === 535 || err?.command === "AUTH PLAIN" || err?.command === "AUTH LOGIN") return "smtp_auth";
  if (err?.code && ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ETLS"].includes(err.code)) return "smtp_connexion";
  return "smtp_refus";
}

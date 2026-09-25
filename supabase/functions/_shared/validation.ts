// Validation d'entrée partagée (zod) + utilitaires anti-injection.

import { z } from "npm:zod@3.23.8";

export { z };

/** Échappe une chaîne pour insertion sûre dans du HTML d'email. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * N'accepte qu'une URL https vers un hôte public (anti-SSRF et anti
 * javascript: dans les liens d'emails/webhooks). Retourne l'URL normalisée
 * ou null si refusée.
 */
export function safeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (isPrivateHostname(url.hostname)) return null;
  return url.toString();
}

/**
 * true pour localhost, les IP privées/réservées (IPv4 et IPv6) et les hôtes
 * sans point (noms internes type "kong", "metadata").
 */
export function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) {
    return true;
  }
  if (!h.includes(".") && !h.includes(":")) return true; // nom interne nu

  // IPv6 (URL.hostname la donne entre crochets)
  const bare = h.replace(/^\[|\]$/g, "");
  if (bare.includes(":")) {
    if (bare === "::" || bare === "::1") return true;
    if (/^(fe80|fc|fd)/.test(bare)) return true; // link-local / ULA
    if (bare.startsWith("::ffff:")) return isPrivateHostname(bare.slice(7));
    return false;
  }

  // IPv4 littérale
  const m = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / métadonnées cloud
    if (a >= 224) return true; // multicast / réservé
    return false;
  }

  return false;
}

/** Lit et valide le corps JSON ; HTTP 400 propre en cas d'échec. */
export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
  maxBytes = 64 * 1024,
): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new ValidationError("Request body too large");
  }
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ValidationError(
      `${first.path.join(".") || "body"}: ${first.message}`,
    );
  }
  return parsed.data;
}

export class ValidationError extends Error {}

/** IP de l'appelant (premier hop de x-forwarded-for, posé par la plateforme). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || "unknown";
}

import "server-only";
import { headers } from "next/headers";

/** IP du client (premier saut de X-Forwarded-For posé par l'hébergeur). */
export async function requestContext() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded ?? h.get("x-real-ip") ?? null;
  return {
    ip: ip && /^[0-9a-f.:]+$/i.test(ip) ? ip : null,
    userAgent: h.get("user-agent"),
    nonce: h.get("x-nonce") ?? undefined,
  };
}

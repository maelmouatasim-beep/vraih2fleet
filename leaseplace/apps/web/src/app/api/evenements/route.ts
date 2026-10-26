import { CLIENT_ANALYTICS_EVENTS } from "@leaseplace/domain";
import { track } from "@/lib/analytics";
import { env } from "@/lib/env";
import { requestContext } from "@/lib/request";
import { z } from "@/lib/zod";

const bodySchema = z.object({
  event: z.enum(CLIENT_ANALYTICS_EVENTS as unknown as [string, ...string[]]),
  id: z.string().regex(/^[0-9a-f]{32}$/),
  properties: z.record(z.string(), z.union([z.string().max(40), z.number()])),
});

// Limitation de débit par adresse (mémoire du processus) : 120 événements / minute.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const buckets = new Map<string, { start: number; count: number }>();

function allowed(ip: string, now: number): boolean {
  const b = buckets.get(ip);
  if (!b || now - b.start > WINDOW_MS) {
    if (buckets.size > 10_000) buckets.clear();
    buckets.set(ip, { start: now, count: 1 });
    return true;
  }
  b.count += 1;
  return b.count <= MAX_PER_WINDOW;
}

const empty = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Événements du navigateur (visites, simulateur) : même origine seulement,
 * liste fermée, corps de 1 Ko au plus, débit limité. Toujours 204 pour un
 * événement accepté : le navigateur n'attend rien.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(env().BETTER_AUTH_URL).origin) return empty(403);
  const text = await request.text();
  if (text.length > 1024) return empty(413);
  const ctx = await requestContext();
  if (!allowed(ctx.ip ?? "unknown", Date.now())) return empty(429);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return empty(400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return empty(400);
  const { event, id, properties } = parsed.data;
  track(event as (typeof CLIENT_ANALYTICS_EVENTS)[number], `visitor:${id}`, properties);
  return empty(204);
}

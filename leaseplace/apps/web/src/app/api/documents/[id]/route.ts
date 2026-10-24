import { and, eq, isNull } from "drizzle-orm";
import { recordAudit, schema, withActor } from "@leaseplace/db";
import { appDb } from "@/lib/db";
import { env } from "@/lib/env";
import { requestContext } from "@/lib/request";
import { signingKey, verifyDocumentUrl } from "@/lib/signed-url";
import { documentStorage } from "@/lib/storage";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const NOT_FOUND = () =>
  new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Téléchargement d'un document : lien signé (5 min, lié à l'utilisateur),
 * session valide ET lecture autorisée par la RLS. Toute consultation est
 * auditée. Réponse en pièce jointe, jamais mise en cache, jamais interprétée.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const viewer = await getViewer();
  if (!viewer)
    return new Response("Non authentifié", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  if (!/^[0-9a-f-]{36}$/.test(id)) return NOT_FOUND();
  const key = signingKey(env().BETTER_AUTH_SECRET);
  if (
    !verifyDocumentUrl(
      key,
      id,
      viewer.user.id,
      url.searchParams.get("e"),
      url.searchParams.get("s"),
    )
  ) {
    return new Response("Lien expiré ou invalide", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const ctx = await requestContext();
  const actor = {
    userId: viewer.user.id,
    organizationId: viewer.membership?.organizationId ?? null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
  const doc = await withActor(appDb(), actor, async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.id, id),
          isNull(schema.documents.deletedAt),
          eq(schema.documents.status, "clean"),
        ),
      );
    if (row) {
      await recordAudit(tx, {
        action: "document.downloaded",
        entityType: "document",
        entityId: row.id,
      });
    }
    return row;
  });
  if (!doc) return NOT_FOUND();
  const bytes = await documentStorage().get(doc.storageKey);
  if (!bytes) return NOT_FOUND();
  const ascii = doc.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

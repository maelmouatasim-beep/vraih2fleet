import { recordAudit, withActor } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { appDb } from "@/lib/db";
import { isoDay } from "@/lib/format";
import { buildExport } from "@/lib/privacy/export";
import { actorFor, getViewer } from "@/lib/viewer";

const refuse = (status: number) =>
  new Response(status === 401 ? "Non authentifié" : "Accès refusé", {
    status,
    headers: { "Cache-Control": "no-store" },
  });

/**
 * Droit d'accès et portabilité (loi 09-08) : export JSON de l'entreprise,
 * par son titulaire, jamais pendant un accès support. Chaque export est
 * audité.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return refuse(401);
  const m = viewer.membership;
  if (!m || viewer.impersonation || !can(m.role, "privacy.manage_own")) return refuse(403);
  const full = { ...viewer, membership: m };
  const data = await withActor(appDb(), await actorFor(full), async (tx) => {
    const out = await buildExport(tx, full);
    await recordAudit(tx, {
      action: "data.exported",
      entityType: "organization",
      entityId: m.organizationId,
      metadata: { requests: out.requests.length, documents: out.documents.length },
    });
    return out;
  });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="leaseplace-donnees-${isoDay()}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

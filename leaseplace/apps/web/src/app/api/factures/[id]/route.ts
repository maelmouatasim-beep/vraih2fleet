import { eq } from "drizzle-orm";
import { recordAudit, schema, withActor } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { invoicePdf } from "@/lib/billing/invoice-pdf";
import { gridOf } from "@/lib/billing/data";
import { appDb } from "@/lib/db";
import { actorFor, getViewer } from "@/lib/viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () =>
  new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Facture PDF : plateforme (facturation) ou administrateur du bailleur
 * facturé. La lecture passe par la RLS ; chaque téléchargement est audité.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m || viewer.impersonation) return notFound();
  if (
    !can(m.role, "commission.manage") &&
    !can(m.role, "kpi.read") &&
    !can(m.role, "billing.read_own")
  )
    return notFound();
  const full = { ...viewer, membership: m };
  const doc = await withActor(appDb(), await actorFor(full), async (tx) => {
    const { invoices, commissions, organizations, financingRequests, mandates } = schema;
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id));
    if (!inv) return null;
    const [c] = await tx.select().from(commissions).where(eq(commissions.invoiceId, id));
    if (!c) return null;
    const [org] = await tx
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, inv.lessorOrganizationId));
    const [req] = await tx
      .select({ reference: financingRequests.reference })
      .from(financingRequests)
      .where(eq(financingRequests.id, c.requestId));
    const [mandate] = await tx
      .select({ version: mandates.contractVersion })
      .from(mandates)
      .where(eq(mandates.id, c.mandateId));
    await recordAudit(tx, { action: "invoice.downloaded", entityType: "invoice", entityId: id });
    return {
      number: inv.number,
      issuedOn: inv.issuedOn,
      dueOn: inv.dueOn,
      lessorName: org?.name ?? "",
      reference: req?.reference ?? "",
      activatedOn: c.activatedOn,
      financedAmountHt: c.financedAmountHt,
      mandateVersion: mandate?.version ?? "",
      grid: gridOf(c),
      amountHt: inv.amountHt,
      vatRate: inv.vatRate,
      vat: inv.vat,
      amountTtc: inv.amountTtc,
    };
  });
  if (!doc) return notFound();
  const bytes = await invoicePdf(doc);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

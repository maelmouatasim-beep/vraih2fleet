import { desc, eq, sql } from "drizzle-orm";
import { CircleCheck, Lock, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { schema, withActor } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { PageHeader } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { actorFor, requireSpace } from "@/lib/viewer";

const LIMIT = 100;

export default async function AuditJournal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("audit");

  if (!can(viewer.membership.role, "audit.read")) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t("title")} />
        <EmptyState
          icon={<Lock />}
          title={t("restrictedTitle")}
          description={t("restrictedBody")}
        />
      </div>
    );
  }

  const { auditEvents, users, organizations } = schema;
  const { rows, broken } = await withActor(appDb(), await actorFor(viewer), async (tx) => {
    const rows = await tx
      .select({
        id: auditEvents.id,
        at: auditEvents.occurredAt,
        action: auditEvents.action,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        ip: auditEvents.ip,
        actorId: auditEvents.actorUserId,
        actor: users.name,
        organization: organizations.name,
        metadata: auditEvents.metadata,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .leftJoin(organizations, eq(organizations.id, auditEvents.actorOrganizationId))
      .orderBy(desc(auditEvents.id))
      .limit(LIMIT);
    const [chain] = await tx.execute<{ broken: string | null }>(
      sql`select audit.verify_chain()::text as broken`,
    );
    return { rows, broken: chain?.broken ?? null };
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title={t("title")}
        description={t("description", { limit: LIMIT })}
        actions={
          broken === null ? (
            <Badge tone="success" className="h-7 px-2">
              <CircleCheck aria-hidden="true" />
              {t("chainOk")}
            </Badge>
          ) : (
            <Badge tone="danger" className="h-7 px-2">
              <TriangleAlert aria-hidden="true" />
              {t("chainBroken", { id: broken })}
            </Badge>
          )
        }
      />
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <TableScroll label={t("title")}>
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-end font-medium">
                  #
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  {t("columns.date")}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  {t("columns.action")}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  {t("columns.actor")}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  {t("columns.organization")}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  {t("columns.details")}
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">
                  {t("columns.ip")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-muted/50">
                  <td className="tabular px-4 py-2 text-end font-mono text-[12px] text-fg-subtle">
                    {r.id}
                  </td>
                  <td className="tabular px-4 py-2 whitespace-nowrap text-fg-muted">
                    {formatDateTime(r.at)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Badge
                      tone={r.action === "space.access_denied" ? "danger" : "neutral"}
                      className="font-mono"
                    >
                      {r.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-fg">
                    {r.actor ?? (r.actorId ? t("deletedUser") : t("system"))}
                  </td>
                  <td className="px-4 py-2 text-fg-muted">{r.organization ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-[12px] text-fg-muted">
                    {r.entityType}
                    {r.metadata ? ` ${JSON.stringify(r.metadata)}` : ""}
                  </td>
                  <td className="tabular px-4 py-2 font-mono text-[12px] whitespace-nowrap text-fg-subtle">
                    {r.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-muted">{t("empty")}</p>
        ) : null}
      </div>
    </div>
  );
}

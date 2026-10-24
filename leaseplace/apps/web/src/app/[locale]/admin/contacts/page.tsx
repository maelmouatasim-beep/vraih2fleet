import { desc } from "drizzle-orm";
import { Inbox, Lock } from "lucide-react";
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

/** Demandes de contact du site public (lecture sous RLS : admin et opérations). */
export default async function Contacts({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("contacts");
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
  const rows = await withActor(appDb(), await actorFor(viewer), (tx) =>
    tx.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(200),
  );
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader title={t("title")} description={t("description")} />
      {rows.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <TableScroll label={t("title")}>
            <table className="w-full min-w-[860px] text-[13px]">
              <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                <tr>
                  {(
                    [
                      "date",
                      "kind",
                      "organization",
                      "contact",
                      "email",
                      "phone",
                      "message",
                    ] as const
                  ).map((c) => (
                    <th key={c} scope="col" className="px-4 py-2.5 text-start font-medium">
                      {t(`columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-surface-muted/50">
                    <td className="tabular px-4 py-2.5 whitespace-nowrap text-fg-muted">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.kind === "lessor" ? "accent" : "primary"}>
                        {t(`kinds.${r.kind}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-fg">{r.organizationName}</td>
                    <td className="px-4 py-2.5 text-fg">{r.contactName}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-fg-muted" dir="ltr">
                      {r.email}
                    </td>
                    <td
                      className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap text-fg-muted"
                      dir="ltr"
                    >
                      {r.phone ?? "—"}
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-fg-muted">{r.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
    </div>
  );
}

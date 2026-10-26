import { count, desc, eq, gte, sql } from "drizzle-orm";
import { ClipboardCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { schema, withActor } from "@leaseplace/db";
import { can, isOrganizationType, type OrganizationType } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { KpiDashboard } from "@/components/billing/kpi-dashboard";
import { PageHeader, StatCard } from "@/components/shell/shells";
import { StatusBadge } from "@/components/review/review-view";
import { Link } from "@/i18n/navigation";
import { kpiData } from "@/lib/billing/data";
import { reviewQueue } from "@/lib/review/data";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { actorFor, requireSpace } from "@/lib/viewer";

const TONE: Record<OrganizationType, "primary" | "accent" | "info" | "neutral"> = {
  company: "primary",
  lessor: "accent",
  platform: "info",
  prescriber: "neutral",
  supplier: "neutral",
};

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("spaces.admin");
  const tTypes = await getTranslations("organizationTypes");
  const { organizations, memberships, auditEvents } = schema;
  const canAudit = can(viewer.membership.role, "audit.read");

  // Lecture sous RLS : la plateforme voit toutes les organisations.
  const data = await withActor(appDb(), await actorFor(viewer), async (tx) => {
    const orgs = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
        type: organizations.type,
        members: count(memberships.id),
      })
      .from(organizations)
      .leftJoin(memberships, eq(memberships.organizationId, organizations.id))
      .groupBy(organizations.id)
      .orderBy(organizations.type, organizations.name);
    const [events] = canAudit
      ? await tx
          .select({ n: count() })
          .from(auditEvents)
          .where(gte(auditEvents.occurredAt, sql`now() - interval '24 hours'`))
      : [];
    const [last] = canAudit
      ? await tx
          .select({ at: auditEvents.occurredAt })
          .from(auditEvents)
          .orderBy(desc(auditEvents.id))
          .limit(1)
      : [];
    const kpis = can(viewer.membership.role, "kpi.read") ? await kpiData(tx) : null;
    const queue = can(viewer.membership.role, "kyc.review")
      ? (await reviewQueue(tx)).filter((q) => q.status !== "qualified")
      : null;
    const [mandated] = await tx
      .select({ n: count() })
      .from(schema.mandates)
      .where(eq(schema.mandates.status, "active"));
    return {
      orgs,
      events: events?.n ?? null,
      lastEvent: last?.at ?? null,
      kpis,
      queue,
      mandated: mandated?.n ?? 0,
    };
  });

  const byType = (type: OrganizationType) => data.orgs.filter((o) => o.type === type).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title={t("overviewTitle")} description={t("overviewBody")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("kpiKyc")}
          value={data.queue === null ? "—" : String(data.queue.length)}
          hint={t("kpiKycHint")}
        />
        <StatCard label={t("kpiCompanies")} value={String(byType("company"))} />
        <StatCard
          label={t("kpiLessors")}
          value={String(byType("lessor"))}
          hint={t("kpiLessorsHint", { count: data.mandated })}
        />
        <StatCard
          label={t("kpiEvents")}
          value={data.events === null ? "—" : String(data.events)}
          hint={t("kpiEventsHint")}
        />
      </div>

      {data.kpis ? <KpiDashboard data={data.kpis} /> : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("organizationsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <TableScroll label={t("organizationsTitle")}>
              <table className="w-full min-w-[420px] text-[13px]">
                <thead className="border-y border-border bg-surface-muted/60 text-fg-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2 text-start font-medium">
                      {t("columns.name")}
                    </th>
                    <th scope="col" className="px-5 py-2 text-start font-medium">
                      {t("columns.type")}
                    </th>
                    <th scope="col" className="px-5 py-2 text-end font-medium">
                      {t("columns.members")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.orgs.map((o) => (
                    <tr key={o.id} className="hover:bg-surface-muted/50">
                      <td className="px-5 py-2.5 font-medium text-fg">{o.name}</td>
                      <td className="px-5 py-2.5">
                        {isOrganizationType(o.type) ? (
                          <Badge tone={TONE[o.type]}>{tTypes(o.type)}</Badge>
                        ) : (
                          o.type
                        )}
                      </td>
                      <td className="tabular px-5 py-2.5 text-end text-fg-muted">{o.members}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          {data.queue && data.queue.length > 0 ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{t("queueTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border" data-overview-queue>
                  {data.queue.slice(0, 8).map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
                    >
                      <span className="min-w-0">
                        <Link
                          href={`/admin/dossiers/${q.id}`}
                          className="tabular font-mono font-medium text-primary hover:underline"
                        >
                          {q.reference}
                        </Link>
                        <span className="block truncate text-fg-muted">{q.companyName}</span>
                      </span>
                      <StatusBadge status={q.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={<ClipboardCheck />}
              title={t("kycEmptyTitle")}
              description={t("kycEmptyBody")}
              className="h-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}

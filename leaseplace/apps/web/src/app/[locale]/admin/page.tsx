import { count, desc, eq, gte, sql } from "drizzle-orm";
import { ClipboardCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { schema, withActor } from "@leaseplace/db";
import { can, isOrganizationType, type OrganizationType } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { PageHeader, StatCard } from "@/components/shell/shells";
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
    return { orgs, events: events?.n ?? null, lastEvent: last?.at ?? null };
  });

  const byType = (type: OrganizationType) => data.orgs.filter((o) => o.type === type).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title={t("overviewTitle")} description={t("overviewBody")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("kpiKyc")} value="0" hint={t("kpiKycHint")} />
        <StatCard label={t("kpiCompanies")} value={String(byType("company"))} />
        <StatCard
          label={t("kpiLessors")}
          value={String(byType("lessor"))}
          hint={t("kpiLessorsHint")}
        />
        <StatCard
          label={t("kpiEvents")}
          value={data.events === null ? "—" : String(data.events)}
          hint={t("kpiEventsHint")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t("organizationsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            <div className="overflow-x-auto">
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
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <EmptyState
            icon={<ClipboardCheck />}
            title={t("kycEmptyTitle")}
            description={t("kycEmptyBody")}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}

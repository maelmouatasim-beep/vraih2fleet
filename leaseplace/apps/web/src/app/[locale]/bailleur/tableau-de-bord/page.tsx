import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { schema, withActor } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { PageHeader, StatCard } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { formatMad, formatNumber, formatPercent, ltr } from "@/lib/format";
import { lessorInbox, lessorStats } from "@/lib/lessor/data";
import { actorFor, requireSpace } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lessor.dashboard" });
  return { title: t("title") };
}

/** Tableau de bord du bailleur : volumes, réactivité, taux de gain, commissions dues. */
export default async function LessorDashboard({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("lessor", locale as Locale);
  const t = await getTranslations("lessor.dashboard");
  const { rows, decided, owed } = await withActor(appDb(), await actorFor(viewer), async (tx) => ({
    rows: await lessorInbox(tx, viewer.membership.organizationId),
    decided: await tx
      .select({ status: schema.offers.status, n: sql<number>`count(*)::int` })
      .from(schema.offers)
      .where(
        and(
          eq(schema.offers.lessorOrganizationId, viewer.membership.organizationId),
          inArray(schema.offers.status, ["accepted", "not_retained"]),
        ),
      )
      .groupBy(schema.offers.status),
    owed: can(viewer.membership.role, "billing.read_own")
      ? await tx
          .select({ total: sql<number>`coalesce(sum(${schema.commissions.amountTtc}), 0)::float8` })
          .from(schema.commissions)
          .where(
            and(
              eq(schema.commissions.lessorOrganizationId, viewer.membership.organizationId),
              inArray(schema.commissions.status, ["due", "invoiced"]),
            ),
          )
          .then((r) => r[0]?.total ?? 0)
      : null,
  }));
  // Taux de gain : offres acceptées parmi les offres tranchées par les entreprises.
  const won = decided.find((d) => d.status === "accepted")?.n ?? 0;
  const lost = decided.find((d) => d.status === "not_retained")?.n ?? 0;
  const s = lessorStats(rows, new Date());
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t("received")}
          value={formatNumber(s.received)}
          hint={t("received30d", { count: s.received30d })}
        />
        <StatCard
          label={t("responseRate")}
          value={s.responseRate === null ? "—" : ltr(formatPercent(s.responseRate, 0))}
          hint={t("responseRateHint")}
        />
        <StatCard
          label={t("delay")}
          value={
            s.averageDelayHours === null
              ? "—"
              : t("hours", { n: formatNumber(s.averageDelayHours, 1) })
          }
          hint={t("delayHint")}
        />
        <StatCard
          label={t("pending")}
          value={formatNumber(s.pending)}
          hint={t("overdue", { count: s.overdue })}
        />
        <StatCard label={t("offered")} value={formatNumber(s.offered)} />
        <StatCard label={t("declined")} value={formatNumber(s.declined)} />
        <StatCard
          label={t("winRate")}
          value={won + lost === 0 ? "—" : ltr(formatPercent(won / (won + lost), 0))}
          hint={t("winRateHint", { won, decided: won + lost })}
        />
        <StatCard
          label={t("commissions")}
          value={owed === null ? "—" : ltr(formatMad(owed, 0))}
          hint={owed === null ? t("commissionsRestricted") : t("commissionsHint")}
        />
      </div>
    </div>
  );
}

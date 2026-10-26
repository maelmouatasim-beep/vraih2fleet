import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { PageHeader, StatCard } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { formatNumber, formatPercent, ltr } from "@/lib/format";
import { lessorInbox, lessorStats } from "@/lib/lessor/data";
import { actorFor, requireSpace } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lessor.dashboard" });
  return { title: t("title") };
}

/** Tableau de bord du bailleur : volumes, réactivité ; gains et commissions aux phases 7 et 8. */
export default async function LessorDashboard({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("lessor", locale as Locale);
  const t = await getTranslations("lessor.dashboard");
  const rows = await withActor(appDb(), await actorFor(viewer), (tx) =>
    lessorInbox(tx, viewer.membership.organizationId),
  );
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
        <StatCard label={t("winRate")} value="—" hint={t("winRateHint")} />
        <StatCard label={t("commissions")} value="—" hint={t("commissionsHint")} />
      </div>
    </div>
  );
}

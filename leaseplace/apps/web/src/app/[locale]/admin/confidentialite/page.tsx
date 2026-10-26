import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { can, LEGAL_RETENTION_YEARS, RETENTION_KEYS, RETENTION_RULES } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { Card, CardContent } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import { ErasureActions, RetentionField, RunRetention } from "@/components/privacy/admin-privacy";
import { PageHeader } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { privacyQueue, retentionOverview } from "@/lib/privacy/data";
import { actorFor, requireSpace } from "@/lib/viewer";
import {
  executeErasureAction,
  rejectErasureAction,
  runRetentionAction,
  saveRetentionAction,
} from "../../privacy-actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy.admin" });
  return { title: t("title"), robots: { index: false } };
}

const TONES = {
  pending: "warning",
  completed: "success",
  rejected: "danger",
  cancelled: "neutral",
} as const;

/** Droits des personnes (loi 09-08) : demandes d'effacement et durées de conservation. */
export default async function AdminPrivacy({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("privacy.admin");
  const tr = await getTranslations("privacy.retention");
  if (!can(viewer.membership.role, "privacy.manage"))
    return (
      <EmptyState
        icon={<ShieldCheck />}
        title={t("restrictedTitle")}
        description={t("restrictedBody")}
      />
    );
  const { queue, retention } = await withActor(appDb(), await actorFor(viewer), async (tx) => ({
    queue: await privacyQueue(tx),
    retention: await retentionOverview(tx),
  }));
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <section aria-labelledby="erasures" className="flex flex-col gap-3">
        <h2 id="erasures" className="text-[15px] font-semibold text-fg">
          {t("requestsTitle")}
        </h2>
        {queue.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title={t("emptyTitle")} description={t("emptyBody")} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <TableScroll label={t("requestsTitle")}>
              <table className="w-full min-w-[900px] text-[13px]">
                <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                  <tr>
                    {(
                      [
                        "organization",
                        "requestedBy",
                        "requested",
                        "due",
                        "status",
                        "actions",
                      ] as const
                    ).map((c) => (
                      <th
                        key={c}
                        scope="col"
                        className={`px-4 py-2.5 font-medium ${c === "actions" ? "text-end" : "text-start"}`}
                      >
                        {t(`columns.${c}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.map((r) => (
                    <tr key={r.id} data-privacy-request={r.organizationName} className="align-top">
                      <td className="px-4 py-3 font-medium text-fg">
                        {r.organizationName}
                        {r.note ? (
                          <p className="mt-1 max-w-xs text-[12px] font-normal text-fg-muted">
                            {r.note}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{r.requesterName}</td>
                      <td className="tabular px-4 py-3 whitespace-nowrap">
                        {formatDate(r.requestedAt)}
                      </td>
                      <td className="tabular px-4 py-3 whitespace-nowrap">{formatDate(r.dueOn)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={TONES[r.status as keyof typeof TONES]}>
                          {t(`statuses.${r.status}`)}
                        </Badge>
                        {r.issues.map((i) => (
                          <p key={i} className="mt-1 text-[12px] text-warning">
                            {t(`issues.${i}`)}
                          </p>
                        ))}
                        {r.status === "rejected" && r.rejectReason ? (
                          <p className="mt-1 text-[12px] text-fg-muted">
                            {t(`reasons.${r.rejectReason}`)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {r.status === "pending" ? (
                          <ErasureActions
                            id={r.id}
                            blocked={r.issues.length > 0}
                            actions={{ execute: executeErasureAction, reject: rejectErasureAction }}
                          />
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}
      </section>

      <section aria-labelledby="retention" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="retention" className="text-[15px] font-semibold text-fg">
              {tr("title")}
            </h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              {retention.lastRun
                ? tr("lastRun", { at: formatDateTime(retention.lastRun.at) })
                : tr("neverRun")}
            </p>
          </div>
          <RunRetention run={runRetentionAction} />
        </div>
        <Card>
          <CardContent className="p-0">
            <TableScroll label={tr("title")}>
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      {tr("columns.rule")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {tr("columns.bounds")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {tr("columns.days")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {RETENTION_KEYS.map((key) => {
                    const rule = RETENTION_RULES[key];
                    return (
                      <tr key={key}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-fg">{tr(`rules.${key}.label`)}</p>
                          <p className="text-[12px] text-fg-muted">{tr(`rules.${key}.body`)}</p>
                        </td>
                        <td className="tabular px-4 py-3 text-end whitespace-nowrap text-fg-muted">
                          {tr("bounds", {
                            min: rule.minDays,
                            max: rule.maxDays,
                            default: rule.defaultDays,
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <RetentionField
                            ruleKey={key}
                            days={retention.days[key]}
                            min={rule.minDays}
                            max={rule.maxDays}
                            canEdit
                            save={saveRetentionAction}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="px-4 py-3">
                      <p className="font-medium text-fg">{tr("legal.label")}</p>
                      <p className="text-[12px] text-fg-muted">{tr("legal.body")}</p>
                    </td>
                    <td className="px-4 py-3 text-end text-fg-muted">—</td>
                    <td className="tabular px-4 py-3 text-end whitespace-nowrap text-fg">
                      {tr("years", { count: LEGAL_RETENTION_YEARS.accounting })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </TableScroll>
          </CardContent>
        </Card>
        <p className="text-[12px] text-fg-subtle">{tr("jobNote")}</p>
      </section>
    </div>
  );
}

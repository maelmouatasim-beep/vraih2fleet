import { ArrowLeft, FileText, Scale } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { MemoOutput } from "@leaseplace/ai";
import { withActor } from "@leaseplace/db";
import { can, type FactorScore, type Flag, type Periodicity } from "@leaseplace/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { DeclinePanel, OfferFormPanel, WithdrawButton } from "@/components/lessor/lessor-forms";
import { SlaBadge, TargetBadge } from "@/components/lessor/lessor-view";
import {
  ChecksTable,
  DownloadLink,
  FactorTable,
  FlagList,
  MemoView,
} from "@/components/review/review-view";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { appDb } from "@/lib/db";
import { env } from "@/lib/env";
import {
  formatDate,
  formatDateTime,
  formatMad,
  formatNumber,
  formatPercent,
  ltr,
} from "@/lib/format";
import { markViewed } from "@/lib/lessor/actions";
import { lessorTarget } from "@/lib/lessor/data";
import { latestAssessment, latestChecks, reviewDocuments } from "@/lib/review/data";
import { signDocumentUrl, signingKey } from "@/lib/signed-url";
import { actorFor, requireSpace } from "@/lib/viewer";
import { declineAction, submitOfferAction, withdrawOfferAction } from "../../actions";

type Props = { params: Promise<{ locale: string; id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lessor.file" });
  return { title: t("title"), robots: { index: false } };
}

/** Fiche dossier du bailleur : synthèse, indice, pièces filigranées, réponse. */
export default async function LessorFile({ params }: Props) {
  const { locale, id } = await params;
  if (!UUID.test(id)) notFound();
  const viewer = await requireSpace("lessor", locale as Locale);
  const data = await withActor(appDb(), await actorFor(viewer), async (tx) => {
    await markViewed(tx, viewer, id);
    const file = await lessorTarget(tx, id);
    if (!file || file.target.lessorOrganizationId !== viewer.membership.organizationId) return null;
    const [assessment, checks, docs] = await Promise.all([
      latestAssessment(tx, file.request.id),
      latestChecks(tx, file.request.id),
      reviewDocuments(tx, file.request),
    ]);
    return { ...file, assessment, checks, docs };
  });
  if (!data) notFound();
  const { target, request, company, companyName, memo, offer, decline, assessment, checks, docs } =
    data;
  const t = await getTranslations("lessor.file");
  const tr = await getTranslations("review");
  const tl = await getTranslations("company.labels");
  const tw = await getTranslations("company.wizard");
  const td = await getTranslations("lessor.decline");
  const now = new Date();
  const key = signingKey(env().BETTER_AUTH_SECRET);
  const docLabel = (docId: string) => {
    const d = docs.find((x) => x.id === docId);
    return d ? tl(`documentTypes.${d.type}`) : "—";
  };
  const sourceMap = (memo?.sourceMap ?? {}) as Record<string, string>;
  const sourceLabel = (src: string) =>
    sourceMap[src] ? docLabel(sourceMap[src]) : tr(`memo.sources.${src}`);
  const canAnswer = can(viewer.membership.role, "offer.submit");

  const facts: readonly (readonly [string, string])[] = [
    [
      tw("category"),
      request.equipmentCategory ? tl(`equipmentCategories.${request.equipmentCategory}`) : "—",
    ],
    [tw("condition"), request.condition ? tl(`conditions.${request.condition}`) : "—"],
    [tw("amount"), request.amountHt ? ltr(formatMad(request.amountHt, 0)) : "—"],
    [tw("duration"), request.durationMonths ? tw("months", { n: request.durationMonths }) : "—"],
    [tw("firstRent"), ltr(formatPercent((request.firstRentPct ?? 0) / 100, 0))],
    [tw("residual"), ltr(formatPercent((request.residualPct ?? 0) / 100, 0))],
    [tw("periodicity"), request.periodicity ? tl(`periodicities.${request.periodicity}`) : "—"],
    [tw("supplier"), request.supplierName ?? "—"],
    [tr("company.ice"), company?.ice ?? "—"],
    [tr("company.legalForm"), company ? tl(`legalForms.${company.legalForm}`) : "—"],
    [tr("company.sector"), company ? tl(`sectors.${company.sector}`) : "—"],
    [tr("company.city"), company?.city ?? "—"],
    [
      tr("company.created"),
      company?.incorporationDate ? formatDate(company.incorporationDate) : "—",
    ],
    [tr("company.revenue"), company?.revenueBand ? tl(`revenueBands.${company.revenueBand}`) : "—"],
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <Link
          href="/bailleur"
          className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
          {t("back")}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{companyName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
              <span className="tabular font-mono">{request.reference}</span>
              <TargetBadge status={target.status} />
              {target.sentAt ? (
                <span>{t("received", { date: formatDateTime(target.sentAt) })}</span>
              ) : null}
              <SlaBadge dueAt={target.slaDueAt} status={target.status} now={now} />
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("memoTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {memo ? (
                <MemoView content={memo.content as MemoOutput} sourceLabel={sourceLabel} />
              ) : (
                <p className="text-[13px] text-fg-muted">{t("noMemo")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{tr("checks.title")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <ChecksTable checks={checks} docLabel={docLabel} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("documentsTitle", { count: docs.length })}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 pt-2">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 text-[13px]"
                  data-lessor-document={d.type}
                >
                  <FileText className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-fg">{tl(`documentTypes.${d.type}`)}</span>
                    <span className="text-fg-muted"> · {d.originalName}</span>
                  </span>
                  <DownloadLink
                    href={signDocumentUrl(key, d.id, viewer.user.id)}
                    label={tr("documents.download", { name: d.originalName })}
                  />
                </div>
              ))}
              <p className="mt-2 text-[12px] text-fg-subtle">
                {t("watermarkNote", { organization: viewer.membership.organizationName })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("requestTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {request.equipmentDescription ? (
                <p className="mb-3 text-[14px] text-fg">{request.equipmentDescription}</p>
              ) : null}
              <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border pb-1.5">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="tabular text-end font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="size-4 text-primary" aria-hidden="true" />
                {tr("score.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {assessment ? (
                <>
                  <div className="flex items-end gap-4" data-grade={assessment.grade}>
                    <span className="flex size-14 items-center justify-center rounded-xl bg-primary-soft font-display text-[30px] font-medium text-primary-soft-fg">
                      {assessment.grade}
                    </span>
                    <p className="tabular text-[14px] font-semibold text-fg">
                      {tr("score.score", { score: formatNumber(assessment.row.score, 1) })}
                    </p>
                  </div>
                  <p className="rounded-md bg-surface-muted px-3 py-2 text-[12px] font-medium text-fg">
                    {tr("score.disclaimer")}
                  </p>
                  <FactorTable factors={assessment.row.factors as FactorScore[]} />
                  <FlagList flags={assessment.row.flags as Flag[]} />
                </>
              ) : (
                <p className="text-[13px] text-fg-muted">{tr("score.none")}</p>
              )}
            </CardContent>
          </Card>

          <Card data-response>
            <CardHeader>
              <CardTitle>{t("responseTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {offer ? (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-[13px]" data-offer-summary>
                    {(
                      [
                        [t("offer.rent"), ltr(formatMad(offer.rentHt, 2))],
                        [t("offer.firstRent"), ltr(formatMad(offer.firstRentHt, 2))],
                        [t("offer.effectiveRate"), ltr(formatPercent(offer.effectiveRate, 2))],
                        [t("offer.cost"), ltr(formatMad(offer.financingCostHt, 0))],
                        [t("offer.duration"), tw("months", { n: offer.durationMonths })],
                        [t("offer.validUntil"), formatDate(offer.validUntil)],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-fg-muted">{k}</dt>
                        <dd className="tabular font-semibold text-fg">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {offer.conditions ? (
                    <p className="text-[13px] text-fg-muted">{offer.conditions}</p>
                  ) : null}
                  {canAnswer ? (
                    <WithdrawButton targetId={target.id} action={withdrawOfferAction} />
                  ) : null}
                </>
              ) : decline ? (
                <p className="text-[14px] text-fg">
                  {t("declined", {
                    reason: td(`reasons.${decline.reason}`),
                    date: formatDate(decline.declinedAt),
                  })}
                  {decline.note ? (
                    <span className="block text-[13px] text-fg-muted">{decline.note}</span>
                  ) : null}
                </p>
              ) : canAnswer ? (
                <>
                  <OfferFormPanel
                    targetId={target.id}
                    requested={{
                      amountHt: request.amountHt ?? 0,
                      durationMonths: request.durationMonths ?? 60,
                      periodicity: (request.periodicity ?? "monthly") as Periodicity,
                      firstRentPct: request.firstRentPct ?? 0,
                      residualPct: request.residualPct ?? 0,
                    }}
                    action={submitOfferAction}
                  />
                  <DeclinePanel targetId={target.id} action={declineAction} />
                </>
              ) : (
                <p className="text-[13px] text-fg-muted">{t("readOnly")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

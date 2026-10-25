import { ArrowLeft, FlaskConical, Lock, Scale } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { MemoOutput } from "@leaseplace/ai";
import { withActor } from "@leaseplace/db";
import { can, GRADES, type FactorScore, type Flag } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Badge } from "@leaseplace/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import {
  AnalysisButton,
  DecisionPanel,
  DocumentDecision,
  GenerateMemoButton,
  MemoDecision,
  OverrideForm,
} from "@/components/review/review-controls";
import {
  ChecksTable,
  DownloadLink,
  ExtractedFieldsView,
  FactorTable,
  FlagList,
  MemoView,
  StatusBadge,
} from "@/components/review/review-view";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { aiProvider } from "@/lib/ai";
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
import {
  failedExtractions,
  fieldsOf,
  lastMemoRun,
  latestAssessment,
  latestChecks,
  latestExtractions,
  memosOf,
  reviewCompany,
  reviewDocuments,
  reviewRequest,
  reviewTimeline,
} from "@/lib/review/data";
import { signDocumentUrl, signingKey } from "@/lib/signed-url";
import { actorFor, requireSpace } from "@/lib/viewer";
import {
  analyzeAction,
  decideMemoAction,
  generateMemoAction,
  overrideGradeAction,
  qualifyAction,
  requestInfoAction,
  reviewDocumentAction,
  startReviewAction,
} from "../actions";

type Props = { params: Promise<{ locale: string; id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return { title: t("page.title"), robots: { index: false } };
}

const REVIEW_TONE = {
  pending: "neutral",
  extracted: "info",
  verified: "success",
  rejected: "danger",
} as const;

export default async function ReviewPage({ params }: Props) {
  const { locale, id } = await params;
  const viewer = await requireSpace("admin", locale as Locale);
  const t = await getTranslations("review");
  const tl = await getTranslations("company.labels");
  const tw = await getTranslations("company.wizard");
  const tr = await getTranslations("company.requests");
  if (!can(viewer.membership.role, "kyc.review")) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t("page.title")} />
        <EmptyState
          icon={<Lock />}
          title={t("restrictedTitle")}
          description={t("restrictedBody")}
        />
      </div>
    );
  }
  if (!UUID.test(id)) notFound();

  const data = await withActor(appDb(), await actorFor(viewer), async (tx) => {
    const request = await reviewRequest(tx, id);
    if (!request) return null;
    const company = await reviewCompany(tx, request.organizationId);
    const docs = await reviewDocuments(tx, request);
    const [extractions, failed, checks, assessment, memos, memoRun, timeline] = await Promise.all([
      latestExtractions(
        tx,
        docs.map((d) => d.id),
      ),
      failedExtractions(tx, id),
      latestChecks(tx, id),
      latestAssessment(tx, id),
      memosOf(tx, id),
      lastMemoRun(tx, id),
      reviewTimeline(tx, id),
    ]);
    return {
      request,
      company,
      docs,
      extractions,
      failed,
      checks,
      assessment,
      memos,
      memoRun,
      timeline,
    };
  });
  if (!data?.company) notFound();
  const {
    request,
    company,
    docs,
    extractions,
    failed,
    checks,
    assessment,
    memos,
    memoRun,
    timeline,
  } = data;

  const inReview = request.status === "in_review";
  const docLabel = (docId: string) => {
    const d = docs.find((x) => x.id === docId);
    return d ? tl(`documentTypes.${d.type}`) : docId.slice(0, 8);
  };
  const memo =
    memos.find((m) => m.status === "draft") ?? memos.find((m) => m.status === "approved") ?? null;
  const sourceMap = (memo?.sourceMap ?? {}) as Record<string, string>;
  const sourceLabel = (src: string) => {
    const docId = sourceMap[src];
    return docId ? docLabel(docId) : t(`memo.sources.${src}`);
  };
  const key = signingKey(env().BETTER_AUTH_SECRET);
  const provider = aiProvider();
  const factors = (assessment?.row.factors ?? []) as FactorScore[];
  const flags = (assessment?.row.flags ?? []) as Flag[];

  const requestFacts: readonly (readonly [string, string])[] = [
    [
      tw("category"),
      request.equipmentCategory ? tl(`equipmentCategories.${request.equipmentCategory}`) : "—",
    ],
    [
      tw("condition"),
      request.condition
        ? `${tl(`conditions.${request.condition}`)}${request.equipmentYear ? ` (${String(request.equipmentYear)})` : ""}`
        : "—",
    ],
    [tw("amount"), request.amountHt ? ltr(formatMad(request.amountHt, 0)) : "—"],
    [tw("duration"), request.durationMonths ? tw("months", { n: request.durationMonths }) : "—"],
    [tw("firstRent"), ltr(formatPercent((request.firstRentPct ?? 0) / 100, 0))],
    [tw("residual"), ltr(formatPercent((request.residualPct ?? 0) / 100, 0))],
    [tw("periodicity"), request.periodicity ? tl(`periodicities.${request.periodicity}`) : "—"],
    [tw("supplier"), request.supplierName ?? "—"],
  ];
  const companyFacts: readonly (readonly [string, string])[] = [
    [t("company.ice"), company.ice],
    [t("company.rc"), company.rcNumber ?? "—"],
    [t("company.legalForm"), tl(`legalForms.${company.legalForm}`)],
    [t("company.sector"), tl(`sectors.${company.sector}`)],
    [t("company.city"), company.city],
    [t("company.created"), company.incorporationDate ? formatDate(company.incorporationDate) : "—"],
    [t("company.revenue"), company.revenueBand ? tl(`revenueBands.${company.revenueBand}`) : "—"],
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <Link
          href="/admin/dossiers"
          className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
          {t("page.back")}
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{company.legalName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
              <span className="tabular font-mono">{request.reference}</span>
              <StatusBadge status={request.status} />
              {request.submittedAt ? (
                <span>{tr("submittedOn", { date: formatDate(request.submittedAt) })}</span>
              ) : null}
            </p>
          </div>
          {request.status === "submitted" ? (
            <AnalysisButton mode="start" requestId={request.id} action={startReviewAction} />
          ) : inReview ? (
            <AnalysisButton mode="rerun" requestId={request.id} action={analyzeAction} />
          ) : null}
        </div>
      </div>

      {!provider.real ? (
        <Alert tone="warning">
          <FlaskConical aria-hidden="true" />
          <span>{t("page.simulated")}</span>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("checks.title")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <ChecksTable checks={checks} docLabel={docLabel} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("documents.title", { count: docs.length })}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y divide-border pt-2">
              {docs.map((d) => {
                const ex = extractions.get(d.id);
                const warnings = (ex?.warnings ?? []) as string[];
                return (
                  <article
                    key={d.id}
                    className="flex flex-col gap-2 py-3"
                    data-review-document={d.type}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-semibold text-fg">
                        {tl(`documentTypes.${d.type}`)}
                      </h3>
                      <Badge tone={REVIEW_TONE[d.reviewStatus as keyof typeof REVIEW_TONE]}>
                        {t(`documents.statuses.${d.reviewStatus}`)}
                      </Badge>
                      {failed.has(d.id) || ex?.readable === false ? (
                        <Badge tone="danger">{t("documents.unreadable")}</Badge>
                      ) : null}
                      <span className="ms-auto flex items-center gap-1 text-[12px] text-fg-subtle">
                        <span className="max-w-48 truncate">{d.originalName}</span>
                        <DownloadLink
                          href={signDocumentUrl(key, d.id, viewer.user.id)}
                          label={t("documents.download", { name: d.originalName })}
                        />
                      </span>
                    </div>
                    {ex?.readable ? <ExtractedFieldsView fields={fieldsOf(ex)} /> : null}
                    {!ex && !failed.has(d.id) ? (
                      <p className="text-[12px] text-fg-subtle">{t("documents.notAnalyzed")}</p>
                    ) : null}
                    {warnings.length > 0 ? (
                      <ul className="list-disc ps-5 text-[12px] text-warning">
                        {warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    ) : null}
                    {d.reviewNote ? (
                      <p className="text-[12px] text-fg-muted">
                        {t("documents.note", { note: d.reviewNote })}
                      </p>
                    ) : null}
                    {inReview ? (
                      <DocumentDecision
                        documentId={d.id}
                        name={d.originalName}
                        action={reviewDocumentAction}
                      />
                    ) : null}
                  </article>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("page.requestTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {request.equipmentDescription ? (
                <p className="mb-3 text-[14px] text-fg">{request.equipmentDescription}</p>
              ) : null}
              <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                {[...requestFacts, ...companyFacts].map(([k, v]) => (
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
                {t("score.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {assessment ? (
                <>
                  <div className="flex items-end gap-4" data-grade={assessment.grade}>
                    <span className="flex size-16 items-center justify-center rounded-xl bg-primary-soft font-display text-[36px] font-medium text-primary-soft-fg">
                      {assessment.grade}
                    </span>
                    <div className="text-[13px] text-fg-muted">
                      <p className="tabular text-[15px] font-semibold text-fg">
                        {t("score.score", { score: formatNumber(assessment.row.score, 1) })}
                      </p>
                      {assessment.grade !== assessment.row.grade ? (
                        <p>{t("score.computed", { grade: assessment.row.grade })}</p>
                      ) : null}
                      {assessment.row.grade !== assessment.row.uncappedGrade ? (
                        <p>{t("score.capped", { grade: assessment.row.uncappedGrade })}</p>
                      ) : null}
                      <p>
                        {t("score.model", {
                          version: assessment.row.modelVersion,
                          date: formatDateTime(assessment.row.createdAt),
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="rounded-md bg-surface-muted px-3 py-2 text-[12px] font-medium text-fg">
                    {t("score.disclaimer")}
                  </p>
                  <FactorTable factors={factors} />
                  <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-fg">
                      {t("score.flagsTitle")}
                    </h3>
                    <FlagList flags={flags} />
                  </div>
                  {assessment.overrides.length > 0 ? (
                    <ul className="flex flex-col gap-1 text-[12px] text-fg-muted">
                      {assessment.overrides.map((o) => (
                        <li key={o.id}>
                          {t("score.overrideLine", {
                            grade: o.grade,
                            date: formatDateTime(o.createdAt),
                            reason: o.reason,
                          })}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {inReview && can(viewer.membership.role, "score.override") ? (
                    <OverrideForm
                      assessmentId={assessment.row.id}
                      current={assessment.grade}
                      grades={GRADES}
                      action={overrideGradeAction}
                    />
                  ) : null}
                </>
              ) : (
                <p className="text-[13px] text-fg-muted">{t("score.none")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("memo.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {memo ? (
                <>
                  <p className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
                    <Badge tone={memo.status === "approved" ? "success" : "warning"}>
                      {t(`memo.statuses.${memo.status}`)}
                    </Badge>
                    {memo.decidedAt
                      ? t("memo.decidedOn", { date: formatDateTime(memo.decidedAt) })
                      : t("memo.humanCheck")}
                  </p>
                  <MemoView content={memo.content as MemoOutput} sourceLabel={sourceLabel} />
                  {inReview && memo.status === "draft" ? (
                    <MemoDecision memoId={memo.id} action={decideMemoAction} />
                  ) : null}
                </>
              ) : (
                <p className="text-[13px] text-fg-muted">{t("memo.none")}</p>
              )}
              {memoRun && memoRun.status !== "succeeded" ? (
                <Alert tone="warning">{t(`memo.lastRun.${memoRun.status}`)}</Alert>
              ) : null}
              {inReview && assessment ? (
                <GenerateMemoButton
                  requestId={request.id}
                  action={generateMemoAction}
                  hasDraft={memo?.status === "draft"}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {inReview ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("decision.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <DecisionPanel
              requestId={request.id}
              hasFailures={checks.some((c) => c.status === "fail")}
              requestInfo={requestInfoAction}
              qualify={qualifyAction}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{tr("timelineTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-3">
            {timeline.map((e) => {
              const note = (e.metadata as { note?: string } | null)?.note;
              return (
                <li key={e.id} className="text-[13px]">
                  <span className="font-medium text-fg">{tr(`timeline.${e.toStatus}`)}</span>
                  <span className="tabular ms-2 text-fg-subtle">
                    {formatDateTime(e.occurredAt)}
                  </span>
                  {note ? <p className="mt-0.5 text-fg-muted">{note}</p> : null}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

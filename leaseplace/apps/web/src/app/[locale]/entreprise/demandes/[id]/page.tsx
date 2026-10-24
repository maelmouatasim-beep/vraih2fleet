import { and, eq, isNull } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, Circle, Download, FileText, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { schema } from "@leaseplace/db";
import { can, requestMachine, REQUEST_STATUSES } from "@leaseplace/domain";
import { Badge } from "@leaseplace/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { CancelRequestButton } from "@/components/company/request-buttons";
import { statusTone } from "@/components/company/request-list";
import { RequestWizard } from "@/components/company/request-wizard";
import { Link } from "@/i18n/navigation";
import {
  currentLegalText,
  draftOf,
  getCompany,
  getRequest,
  kycState,
  listDocuments,
  requestAttachments,
  requestTimeline,
} from "@/lib/company-data";
import { loadCompanyPage } from "@/lib/company-page";
import { env } from "@/lib/env";
import { formatDate, formatDateTime, formatMad, formatPercent, ltr } from "@/lib/format";
import { signDocumentUrl, signingKey } from "@/lib/signed-url";
import {
  cancelRequestAction,
  detachDocumentAction,
  saveDraftAction,
  submitRequestAction,
  uploadDocumentAction,
} from "../../actions";

type Props = { params: Promise<{ locale: string; id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "company.requests" });
  return { title: t("detailTitle"), robots: { index: false } };
}

export default async function RequestPage({ params }: Props) {
  const { locale, id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await loadCompanyPage(locale, async (tx, v) => {
    const request = await getRequest(tx, id);
    if (!request) return { request: null };
    const company = await getCompany(tx, v.membership.organizationId);
    const docs = await listDocuments(tx, v.membership.organizationId);
    const [attachments, timeline, legalText, consent] = await Promise.all([
      requestAttachments(tx, id),
      requestTimeline(tx, id),
      currentLegalText(tx, "consent_processing", locale),
      tx
        .select({ grantedAt: schema.consents.grantedAt, version: schema.legalTexts.version })
        .from(schema.consents)
        .innerJoin(schema.legalTexts, eq(schema.legalTexts.id, schema.consents.legalTextId))
        .where(and(eq(schema.consents.requestId, id), isNull(schema.consents.revokedAt)))
        .then((rows) => rows[0] ?? null),
    ]);
    return {
      request,
      kyc: company ? kycState(company, docs) : null,
      attachments: attachments
        .map((a) => a.document)
        .filter((d) => d.status === "clean" && !d.deletedAt),
      timeline,
      legalText,
      consent,
    };
  });
  const { request, viewer } = data;
  if (!request || !("attachments" in data)) notFound();
  const { kyc, attachments, timeline, legalText, consent } = data;

  if (request.status === "draft") {
    return (
      <RequestWizard
        request={{
          id: request.id,
          reference: request.reference,
          version: request.version,
          draft: draftOf(request),
        }}
        quotes={attachments
          .filter((d) => d.type === "quote")
          .map((d) => ({ id: d.id, name: d.originalName }))}
        kyc={{
          items: kyc?.completeness.items ?? [],
          complete: kyc?.completeness.complete ?? false,
        }}
        canConsent={can(viewer.membership.role, "consent.grant")}
        consentText={legalText?.body ?? ""}
        actions={{
          save: saveDraftAction,
          submit: submitRequestAction,
          upload: uploadDocumentAction,
          detach: detachDocumentAction,
        }}
      />
    );
  }

  const t = await getTranslations("company.requests");
  const tw = await getTranslations("company.wizard");
  const tl = await getTranslations("company.labels");
  const key = signingKey(env().BETTER_AUTH_SECRET);
  const status = (REQUEST_STATUSES as readonly string[]).includes(request.status)
    ? (request.status as (typeof REQUEST_STATUSES)[number])
    : null;
  const cancellable = status !== null && requestMachine.can(status, "cancel");
  const summary: readonly (readonly [string, string])[] = [
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
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/entreprise/demandes"
          className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
          {t("back")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {request.equipmentCategory
              ? tl(`equipmentCategories.${request.equipmentCategory}`)
              : t("untitled")}
          </h1>
          <Badge tone={statusTone(request.status)}>{t(`statuses.${request.status}`)}</Badge>
        </div>
        <p className="tabular mt-1 font-mono text-[12px] text-fg-subtle">{request.reference}</p>
      </div>

      {request.status === "submitted" ? (
        <Card className="bg-info-soft/60">
          <CardContent className="text-[14px] text-fg">
            <p className="font-medium">{t("nextTitle")}</p>
            <p className="mt-1 text-fg-muted">{t("nextBody")}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("summaryTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {request.equipmentDescription ? (
                <p className="mb-4 text-[14px] text-fg">{request.equipmentDescription}</p>
              ) : null}
              <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
                {summary.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-border pb-2">
                    <dt className="text-fg-muted">{k}</dt>
                    <dd className="tabular text-end font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("attachmentsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-[13px] text-fg-muted">—</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {attachments.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-[13px]">
                      <FileText className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-fg">{d.originalName}</span>
                        <span className="text-fg-muted"> · {tl(`documentTypes.${d.type}`)}</span>
                      </span>
                      <a
                        href={signDocumentUrl(key, d.id, viewer.user.id)}
                        className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
                        aria-label={t("download", { name: d.originalName })}
                      >
                        <Download className="size-4" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12px] text-fg-subtle">{t("kycShared")}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("timelineTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4" data-timeline>
                {timeline.map((e, i) => (
                  <li key={e.id} className="flex gap-3">
                    {i === timeline.length - 1 ? (
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className="mt-0.5 size-4 shrink-0 text-fg-subtle"
                        aria-hidden="true"
                      />
                    )}
                    <div>
                      <p className="text-[14px] font-medium text-fg">
                        {t(`timeline.${e.toStatus}`)}
                      </p>
                      <p className="tabular text-[12px] text-fg-subtle">
                        {formatDateTime(e.occurredAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {consent ? (
            <Card>
              <CardContent className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-[13px] text-fg-muted">
                  {t("consentGiven", {
                    date: formatDate(consent.grantedAt),
                    version: consent.version,
                  })}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {cancellable ? (
            <CancelRequestButton action={cancelRequestAction} requestId={request.id} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

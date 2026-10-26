import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { can } from "@leaseplace/domain";
import { Card, CardContent, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { MandateActions, MandateCreateForm } from "@/components/billing/mandate-forms";
import { GridTable, MandateBadge } from "@/components/billing/views";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { gridOf, lessorMandates } from "@/lib/billing/data";
import { appDb } from "@/lib/db";
import { formatDate, formatDateTime, isoDay } from "@/lib/format";
import { actorFor, requireSpace } from "@/lib/viewer";
import { changeMandateAction, createMandateAction } from "../../billing-actions";

type Props = { params: Promise<{ locale: string; id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.lessors" });
  return { title: t("detailTitle"), robots: { index: false } };
}

/** Mandats d'un bailleur : versions, grille, clause, cycle de vie. */
export default async function AdminLessor({ params }: Props) {
  const { locale, id } = await params;
  if (!UUID.test(id)) notFound();
  const viewer = await requireSpace("admin", locale as Locale);
  const data = await withActor(appDb(), await actorFor(viewer), (tx) => lessorMandates(tx, id));
  if (!data) notFound();
  const t = await getTranslations("billing.lessors");
  const tm = await getTranslations("billing.mandate");
  const manage = can(viewer.membership.role, "mandate.manage");
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link
        href="/admin/bailleurs"
        className="inline-flex w-fit items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        {t("title")}
      </Link>
      <PageHeader title={data.org.name} description={t("detailDescription")} />
      {data.mandates.length === 0 ? (
        <p className="text-[14px] text-danger">{t("noMandateBody")}</p>
      ) : null}
      {data.mandates.map((m) => (
        <Card key={m.id} data-mandate={m.status}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {m.contractVersion || tm("untitled")}
              <MandateBadge status={m.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              {(
                [
                  [tm("signedOn"), m.signedOn ? formatDate(m.signedOn) : "—"],
                  [tm("activatedAt"), m.activatedAt ? formatDateTime(m.activatedAt) : "—"],
                  [tm("antiCircumvention"), tm("months", { n: m.antiCircumventionMonths })],
                  [tm("terminatedAt"), m.terminatedAt ? formatDateTime(m.terminatedAt) : "—"],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-fg-muted">{k}</dt>
                  <dd className="tabular font-medium text-fg">{v}</dd>
                </div>
              ))}
              {m.note ? <p className="col-span-2 text-fg-muted">{m.note}</p> : null}
            </dl>
            <div className="flex flex-col gap-3">
              <GridTable grid={gridOf(m)} />
              {manage ? (
                <MandateActions id={m.id} status={m.status} action={changeMandateAction} />
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
      {manage ? (
        <Card>
          <CardHeader>
            <CardTitle>{tm("newTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-[13px] text-fg-muted">{tm("newBody")}</p>
            <MandateCreateForm
              lessorId={data.org.id}
              today={isoDay()}
              action={createMandateAction}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

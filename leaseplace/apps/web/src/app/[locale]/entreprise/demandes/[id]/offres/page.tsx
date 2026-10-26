import { eq } from "drizzle-orm";
import { ArrowLeft, Inbox } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { schema } from "@leaseplace/db";
import { can, isOfferExpired, type PaymentTiming, type Periodicity } from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { OfferComparator, type ComparatorOffer } from "@/components/company/offer-comparator";
import { PageHeader } from "@/components/shell/shells";
import { Link } from "@/i18n/navigation";
import { getRequest } from "@/lib/company-data";
import { loadCompanyPage } from "@/lib/company-page";
import { dealOfRequest, requestOffers } from "@/lib/deals/data";
import { acceptOfferAction } from "../../../actions";

type Props = { params: Promise<{ locale: string; id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "company.offers" });
  return { title: t("title"), robots: { index: false } };
}

/** Comparateur : classement neutre par coût total, simulation, acceptation. */
export default async function OffersPage({ params }: Props) {
  const { locale, id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await loadCompanyPage(locale, async (tx) => {
    const request = await getRequest(tx, id);
    if (!request) return { request: null };
    const [offers, deal, threads] = await Promise.all([
      requestOffers(tx, id),
      dealOfRequest(tx, id),
      tx
        .select({ id: schema.threads.id, lessorId: schema.threads.lessorOrganizationId })
        .from(schema.threads)
        .where(eq(schema.threads.requestId, id)),
    ]);
    return { request, offers, deal, threads };
  });
  const { request, viewer } = data;
  if (!request || !("offers" in data)) notFound();
  const { offers, deal, threads } = data;
  const t = await getTranslations("company.offers");
  const now = new Date();
  const threadOf = new Map(threads.map((x) => [x.lessorId, x.id]));
  const rows: ComparatorOffer[] = offers.map((o) => ({
    id: o.id,
    lessorName: o.lessorName,
    threadId: threadOf.get(o.lessorOrganizationId) ?? null,
    status: o.status as ComparatorOffer["status"],
    expired: isOfferExpired(o.validUntil, now),
    financedAmountHt: o.financedAmountHt,
    durationMonths: o.durationMonths,
    periodicity: o.periodicity as Periodicity,
    timing: o.timing as PaymentTiming,
    annualRate: o.annualRate,
    firstRentHt: o.firstRentHt,
    rentHt: o.rentHt,
    residualValueHt: o.residualValueHt,
    fileFeesHt: o.fileFeesHt,
    insurancePerPeriodHt: o.insurancePerPeriodHt,
    insuranceRequired: o.insuranceRequired,
    vatRate: o.vatRate,
    financingCostHt: o.financingCostHt,
    paidTtc: o.paidTtc,
    effectiveRate: o.effectiveRate,
    validUntil: o.validUntil.toISOString(),
    conditions: o.conditions,
  }));
  const liveDeal = deal && deal.deal.status !== "cancelled" ? deal : null;

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/entreprise/demandes/${request.id}`}
        className="inline-flex w-fit items-center gap-1 text-[13px] text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        {t("back", { reference: request.reference })}
      </Link>
      <PageHeader title={t("title")} description={t("description", { count: rows.length })} />
      {liveDeal ? (
        <Alert tone="success" className="mb-2">
          {t("acceptedBanner", { lessor: liveDeal.lessorName })}{" "}
          <Link href={`/entreprise/demandes/${request.id}`} className="font-medium underline">
            {t("followDeal")}
          </Link>
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <OfferComparator
          offers={rows}
          requestedAmountHt={request.amountHt ?? 0}
          canAccept={can(viewer.membership.role, "offer.accept")}
          open={request.status === "routed"}
          accept={acceptOfferAction}
        />
      )}
      {!can(viewer.membership.role, "offer.accept") && rows.length > 0 ? (
        <p className="text-[13px] text-fg-muted">{t("ownerOnly")}</p>
      ) : null}
      <p className="mt-4 text-[12px] text-fg-subtle">{t("legal")}</p>
    </div>
  );
}

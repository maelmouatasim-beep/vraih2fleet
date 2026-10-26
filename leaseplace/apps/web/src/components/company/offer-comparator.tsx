"use client";

import { Award, Check, MessageCircle, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import {
  bestTotalCost,
  rankOffers,
  simulateOffer,
  type OfferSortKey,
  type PaymentTiming,
  type RankableOffer,
  type Periodicity,
} from "@leaseplace/domain";
import { Alert } from "@leaseplace/ui/alert";
import { Badge } from "@leaseplace/ui/badge";
import { Button } from "@leaseplace/ui/button";
import { cn } from "@leaseplace/ui/cn";
import { Input } from "@leaseplace/ui/input";
import { Label } from "@leaseplace/ui/label";
import { Segmented } from "@leaseplace/ui/segmented";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDate, formatMad, formatPercent, ltr, parseAmount } from "@/lib/format";
import type { AcceptResult } from "@/lib/deals/actions";

export interface ComparatorOffer {
  id: string;
  lessorName: string;
  threadId: string | null;
  status: "submitted" | "accepted" | "not_retained";
  expired: boolean;
  financedAmountHt: number;
  durationMonths: number;
  periodicity: Periodicity;
  timing: PaymentTiming;
  annualRate: number;
  firstRentHt: number;
  rentHt: number;
  residualValueHt: number;
  fileFeesHt: number;
  insurancePerPeriodHt: number;
  insuranceRequired: boolean;
  vatRate: number;
  financingCostHt: number;
  paidTtc: number;
  effectiveRate: number;
  validUntil: string;
  conditions: string;
}

type View = "cards" | "table";

/** Forme attendue par le classement neutre du domaine. */
function rankable(o: ComparatorOffer): ComparatorOffer & RankableOffer {
  return {
    ...o,
    terms: { rentHt: o.rentHt, firstRentHt: o.firstRentHt },
    normalized: {
      totals: { financingCostHt: o.financingCostHt } as RankableOffer["normalized"]["totals"],
      rates: { annualEffectiveRate: o.effectiveRate } as RankableOffer["normalized"]["rates"],
    },
  };
}

const SIMULATED_DURATIONS = [24, 36, 48, 60, 72, 84] as const;

export function OfferComparator({
  offers,
  requestedAmountHt,
  canAccept,
  open,
  accept,
}: {
  offers: readonly ComparatorOffer[];
  requestedAmountHt: number;
  /** Le dirigeant peut accepter (rôle) et la demande attend encore un choix. */
  canAccept: boolean;
  open: boolean;
  accept: (offerId: string) => Promise<AcceptResult>;
}) {
  const t = useTranslations("company.offers");
  const tl = useTranslations("company.labels");
  const [sort, setSort] = useState<OfferSortKey>("totalCost");
  const [view, setView] = useState<View>("cards");
  const comparable = offers.filter((o) => !o.expired && o.status !== "not_retained");
  const best = bestTotalCost(comparable.map(rankable));
  const ranked = rankOffers(offers.map(rankable), sort);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-md">
          <Segmented
            label={t("sortLabel")}
            value={sort}
            onChange={setSort}
            options={[
              { value: "totalCost", label: t("sort.totalCost") },
              { value: "effectiveRate", label: t("sort.effectiveRate") },
              { value: "rent", label: t("sort.rent") },
              { value: "firstRent", label: t("sort.firstRent") },
            ]}
          />
        </div>
        <div className="w-48">
          <Segmented
            label={t("viewLabel")}
            value={view}
            onChange={setView}
            options={[
              { value: "cards", label: t("views.cards") },
              { value: "table", label: t("views.table") },
            ]}
          />
        </div>
      </div>
      <p className="text-[12px] text-fg-subtle">{t("neutral")}</p>

      {view === "cards" ? (
        <ul className="grid gap-4 lg:grid-cols-2" aria-label={t("listLabel")}>
          {ranked.map((o, i) => (
            <li key={o.id}>
              <OfferCard
                offer={o}
                rank={i + 1}
                best={best?.id === o.id}
                acceptable={canAccept && open && o.status === "submitted" && !o.expired}
                accept={accept}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[760px] text-[13px]" data-offer-table>
            <caption className="sr-only">{t("tableCaption")}</caption>
            <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-medium">
                  {t("columns.lessor")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.cost")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.rate")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.rent")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.firstRent")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.duration")}
                </th>
                <th scope="col" className="px-3 py-2 text-end font-medium">
                  {t("columns.validUntil")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranked.map((o) => (
                <tr
                  key={o.id}
                  data-offer-row={o.lessorName}
                  className={o.expired ? "text-fg-subtle" : ""}
                >
                  <th scope="row" className="px-3 py-2.5 text-start font-medium text-fg">
                    {o.lessorName}
                    {best?.id === o.id ? (
                      <Badge tone="success" className="ms-2">
                        {t("best")}
                      </Badge>
                    ) : null}
                  </th>
                  <td className="tabular px-3 py-2.5 text-end font-semibold">
                    {ltr(formatMad(o.financingCostHt, 0))}
                  </td>
                  <td className="tabular px-3 py-2.5 text-end">
                    {ltr(formatPercent(o.effectiveRate, 2))}
                  </td>
                  <td className="tabular px-3 py-2.5 text-end">{ltr(formatMad(o.rentHt, 2))}</td>
                  <td className="tabular px-3 py-2.5 text-end">
                    {ltr(formatMad(o.firstRentHt, 0))}
                  </td>
                  <td className="tabular px-3 py-2.5 text-end">
                    {t("months", { n: o.durationMonths })} · {tl(`periodicities.${o.periodicity}`)}
                  </td>
                  <td className="tabular px-3 py-2.5 text-end">
                    {o.expired ? t("expired") : formatDate(new Date(o.validUntil))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Simulation offers={comparable} requestedAmountHt={requestedAmountHt} />
    </div>
  );
}

function OfferCard({
  offer: o,
  rank,
  best,
  acceptable,
  accept,
}: {
  offer: ComparatorOffer;
  rank: number;
  best: boolean;
  acceptable: boolean;
  accept: (offerId: string) => Promise<AcceptResult>;
}) {
  const t = useTranslations("company.offers");
  const tl = useTranslations("company.labels");
  const id = useId();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [result, setResult] = useState<AcceptResult | null>(null);
  const [pending, start] = useTransition();
  const days = Math.ceil((new Date(o.validUntil).getTime() - Date.now()) / 86_400_000);

  return (
    <article
      className={cn(
        "flex h-full flex-col gap-4 rounded-lg border bg-surface p-5 shadow-sm",
        best ? "border-primary" : "border-border",
        (o.expired || o.status === "not_retained") && "opacity-70",
      )}
      aria-labelledby={`${id}-name`}
      data-offer={o.lessorName}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] text-fg-subtle">{t("rank", { n: rank })}</p>
          <h3 id={`${id}-name`} className="text-[16px] font-semibold text-fg">
            {o.lessorName}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {best ? (
            <Badge tone="success">
              <Award className="size-3" aria-hidden="true" />
              {t("best")}
            </Badge>
          ) : null}
          {o.status === "accepted" ? <Badge tone="primary">{t("statuses.accepted")}</Badge> : null}
          {o.status === "not_retained" ? (
            <Badge tone="neutral">{t("statuses.not_retained")}</Badge>
          ) : null}
          {o.expired ? <Badge tone="danger">{t("expired")}</Badge> : null}
        </div>
      </header>

      <div>
        <p className="text-[12px] font-medium text-fg-muted">{t("cost")}</p>
        <p className="tabular font-display text-[28px] leading-tight font-medium text-fg" data-cost>
          {ltr(formatMad(o.financingCostHt, 0))}
        </p>
        <p className="text-[12px] text-fg-subtle">{t("costHint")}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        {(
          [
            [
              t("rent", { periodicity: tl(`periodicities.${o.periodicity}`) }),
              ltr(formatMad(o.rentHt, 2)),
            ],
            [t("rate"), ltr(formatPercent(o.effectiveRate, 2))],
            [t("firstRent"), ltr(formatMad(o.firstRentHt, 0))],
            [t("duration"), t("months", { n: o.durationMonths })],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className="text-fg-muted">{k}</dt>
            <dd className="tabular font-semibold text-fg">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="text-[12px] text-fg-muted">
        {o.expired
          ? t("expiredOn", { date: formatDate(new Date(o.validUntil)) })
          : t("validUntil", { date: formatDate(new Date(o.validUntil)), days: Math.max(days, 0) })}
      </p>

      <details className="rounded-md border border-border">
        <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-fg-muted">
          {t("details")}
        </summary>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border p-3 text-[12px]">
          {(
            [
              [t("financed"), ltr(formatMad(o.financedAmountHt, 0))],
              [t("residual"), ltr(formatMad(o.residualValueHt, 0))],
              [t("fees"), ltr(formatMad(o.fileFeesHt, 0))],
              [
                t("insurance"),
                o.insurancePerPeriodHt > 0
                  ? `${ltr(formatMad(o.insurancePerPeriodHt, 2))}${o.insuranceRequired ? ` · ${t("required")}` : ""}`
                  : "—",
              ],
              [t("timing"), t(`timings.${o.timing}`)],
              [t("nominalRate"), ltr(formatPercent(o.annualRate, 2))],
              [t("paidTtc"), ltr(formatMad(o.paidTtc, 0))],
              [t("vat"), ltr(formatPercent(o.vatRate, 0))],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-fg-muted">{k}</dt>
              <dd className="tabular font-medium text-fg">{v}</dd>
            </div>
          ))}
          {o.conditions ? (
            <div className="col-span-2">
              <dt className="text-fg-muted">{t("conditions")}</dt>
              <dd className="whitespace-pre-line text-fg">{o.conditions}</dd>
            </div>
          ) : null}
        </dl>
        <p className="border-t border-border px-3 py-2 text-[11px] text-fg-subtle">
          {t("vatReminder")}
        </p>
      </details>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {acceptable && !confirming ? (
          <Button
            onClick={() => {
              setConfirming(true);
            }}
          >
            <Check aria-hidden="true" />
            {t("accept")}
          </Button>
        ) : null}
        {o.threadId ? (
          <Link
            href={`/entreprise/messages/${o.threadId}`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-fg-muted hover:text-fg"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("ask")}
          </Link>
        ) : null}
      </div>

      {confirming ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary-soft/40 p-4"
          data-accept-confirm
        >
          <p className="text-[14px] font-medium text-fg">
            {t("confirmTitle", { lessor: o.lessorName })}
          </p>
          <p className="text-[13px] text-fg-muted">{t("confirmBody")}</p>
          <label className="flex items-start gap-2 text-[13px] text-fg">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--lp-primary)]"
              checked={understood}
              onChange={(e) => {
                setUnderstood(e.target.checked);
              }}
            />
            {t("confirmCheckbox")}
          </label>
          {result?.status === "invalid" ? (
            <Alert tone="danger" role="alert">
              {result.issues.map((i) => t(`issues.${i}`)).join(" ")}
            </Alert>
          ) : null}
          {result?.status === "forbidden" ? (
            <Alert tone="danger" role="alert">
              {t("forbidden")}
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!understood || pending}
              onClick={() => {
                start(async () => {
                  const r = await accept(o.id);
                  setResult(r);
                  if (r.status === "accepted") router.refresh();
                });
              }}
            >
              {pending ? t("accepting") : t("confirm")}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t("keep")}
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/** Effet d'un autre apport ou d'une autre durée, au taux de chaque offre (estimation). */
function Simulation({
  offers,
  requestedAmountHt,
}: {
  offers: readonly ComparatorOffer[];
  requestedAmountHt: number;
}) {
  const t = useTranslations("company.offers.simulation");
  const id = useId();
  const [down, setDown] = useState("");
  const [duration, setDuration] = useState("");
  if (offers.length === 0) return null;
  const downValue = down.trim() === "" ? undefined : (parseAmount(down) ?? Number.NaN);
  const durationValue = duration === "" ? undefined : Number(duration);
  const now = new Date();
  const rows = offers.map((o) => ({
    offer: o,
    result:
      downValue !== undefined && Number.isNaN(downValue)
        ? null
        : simulateOffer(
            {
              financedAmountHt: o.financedAmountHt,
              durationMonths: o.durationMonths,
              periodicity: o.periodicity,
              timing: o.timing,
              annualRate: o.annualRate,
              firstRentHt: o.firstRentHt,
              residualValueHt: o.residualValueHt,
              fileFeesHt: o.fileFeesHt,
              insurancePerPeriodHt: o.insurancePerPeriodHt,
              insuranceRequired: o.insuranceRequired,
              validUntil: new Date(o.validUntil),
              conditions: "",
            },
            { firstRentHt: downValue, durationMonths: durationValue },
            requestedAmountHt,
            now,
          ),
  }));
  const active = downValue !== undefined || durationValue !== undefined;

  return (
    <section
      className="rounded-lg border border-border bg-surface p-5"
      aria-labelledby={`${id}-title`}
      data-simulation
    >
      <h2 id={`${id}-title`} className="flex items-center gap-2 text-[15px] font-semibold text-fg">
        <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
        {t("title")}
      </h2>
      <p className="mt-1 text-[13px] text-fg-muted">{t("body")}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-down`}>{t("down")}</Label>
          <Input
            id={`${id}-down`}
            inputMode="decimal"
            dir="ltr"
            className="tabular text-end"
            placeholder={t("downPlaceholder")}
            value={down}
            onChange={(e) => {
              setDown(e.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-duration`}>{t("duration")}</Label>
          <select
            id={`${id}-duration`}
            className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg"
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
            }}
          >
            <option value="">{t("sameDuration")}</option>
            {SIMULATED_DURATIONS.map((m) => (
              <option key={m} value={m}>
                {t("months", { n: m })}
              </option>
            ))}
          </select>
        </div>
      </div>
      {active ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]" data-simulation-table>
            <caption className="sr-only">{t("caption")}</caption>
            <thead className="text-fg-muted">
              <tr>
                <th scope="col" className="py-1.5 text-start font-medium">
                  {t("lessor")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("rent")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("cost")}
                </th>
                <th scope="col" className="py-1.5 text-end font-medium">
                  {t("rate")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ offer, result }) => (
                <tr key={offer.id}>
                  <th scope="row" className="py-2 text-start font-medium text-fg">
                    {offer.lessorName}
                  </th>
                  {result ? (
                    <>
                      <td className="tabular py-2 text-end">{ltr(formatMad(result.rentHt, 2))}</td>
                      <td className="tabular py-2 text-end font-semibold">
                        {ltr(formatMad(result.normalized.totals.financingCostHt, 0))}
                      </td>
                      <td className="tabular py-2 text-end">
                        {ltr(formatPercent(result.normalized.rates.annualEffectiveRate, 2))}
                      </td>
                    </>
                  ) : (
                    <td colSpan={3} className="py-2 text-end text-fg-subtle">
                      {t("impossible")}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-fg-subtle">{t("disclaimer")}</p>
        </div>
      ) : null}
    </section>
  );
}

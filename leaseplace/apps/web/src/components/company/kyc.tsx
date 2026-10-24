import { AlertTriangle, CheckCircle2, CircleDashed, Download, FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@leaseplace/ui/badge";
import { Card } from "@leaseplace/ui/card";
import { cn } from "@leaseplace/ui/cn";
import { TableScroll } from "@leaseplace/ui/table-scroll";
import type { Completeness } from "@leaseplace/domain";
import { deleteDocumentAction, uploadDocumentAction } from "@/app/[locale]/entreprise/actions";
import type { DocumentRow } from "@/lib/company-data";
import { env } from "@/lib/env";
import { formatDate, formatNumber, formatPercent, ltr } from "@/lib/format";
import { signDocumentUrl, signingKey } from "@/lib/signed-url";
import { DeleteDocumentButton } from "./document-actions";
import { UploadForm } from "./upload-form";

/** Barre de complétude du dossier KYC. */
export async function KycProgress({ completeness }: { completeness: Completeness }) {
  const t = await getTranslations("company.vault");
  const pct = Math.round(completeness.ratio * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-fg">
          {completeness.complete ? t("complete") : t("progress")}
        </span>
        <span className="tabular text-fg-muted">{ltr(formatPercent(completeness.ratio, 0))}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("progress")}
      >
        <div
          className={cn("h-full rounded-full", completeness.complete ? "bg-success" : "bg-primary")}
          style={{ width: `${String(pct)}%` }}
        />
      </div>
    </div>
  );
}

const STATE_ICON = { ok: CheckCircle2, stale: AlertTriangle, missing: CircleDashed } as const;
const STATE_TONE = { ok: "success", stale: "warning", missing: "neutral" } as const;

/** Liste des pièces exigées, avec dépôt direct pour chacune. */
export async function KycChecklist({ completeness }: { completeness: Completeness }) {
  const t = await getTranslations("company.vault");
  const tl = await getTranslations("company.labels");
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
      {completeness.items.map(({ type, state }) => {
        const Icon = STATE_ICON[state];
        return (
          <li key={type} className="px-4 py-3" data-requirement={type} data-state={state}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    state === "ok"
                      ? "text-success"
                      : state === "stale"
                        ? "text-warning"
                        : "text-fg-subtle",
                  )}
                  aria-hidden="true"
                />
                <span className="flex-1 text-[14px] text-fg">{tl(`documentTypes.${type}`)}</span>
                <Badge tone={STATE_TONE[state]}>{t(`states.${state}`)}</Badge>
                <span className="text-[13px] font-medium text-primary group-open:hidden">
                  {state === "ok" ? t("replace") : t("add")}
                </span>
              </summary>
              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-3 text-[13px] text-fg-muted">{tl(`documentHints.${type}`)}</p>
                <UploadForm action={uploadDocumentAction} type={type} />
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** Documents déposés : téléchargement par lien signé (5 min), suppression. */
export async function DocumentTable({
  documents,
  userId,
}: {
  documents: readonly DocumentRow[];
  userId: string;
}) {
  const t = await getTranslations("company.vault");
  const tl = await getTranslations("company.labels");
  if (documents.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-sm text-fg-muted">
        {t("empty")}
      </p>
    );
  const key = signingKey(env().BETTER_AUTH_SECRET);
  return (
    <Card className="overflow-hidden">
      <TableScroll label={t("documentsTitle")}>
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="border-b border-border bg-surface-muted/60 text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("columns.document")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("columns.type")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">
                {t("columns.issued")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-medium">
                {t("columns.added")}
              </th>
              <th scope="col" className="px-4 py-2.5 text-start font-medium">
                {t("columns.status")}
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">{t("columns.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.map((d) => (
              <tr key={d.id} data-document={d.originalName}>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block max-w-56 truncate font-medium text-fg">
                        {d.originalName}
                      </span>
                      <span className="tabular text-[11px] text-fg-subtle">
                        {d.sizeBytes >= 1024 * 1024
                          ? t("sizeMb", { n: formatNumber(d.sizeBytes / 1024 / 1024, 1) })
                          : t("sizeKb", {
                              n: formatNumber(Math.max(1, Math.round(d.sizeBytes / 1024))),
                            })}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-fg-muted">{tl(`documentTypes.${d.type}`)}</td>
                <td className="tabular px-4 py-2.5 text-end whitespace-nowrap text-fg-muted">
                  {d.issuedOn ? formatDate(d.issuedOn) : "—"}
                </td>
                <td className="tabular px-4 py-2.5 text-end whitespace-nowrap text-fg-muted">
                  {formatDate(d.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={d.status === "clean" ? "success" : "danger"}>
                    {t(`documentStatus.${d.status}`)}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center justify-end gap-1">
                    {d.status === "clean" ? (
                      <a
                        href={signDocumentUrl(key, d.id, userId)}
                        className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
                        aria-label={t("downloadLabel", { name: d.originalName })}
                      >
                        <Download className="size-4" aria-hidden="true" />
                      </a>
                    ) : null}
                    <DeleteDocumentButton
                      action={deleteDocumentAction}
                      documentId={d.id}
                      name={d.originalName}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </Card>
  );
}

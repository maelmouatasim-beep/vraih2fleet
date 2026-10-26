import { getTranslations } from "next-intl/server";
import { cn } from "@leaseplace/ui/cn";
import type { MessageRow } from "@/lib/messaging/data";
import { formatDateTime } from "@/lib/format";

/** Fil de messages : les siens à droite (à gauche en arabe), l'autre partie en face. */
export async function ThreadMessages({
  messages,
  myOrganizationId,
  names,
}: {
  messages: readonly MessageRow[];
  myOrganizationId: string;
  /** Nom affiché par organisation (entreprise, bailleur). */
  names: Readonly<Record<string, string>>;
}) {
  const t = await getTranslations("messages");
  if (messages.length === 0) return <p className="text-[13px] text-fg-muted">{t("empty")}</p>;
  return (
    <ol className="flex flex-col gap-3" aria-label={t("listLabel")} data-thread>
      {messages.map((m) => {
        const mine = m.authorOrganizationId === myOrganizationId;
        return (
          <li
            key={m.id}
            className={cn("flex flex-col", mine ? "items-end" : "items-start")}
            data-message={mine ? "mine" : "theirs"}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line",
                mine ? "bg-primary text-primary-fg" : "border border-border bg-surface text-fg",
              )}
            >
              {m.body}
            </div>
            <p className="mt-1 text-[11px] text-fg-subtle">
              {mine ? t("you") : (names[m.authorOrganizationId] ?? "—")} ·{" "}
              {formatDateTime(m.createdAt)}
              {m.contactFlags.length > 0 ? (
                <span className="ms-1.5 text-warning">· {t("flagged")}</span>
              ) : null}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

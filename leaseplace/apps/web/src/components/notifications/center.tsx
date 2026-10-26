import { BellOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@leaseplace/ui/cn";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { brand } from "@/lib/brand";
import { formatDateTime } from "@/lib/format";
import type { NotificationItem } from "@/lib/notifications/data";
import { markAllReadAction, openNotificationAction } from "@/app/[locale]/notification-actions";

/** Liste des notifications : un clic ouvre l'écran concerné et la marque lue. */
export async function NotificationList({ items }: { items: readonly NotificationItem[] }) {
  const t = await getTranslations("notifications");
  if (items.length === 0)
    return <EmptyState icon={<BellOff />} title={t("emptyTitle")} description={t("emptyBody")} />;
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="flex flex-col gap-3">
      {unread ? (
        <form action={markAllReadAction} className="self-end">
          <button type="submit" className="text-[13px] font-medium text-primary hover:underline">
            {t("markAll")}
          </button>
        </form>
      ) : null}
      <ul
        className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
        data-notifications
      >
        {items.map((n) => (
          <li key={n.id}>
            <form action={openNotificationAction.bind(null, n.id)}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-surface-muted/60",
                  !n.readAt && "bg-primary-soft/30",
                )}
                data-notification={n.kind}
                data-unread={!n.readAt}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.readAt ? "bg-transparent" : "bg-primary",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-fg">
                    {t(`kinds.${n.kind}.title`, { ...n.params, brand: brand.name, url: "" })}
                  </span>
                  <span className="block text-[13px] text-fg-muted">
                    {t(`kinds.${n.kind}.body`, { ...n.params, brand: brand.name, url: "" })}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[12px] text-fg-subtle">
                  {formatDateTime(n.createdAt)}
                  {!n.readAt ? <span className="sr-only"> — {t("unreadLabel")}</span> : null}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

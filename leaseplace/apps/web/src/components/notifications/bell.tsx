import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { withActor } from "@leaseplace/db";
import { Link } from "@/i18n/navigation";
import { appDb } from "@/lib/db";
import { unreadNotificationCount } from "@/lib/notifications/data";
import { actorFor, type SpaceViewer } from "@/lib/viewer";

/** Cloche : notifications non lues, lien vers la page de l'espace. */
export async function NotificationBell({ viewer, href }: { viewer: SpaceViewer; href: string }) {
  const t = await getTranslations("notifications");
  const count = await withActor(appDb(), await actorFor(viewer), (tx) =>
    unreadNotificationCount(tx, viewer.user.id),
  );
  return (
    <Link
      href={href}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
      aria-label={count > 0 ? t("bellUnread", { count }) : t("bell")}
      data-bell={count}
    >
      <Bell className="size-4" aria-hidden="true" />
      {count > 0 ? (
        <span
          className="tabular absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-fg"
          aria-hidden="true"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

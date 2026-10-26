import { ShieldAlert } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { endSupportAccessAction } from "@/app/[locale]/support-actions";
import type { Locale } from "@/i18n/routing";
import { formatDateTime } from "@/lib/format";
import type { SpaceViewer } from "@/lib/viewer";

/** Bandeau permanent pendant un accès support : qui, sur quel compte, jusqu'à quand. */
export async function SupportBanner({ viewer }: { viewer: SpaceViewer }) {
  const access = viewer.impersonation;
  if (!access) return null;
  const t = await getTranslations("support");
  const locale = (await getLocale()) as Locale;
  return (
    <div
      role="status"
      data-support-banner
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warning/40 bg-warning-soft px-4 py-2 text-[13px] text-fg"
    >
      <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>
        {t("banner", {
          agent: access.actorName,
          name: viewer.user.name,
          organization: viewer.membership.organizationName,
          until: formatDateTime(access.expiresAt),
        })}
      </span>
      <form action={endSupportAccessAction.bind(null, locale)}>
        <button
          type="submit"
          className="rounded-md border border-border-strong bg-surface px-2.5 py-1 text-[12px] font-medium hover:bg-surface-muted"
        >
          {t("end")}
        </button>
      </form>
    </div>
  );
}

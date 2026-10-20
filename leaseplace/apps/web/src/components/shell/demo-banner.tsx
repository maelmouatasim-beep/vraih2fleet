import { FlaskConical } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function DemoBanner() {
  const t = await getTranslations("demo");
  return (
    <div className="flex items-center justify-center gap-2 border-b border-accent/30 bg-accent-soft px-4 py-1.5 text-xs text-accent-strong">
      <FlaskConical className="size-3.5" aria-hidden="true" />
      <span>{t("banner")}</span>
      <Link href="/demo" className="font-medium underline underline-offset-2">
        {t("bannerLink")}
      </Link>
    </div>
  );
}

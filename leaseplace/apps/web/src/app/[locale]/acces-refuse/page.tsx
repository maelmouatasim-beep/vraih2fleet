import { ShieldX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Link } from "@/i18n/navigation";
import { getViewer, homePathOf } from "@/lib/viewer";

export default async function AccessDenied() {
  const t = await getTranslations("errors");
  const viewer = await getViewer();
  const home = viewer ? homePathOf(viewer) : "/connexion";
  return (
    <main className="flex min-h-[80dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg bg-danger-soft text-danger">
        <ShieldX className="size-5" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold">{t("forbiddenTitle")}</h1>
      <p className="max-w-sm text-sm text-fg-muted">{t("forbiddenBody")}</p>
      {home !== "/acces-refuse" ? (
        <Button asChild variant="secondary" className="mt-2">
          <Link href={home}>{t("backToSpace")}</Link>
        </Button>
      ) : null}
    </main>
  );
}

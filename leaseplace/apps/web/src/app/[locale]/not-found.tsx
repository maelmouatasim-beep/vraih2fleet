import { getTranslations } from "next-intl/server";
import { Button } from "@leaseplace/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-mono text-sm text-fg-subtle">404</p>
      <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="max-w-sm text-sm text-fg-muted">{t("notFoundBody")}</p>
      <Button asChild variant="secondary" className="mt-2">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </main>
  );
}

import { FileStack, FolderLock, Handshake, Lock, Scale, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@leaseplace/ui/badge";
import { Button } from "@leaseplace/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@leaseplace/ui/card";
import { EmptyState } from "@leaseplace/ui/empty-state";
import { PageHeader } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { requireSpace } from "@/lib/viewer";

const STEPS = [
  { key: "profile", icon: Sparkles },
  { key: "vault", icon: FolderLock },
  { key: "request", icon: FileStack },
  { key: "compare", icon: Scale },
] as const;

export default async function CompanyHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await requireSpace("company", locale as Locale);
  const t = await getTranslations("spaces.company");
  const firstName = viewer.user.name.split(" ")[0] ?? viewer.user.name;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("greeting", { name: firstName })}
        description={viewer.membership.organizationName}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("journeyTitle")}</CardTitle>
          <CardDescription>{t("journeyBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ key, icon: Icon }, i) => (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted/60 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-7 items-center justify-center rounded-md bg-surface text-fg-muted shadow-sm [&_svg]:size-4">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="tabular font-mono text-[11px] text-fg-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-fg">{t(`steps.${key}.title`)}</p>
                <p className="text-[12px] leading-relaxed text-fg-muted">
                  {t(`steps.${key}.body`)}
                </p>
                <Badge className="mt-auto self-start">{t("comingSoon")}</Badge>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <EmptyState
        icon={<Handshake />}
        title={t("emptyTitle")}
        description={t("emptyBody")}
        action={
          <Button disabled aria-describedby="nouvelle-demande-aide">
            {t("newRequest")}
          </Button>
        }
      />
      <p id="nouvelle-demande-aide" className="-mt-4 text-center text-xs text-fg-subtle">
        {t("newRequestHint")}
      </p>

      <Card className="bg-primary-soft/40">
        <CardContent className="flex gap-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-[13px] font-medium text-fg">{t("privacyTitle")}</p>
            <p className="mt-0.5 text-[13px] text-fg-muted">{t("privacyBody")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

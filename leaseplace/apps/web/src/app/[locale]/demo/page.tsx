import { ArrowRight, KeyRound, Mail } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge } from "@leaseplace/ui/badge";
import { Button } from "@leaseplace/ui/button";
import { Card } from "@leaseplace/ui/card";
import { Logo } from "@/components/brand/logo";
import { TotpCountdown } from "@/components/demo/auto-refresh";
import { Link } from "@/i18n/navigation";
import { DEMO_ACCOUNTS, DEMO_ORGANIZATIONS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { isDemoMode } from "@/lib/demo";
import { currentTotp, secondsLeftInPeriod } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("demo");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function DemoAccounts() {
  if (!isDemoMode()) notFound();
  const t = await getTranslations("demo");
  const tRoles = await getTranslations("roles");
  const now = Date.now();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-fg-muted">{t("intro")}</p>
      <div className="mt-6 flex flex-col gap-3">
        {DEMO_ACCOUNTS.map((a) => {
          const org = DEMO_ORGANIZATIONS.find((o) => o.key === a.organization);
          return (
            <Card
              key={a.key}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
              data-demo-account={a.key}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-fg">{a.name}</span>
                  <Badge tone={a.password ? "accent" : "primary"}>{tRoles(a.role)}</Badge>
                </div>
                <p className="mt-0.5 truncate text-[13px] text-fg-muted">{org?.name}</p>
                <p className="mt-1 font-mono text-[12px] text-fg" dir="ltr" data-field="email">
                  {a.email}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1 text-[12px] sm:items-end">
                {a.password ? (
                  <>
                    <span className="font-mono text-fg-muted" dir="ltr">
                      {t("password")} <span className="text-fg">{DEMO_PASSWORD}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-fg-muted">
                      <KeyRound className="size-3.5" aria-hidden="true" />
                      {t("totp")}
                      <span
                        className="tabular font-mono text-[14px] font-semibold tracking-widest text-fg"
                        data-field="totp"
                        dir="ltr"
                      >
                        {a.totpSecret ? currentTotp(a.totpSecret, now) : ""}
                      </span>
                      <TotpCountdown seconds={secondsLeftInPeriod(now)} />
                    </span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-fg-muted">
                    <Mail className="size-3.5" aria-hidden="true" />
                    {t("passwordless")}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/connexion">
            {t("goSignIn")}
            <ArrowRight className="rtl:rotate-180" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/demo/boite-mail">{t("outboxTitle")}</Link>
        </Button>
      </div>
      <p className="mt-8 text-xs text-fg-subtle">{t("warning")}</p>
    </main>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/company/onboarding-form";
import { LegalNotice } from "@/components/legal-notice";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getViewer, homePathOf } from "@/lib/viewer";
import { createCompanyAction } from "./actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "company.onboarding" });
  return { title: t("title"), robots: { index: false } };
}

/** Onboarding PME : première connexion d'un compte sans entreprise. */
export default async function Welcome({ params }: Props) {
  const { locale } = await params;
  const viewer = await getViewer();
  if (!viewer) return redirect({ href: "/connexion", locale: locale as Locale });
  if (viewer.membership) return redirect({ href: homePathOf(viewer), locale: locale as Locale });
  const t = await getTranslations("company.onboarding");
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-2xl items-center px-5">
        <Logo />
      </header>
      <main className="mx-auto max-w-2xl px-5 pt-6 pb-16">
        <p className="text-[13px] font-medium text-accent-strong">{t("eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t("title")}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t("subtitle")}</p>
        <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <OnboardingForm action={createCompanyAction} defaultName={viewer.user.name} />
        </div>
        <LegalNotice className="mt-8" />
      </main>
    </div>
  );
}

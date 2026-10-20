import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getViewer, homePathOf } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "twoFactor" });
  return { title: t("title") };
}

/** Enrôlement imposé aux bailleurs et à l'équipe plateforme avant tout accès. */
export default async function TwoFactorPage({ params }: Props) {
  const { locale } = await params;
  const viewer = await getViewer();
  if (!viewer) return redirect({ href: "/connexion", locale: locale as Locale });
  if (viewer.user.twoFactorEnabled)
    return redirect({ href: homePathOf(viewer), locale: locale as Locale });
  const t = await getTranslations("twoFactor");
  return (
    <AuthLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("title")}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t("subtitle")}</p>
        </div>
        <TwoFactorSetup />
      </div>
    </AuthLayout>
  );
}

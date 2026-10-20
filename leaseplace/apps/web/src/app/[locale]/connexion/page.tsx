import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/sign-in-form";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isDemoMode } from "@/lib/demo";
import { safeNext } from "@/lib/safe-next";
import { getViewer, homePathOf } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ suite?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("title") };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { suite } = await searchParams;
  const viewer = await getViewer();
  if (viewer) redirect({ href: homePathOf(viewer), locale: locale as Locale });
  return (
    <AuthLayout>
      <SignInForm next={safeNext(suite)} demo={isDemoMode()} />
    </AuthLayout>
  );
}

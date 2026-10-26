import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationsPage } from "@/components/notifications/page-body";
import type { Locale } from "@/i18n/routing";
import { requireSpace } from "@/lib/viewer";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notifications" });
  return { title: t("title"), robots: { index: false } };
}

export default async function Notifications({ params }: Props) {
  const { locale } = await params;
  const viewer = await requireSpace("lessor", locale as Locale);
  return <NotificationsPage viewer={viewer} />;
}

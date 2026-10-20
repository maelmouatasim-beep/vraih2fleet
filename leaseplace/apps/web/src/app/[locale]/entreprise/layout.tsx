import type { ReactNode } from "react";
import { GuidedShell } from "@/components/shell/shells";
import type { Locale } from "@/i18n/routing";
import { requireSpace } from "@/lib/viewer";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await requireSpace("company", locale as Locale);
  return <GuidedShell viewer={viewer}>{children}</GuidedShell>;
}

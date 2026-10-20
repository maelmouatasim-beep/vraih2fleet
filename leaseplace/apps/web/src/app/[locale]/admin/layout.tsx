import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/shell/shells";
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
  const viewer = await requireSpace("admin", locale as Locale);
  return (
    <WorkspaceShell space="admin" viewer={viewer}>
      {children}
    </WorkspaceShell>
  );
}

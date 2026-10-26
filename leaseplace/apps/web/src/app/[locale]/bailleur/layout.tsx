import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/shell/shells";
import { SpaceMessages } from "@/i18n/space-messages";
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
  const viewer = await requireSpace("lessor", locale as Locale);
  return (
    <SpaceMessages space="lessor">
      <WorkspaceShell space="lessor" viewer={viewer}>
        {children}
      </WorkspaceShell>
    </SpaceMessages>
  );
}

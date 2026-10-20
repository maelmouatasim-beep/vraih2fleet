import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Space } from "@leaseplace/domain";
import { Logo } from "@/components/brand/logo";
import { LegalNotice } from "@/components/legal-notice";
import { Link } from "@/i18n/navigation";
import type { SpaceViewer } from "@/lib/viewer";
import { CommandPalette } from "./command-palette";
import { LocaleSwitcher } from "./locale-switcher";
import { SidebarNav, TopNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

async function Account({ viewer }: { viewer: SpaceViewer }) {
  const t = await getTranslations("roles");
  return (
    <UserMenu
      name={viewer.user.name}
      email={viewer.user.email}
      organization={viewer.membership.organizationName}
      roleLabel={t(viewer.membership.role)}
      twoFactor={viewer.user.twoFactorEnabled}
    />
  );
}

/** Espaces outils (bailleur, back-office) : denses, barre latérale, ⌘K. */
export async function WorkspaceShell({
  space,
  viewer,
  children,
}: {
  space: Extract<Space, "lessor" | "admin">;
  viewer: SpaceViewer;
  children: ReactNode;
}) {
  const t = await getTranslations("spaces");
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-border bg-surface md:flex">
        <div className="flex h-14 items-center px-4">
          <Link href={space === "lessor" ? "/bailleur" : "/admin"} aria-label={t(`${space}.name`)}>
            <Logo subtle />
          </Link>
        </div>
        <div className="px-3 pb-2">
          <p className="truncate px-2 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
            {t(`${space}.name`)}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <SidebarNav space={space} />
        </div>
        <div className="border-t border-border p-3">
          <p className="truncate px-2 text-[12px] font-medium text-fg">
            {viewer.membership.organizationName}
          </p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur md:px-6">
          <div className="md:hidden">
            <Logo subtle />
          </div>
          <div className="hidden flex-1 md:block">
            <CommandPalette space={space} />
          </div>
          <div className="ms-auto flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <Account viewer={viewer} />
          </div>
        </header>
        <div className="border-b border-border bg-surface px-4 md:hidden">
          <TopNav space={space} />
        </div>
        <main id="contenu" className="flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Espace entreprise : guidé, aéré, rassurant ; pensé d'abord pour mobile. */
export function GuidedShell({ viewer, children }: { viewer: SpaceViewer; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/entreprise">
            <Logo />
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <Account viewer={viewer} />
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4">
          <TopNav space="company" />
        </div>
      </header>
      <main id="contenu" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8">
        <LegalNotice />
      </footer>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <p className="text-[12px] font-medium text-fg-muted">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-fg">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

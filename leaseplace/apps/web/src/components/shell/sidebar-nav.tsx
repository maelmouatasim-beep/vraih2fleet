"use client";

import { useTranslations } from "next-intl";
import type { Space } from "@leaseplace/domain";
import { cn } from "@leaseplace/ui/cn";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV } from "./nav";

export function SidebarNav({ space }: { space: Space }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-0.5">
      {NAV[space].map(({ key, icon: Icon, href, phase }) => {
        const label = t(`${space}.${key}`);
        if (!href) {
          return (
            <span
              key={key}
              aria-disabled="true"
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-fg-subtle"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{label}</span>
              <span className="rounded-sm bg-surface-sunken px-1 font-mono text-[10px] text-fg-subtle">
                {t("phase", { n: phase ?? 0 })}
              </span>
            </span>
          );
        }
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg",
              active &&
                "bg-surface-muted text-fg shadow-[inset_2px_0_0_var(--lp-primary)] rtl:shadow-[inset_-2px_0_0_var(--lp-primary)]",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TopNav({ space }: { space: Space }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="-mb-px flex gap-1 overflow-x-auto">
      {NAV[space].map(({ key, href, phase }) => {
        const label = t(`${space}.${key}`);
        if (!href) {
          return (
            <span
              key={key}
              aria-disabled="true"
              className="flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] text-fg-subtle"
            >
              {label}
              <span className="rounded-sm bg-surface-sunken px-1 font-mono text-[10px]">
                {t("phase", { n: phase ?? 0 })}
              </span>
            </span>
          );
        }
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center border-b-2 border-transparent px-2.5 text-[13px] font-medium text-fg-muted hover:text-fg",
              active && "border-primary text-fg",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

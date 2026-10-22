"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@leaseplace/ui/cn";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const SHORT = { fr: "FR", ar: "ع", en: "EN" } as const;
const NAMES = { fr: "Français", ar: "العربية", en: "English" } as const;

/** Langues en liens directs (explorables par les robots, aucun menu à charger). */
export function LocaleLinks() {
  const pathname = usePathname();
  const current = useLocale();
  const t = useTranslations("common");
  return (
    <nav
      aria-label={t("language")}
      className="flex items-center rounded-md p-0.5 text-[12px] font-medium"
    >
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          lang={l}
          aria-label={NAMES[l]}
          aria-current={l === current ? "true" : undefined}
          className={cn(
            "inline-flex h-7 min-w-7 items-center justify-center rounded px-2 text-fg-muted transition-colors hover:text-fg",
            l === current && "bg-surface-sunken text-fg",
          )}
        >
          {SHORT[l]}
        </Link>
      ))}
    </nav>
  );
}

const ORDER = ["system", "light", "dark"] as const;

/** Bouton unique : système → clair → sombre. */
export function ThemeButton() {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const current = mounted && (theme === "light" || theme === "dark") ? theme : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  const label = { system: t("themeSystem"), light: t("themeLight"), dark: t("themeDark") }[current];
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
      }}
      aria-label={t("themeCurrent", { mode: label })}
      className="flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

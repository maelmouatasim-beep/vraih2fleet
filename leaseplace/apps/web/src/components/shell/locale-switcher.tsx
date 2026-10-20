"use client";

import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@leaseplace/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@leaseplace/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export function useSwitchLocale() {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  return (locale: Locale) => {
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  };
}

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const current = useLocale();
  const switchLocale = useSwitchLocale();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("language")} className="gap-1.5">
          <Languages aria-hidden="true" />
          <span className="uppercase">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onSelect={() => {
              switchLocale(locale);
            }}
            lang={locale}
          >
            <span className="flex-1">{LOCALE_LABELS[locale]}</span>
            {locale === current ? <Check aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

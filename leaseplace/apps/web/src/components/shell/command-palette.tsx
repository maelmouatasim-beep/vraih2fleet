"use client";

import { Command } from "cmdk";
import { CornerDownLeft, Languages, LogOut, Monitor, Moon, Search, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import type { Space } from "@leaseplace/domain";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@leaseplace/ui/dialog";
import { Kbd } from "@leaseplace/ui/kbd";
import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { LOCALE_LABELS, useSwitchLocale } from "./locale-switcher";
import { NAV } from "./nav";
import { signOutAndLeave } from "./sign-out";

function Item({
  children,
  onSelect,
  value,
}: {
  children: ReactNode;
  onSelect: () => void;
  value: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-[13px] text-fg data-[selected=true]:bg-surface-muted [&_svg]:size-4 [&_svg]:text-fg-muted"
    >
      {children}
    </Command.Item>
  );
}

const groupClass =
  "px-1.5 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle";

/** Palette ⌘K / Ctrl+K des espaces outils (bailleur, admin). */
export function CommandPalette({ space }: { space: Space }) {
  const t = useTranslations("palette");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const { setTheme } = useTheme();
  const switchLocale = useSwitchLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="flex h-8 w-full max-w-72 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[13px] text-fg-subtle shadow-sm transition-colors hover:border-border-strong"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="flex-1 text-start">{t("trigger")}</span>
        <Kbd>⌘K</Kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("description")}</DialogDescription>
          <Command label={t("title")} loop>
            <div className="flex items-center gap-2 border-b border-border px-3.5">
              <Search className="size-4 text-fg-subtle" aria-hidden="true" />
              <Command.Input
                placeholder={t("placeholder")}
                className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-80 overflow-y-auto py-1.5">
              <Command.Empty className="px-4 py-8 text-center text-sm text-fg-muted">
                {t("empty")}
              </Command.Empty>
              <Command.Group heading={t("navigation")} className={groupClass}>
                {NAV[space]
                  .filter((i) => i.href)
                  .map(({ key, icon: Icon, href }) => (
                    <Item
                      key={key}
                      value={tNav(`${space}.${key}`)}
                      onSelect={run(() => {
                        router.push(href ?? "/");
                      })}
                    >
                      <Icon aria-hidden="true" />
                      <span className="flex-1">{tNav(`${space}.${key}`)}</span>
                      <CornerDownLeft
                        className="opacity-0 [[data-selected=true]_&]:opacity-100"
                        aria-hidden="true"
                      />
                    </Item>
                  ))}
              </Command.Group>
              <Command.Group heading={t("preferences")} className={groupClass}>
                <Item
                  value={t("themeLight")}
                  onSelect={run(() => {
                    setTheme("light");
                  })}
                >
                  <Sun aria-hidden="true" />
                  {t("themeLight")}
                </Item>
                <Item
                  value={t("themeDark")}
                  onSelect={run(() => {
                    setTheme("dark");
                  })}
                >
                  <Moon aria-hidden="true" />
                  {t("themeDark")}
                </Item>
                <Item
                  value={t("themeSystem")}
                  onSelect={run(() => {
                    setTheme("system");
                  })}
                >
                  <Monitor aria-hidden="true" />
                  {t("themeSystem")}
                </Item>
                {routing.locales.map((locale) => (
                  <Item
                    key={locale}
                    value={`${t("language")} ${LOCALE_LABELS[locale]}`}
                    onSelect={run(() => {
                      switchLocale(locale);
                    })}
                  >
                    <Languages aria-hidden="true" />
                    <span lang={locale}>{LOCALE_LABELS[locale]}</span>
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading={t("account")} className={groupClass}>
                <Item
                  value={t("signOut")}
                  onSelect={run(() => {
                    void signOutAndLeave((p) => {
                      router.push(p);
                    });
                  })}
                >
                  <LogOut aria-hidden="true" />
                  {t("signOut")}
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

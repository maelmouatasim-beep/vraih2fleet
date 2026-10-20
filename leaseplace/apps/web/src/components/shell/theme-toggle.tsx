"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@leaseplace/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@leaseplace/ui/dropdown-menu";

export function ThemeToggle() {
  const t = useTranslations("common");
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme")}>
          <Sun className="dark:hidden" aria-hidden="true" />
          <Moon className="hidden dark:block" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            setTheme("light");
          }}
        >
          <Sun aria-hidden="true" />
          {t("themeLight")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setTheme("dark");
          }}
        >
          <Moon aria-hidden="true" />
          {t("themeDark")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setTheme("system");
          }}
        >
          <Monitor aria-hidden="true" />
          {t("themeSystem")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

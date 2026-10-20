"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@leaseplace/ui/dropdown-menu";
import { useRouter } from "@/i18n/navigation";
import { signOutAndLeave } from "./sign-out";

export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "");
  return ((letters[0] ?? "") + (letters.at(-1) ?? "")).toUpperCase();
}

export function UserMenu({
  name,
  email,
  organization,
  roleLabel,
  twoFactor,
}: {
  name: string;
  email: string;
  organization: string;
  roleLabel: string;
  twoFactor: boolean;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-md p-1 text-start outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("account")}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary-soft-fg">
          {initials(name)}
        </span>
        <span className="hidden min-w-0 flex-col leading-tight md:flex">
          <span className="truncate text-[13px] font-medium text-fg">{name}</span>
          <span className="truncate text-[11px] text-fg-muted">{organization}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-fg">{name}</span>
          <span className="truncate">{email}</span>
          <span className="truncate">
            {organization} · {roleLabel}
          </span>
        </DropdownMenuLabel>
        {twoFactor ? (
          <DropdownMenuLabel className="flex items-center gap-1.5 text-success">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {t("twoFactorOn")}
          </DropdownMenuLabel>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOutAndLeave((p) => {
              router.push(p);
            });
          }}
        >
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import {
  BadgePercent,
  Building2,
  ClipboardCheck,
  Contact,
  FileStack,
  FolderLock,
  Gauge,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  MessagesSquare,
  Receipt,
  ScrollText,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Space } from "@leaseplace/domain";

export interface NavItem {
  key: string;
  icon: LucideIcon;
  /** Lien d'une page livrée ; absent = page d'une phase à venir (affichée inactive). */
  href?: string;
  phase?: number;
}

export const NAV: Readonly<Record<Space, readonly NavItem[]>> = {
  company: [
    { key: "home", icon: LayoutDashboard, href: "/entreprise" },
    { key: "requests", icon: FileStack, href: "/entreprise/demandes" },
    { key: "vault", icon: FolderLock, href: "/entreprise/coffre-fort" },
    { key: "profile", icon: Building2, href: "/entreprise/profil" },
    { key: "messages", icon: MessagesSquare, phase: 7 },
  ],
  lessor: [
    { key: "inbox", icon: Inbox, href: "/bailleur" },
    { key: "pipeline", icon: KanbanSquare, phase: 6 },
    { key: "dashboard", icon: Gauge, phase: 6 },
    { key: "appetite", icon: SlidersHorizontal, phase: 6 },
    { key: "billing", icon: Receipt, phase: 8 },
  ],
  admin: [
    { key: "overview", icon: LayoutDashboard, href: "/admin" },
    { key: "kyc", icon: ClipboardCheck, phase: 5 },
    { key: "lessors", icon: Building2, phase: 8 },
    { key: "commissions", icon: BadgePercent, phase: 8 },
    { key: "contacts", icon: Contact, href: "/admin/contacts" },
    { key: "users", icon: Users, phase: 8 },
    { key: "audit", icon: ScrollText, href: "/admin/journal" },
  ],
};

/**
 * État d'un lien du menu : la page elle-même, ou une de ses sous-pages
 * (une demande ouverte garde « Demandes » actif). Les accueils d'espace
 * ne sont actifs que sur eux-mêmes.
 */
export function navCurrent(pathname: string, href: string): "page" | "true" | undefined {
  if (pathname === href) return "page";
  const isSpaceRoot = href.split("/").length <= 2;
  return !isSpaceRoot && pathname.startsWith(`${href}/`) ? "true" : undefined;
}

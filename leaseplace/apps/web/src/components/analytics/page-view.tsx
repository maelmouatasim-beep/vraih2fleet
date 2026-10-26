"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { publicPageOf, sendEvent } from "@/lib/analytics-client";

/** Visite d'une page publique (groupe de pages, langue) : entrée de l'entonnoir. */
export function PageView() {
  const pathname = usePathname();
  const locale = useLocale();
  useEffect(() => {
    const page = publicPageOf(pathname);
    if (page) sendEvent("page_viewed", { page, locale });
  }, [pathname, locale]);
  return null;
}

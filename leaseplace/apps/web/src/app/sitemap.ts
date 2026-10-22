import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { localizedPath, PUBLIC_PATHS, siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: `${base}${localizedPath(locale, path)}`,
      changeFrequency: "monthly" as const,
      priority: path === "/" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, `${base}${localizedPath(l, path)}`]),
        ),
      },
    })),
  );
}

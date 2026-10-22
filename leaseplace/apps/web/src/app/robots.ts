import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/demo";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** Espaces privés jamais indexés ; démonstration : rien n'est indexé. */
export default function robots(): MetadataRoute.Robots {
  if (isDemoMode()) return { rules: { userAgent: "*", disallow: "/" } };
  const privatePaths = [
    "/entreprise",
    "/bailleur",
    "/admin",
    "/connexion",
    "/securite",
    "/espace",
    "/demo",
    "/api",
  ];
  // « /bailleur » seul bloquerait aussi « /bailleurs » (page publique) : chemin exact ($) ou sous-chemins.
  const all = ["", "/ar", "/en"].flatMap((prefix) =>
    privatePaths.flatMap((p) => [`${prefix}${p}$`, `${prefix}${p}/`]),
  );
  return {
    rules: { userAgent: "*", allow: "/", disallow: all },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

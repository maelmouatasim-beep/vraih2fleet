import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getViewer, homePathOf } from "@/lib/viewer";

/** Aiguillage après connexion vers l'espace du rôle actif. */
export default async function SpaceRouter({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await getViewer();
  return redirect({ href: viewer ? homePathOf(viewer) : "/connexion", locale: locale as Locale });
}

import { useEffect, useState } from "react";
import {
  INTERVALLE_VERIFICATION_MS,
  NOM_META_VERSION,
  nouvelleVersionDisponible,
  urlVersion,
  versionDistante,
} from "@/lib/version/nouvelleVersion";

/** Version qui tourne dans cet onglet (balise écrite au build ; absente en dev). */
function versionCourante(): string | null {
  return document.querySelector<HTMLMetaElement>(`meta[name="${NOM_META_VERSION}"]`)?.content || null;
}

/**
 * Vrai quand une version plus récente est en ligne : vérification toutes les
 * 5 minutes et à chaque retour sur l'onglet (focus, onglet redevenu visible).
 * Ne recharge JAMAIS la page : le bandeau propose, l'utilisateur décide.
 */
export function useNouvelleVersion(): boolean {
  const [disponible, setDisponible] = useState(false);

  useEffect(() => {
    const courante = versionCourante();
    if (!courante || disponible) return;
    let actif = true;
    const verifier = async () => {
      try {
        const r = await fetch(urlVersion(import.meta.env.BASE_URL, Date.now()), { cache: "no-store" });
        if (!r.ok) return;
        const distante = versionDistante(await r.json());
        if (actif && nouvelleVersionDisponible(courante, distante)) setDisponible(true);
      } catch {
        /* hors ligne ou fichier absent : on réessaiera */
      }
    };
    const auRetour = () => {
      if (document.visibilityState === "visible") void verifier();
    };
    window.addEventListener("focus", auRetour);
    document.addEventListener("visibilitychange", auRetour);
    const minuterie = window.setInterval(verifier, INTERVALLE_VERIFICATION_MS);
    return () => {
      actif = false;
      window.removeEventListener("focus", auRetour);
      document.removeEventListener("visibilitychange", auRetour);
      window.clearInterval(minuterie);
    };
  }, [disponible]);

  return disponible;
}

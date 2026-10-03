import { useLayoutEffect, useRef, useState } from "react";

/**
 * Largeur intérieure d'un élément, suivie au redimensionnement (null avant
 * la première mesure). Sert aux mises en page qui dépendent de la place
 * RÉELLEMENT disponible (la barre latérale en prend une partie).
 */
export function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mesurer = () => setLargeur(el.clientWidth);
    mesurer();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, largeur };
}

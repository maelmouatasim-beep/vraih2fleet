/**
 * Style commun des infobulles de graphiques (Recharts) : couleurs du thème,
 * largeur bornée et retour à la ligne (jamais plus large que le graphique,
 * y compris sur mobile).
 */
import type { CSSProperties } from "react";

export const INFOBULLE_GRAPHIQUE: { contentStyle: CSSProperties; wrapperStyle: CSSProperties } = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    whiteSpace: "normal",
    fontSize: "0.8125rem",
  },
  wrapperStyle: { maxWidth: "min(100%, 22rem)", zIndex: 20 },
};

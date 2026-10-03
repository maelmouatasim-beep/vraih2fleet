/**
 * Système de mise en page commun à toutes les pages de l'application :
 * conteneur (largeur et espacement vertical uniques) et en-tête (titre,
 * sous-titre, lien de retour, actions alignées à droite).
 *
 * Échelle : espacement de 4/8 px (Tailwind) — 24 px entre blocs de page,
 * 16 px dans les cartes ; titre de page 24 px semi-gras, sous-titre 14 px.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
  children: ReactNode;
  /** « large » : tableaux et tableaux de bord ; « etroite » : formulaires, listes. */
  largeur?: "large" | "etroite";
  className?: string;
}

export function Page({ children, largeur = "large", className }: PageProps) {
  return (
    <div className={cn("mx-auto w-full space-y-6", largeur === "etroite" ? "max-w-4xl" : "max-w-7xl", className)}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  titre: ReactNode;
  sousTitre?: ReactNode;
  /** Lien de retour au-dessus du titre. */
  retour?: { vers: string; libelle: string };
  /** Boutons d'action, alignés à droite (sous le titre en mobile). */
  actions?: ReactNode;
  /** Élément à côté du titre (badge). */
  badge?: ReactNode;
}

export function PageHeader({ titre, sousTitre, retour, actions, badge }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-testid="page-header">
      <div className="min-w-0 space-y-1">
        {retour && (
          <Link
            to={retour.vers}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {retour.libelle}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titre}</h1>
          {badge}
        </div>
        {sousTitre && <p className="text-sm text-muted-foreground">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>}
    </header>
  );
}

/**
 * Carte d'indicateur commune (Accueil, Ma flotte, Bibliothèque, étapes du
 * parcours) : libellé 14 px, valeur en chiffres tabulaires sans retour à
 * la ligne (montant et unité restent ensemble), détail facultatif.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  libelle: ReactNode;
  valeur: ReactNode;
  detail?: ReactNode;
  icone?: LucideIcon;
  /** Classes de la pastille d'icône (fond + couleur). */
  classeIcone?: string;
  vers?: string;
}

export function StatCard({ libelle, valeur, detail, icone: Icone, classeIcone, vers }: StatCardProps) {
  const contenu = (
    <Card className={cn("h-full p-4 sm:p-5", vers && "transition-colors hover:border-primary/40")} data-testid="stat-card">
      {Icone && (
        <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", classeIcone ?? "bg-muted text-muted-foreground")}>
          <Icone className="h-5 w-5" aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-muted-foreground">{libelle}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-semibold tabular-nums text-foreground lg:text-2xl" data-testid="stat-value">
        {valeur}
      </p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </Card>
  );
  return vers ? (
    <Link to={vers} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {contenu}
    </Link>
  ) : (
    contenu
  );
}

/** Grille d'indicateurs : 2 colonnes en mobile, 4 dès 1024 px. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>{children}</div>;
}

/**
 * États communs : pastille d'état sémantique (même couleur et même forme
 * pour un même sens dans toute l'application), état vide, chargement
 * (squelettes) et erreur.
 */
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Sens d'une pastille : succès, attention, danger, information, neutre. */
export type Ton = "succes" | "attention" | "danger" | "info" | "neutre";

// Contraste AA (texte 800 sur fond 50 en clair, 300 sur fond 15 % en sombre).
export const CLASSES_TON: Record<Ton, string> = {
  succes: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
  attention: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30",
  danger: "bg-red-50 text-red-800 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30",
  info: "bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30",
  neutre: "bg-muted text-muted-foreground ring-border",
};

interface StatusBadgeProps {
  ton: Ton;
  children: ReactNode;
  icone?: LucideIcon;
  className?: string;
  title?: string;
}

export function StatusBadge({ ton, children, icone: Icone, className, title }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        CLASSES_TON[ton],
        className,
      )}
      data-ton={ton}
      title={title}
    >
      {Icone && <Icone className="h-3 w-3 shrink-0" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

interface EmptyStateProps {
  titre: ReactNode;
  description?: ReactNode;
  icone?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ titre, description, icone: Icone = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)} data-testid="empty-state">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icone className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{titre}</p>
        {description && <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Squelette de chargement : lignes de texte, ou grille de cartes. */
export function LoadingState({ variante = "lignes", nombre = 4, className }: { variante?: "lignes" | "cartes"; nombre?: number; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={className} role="status" aria-busy="true" aria-label={t("common.loading")} data-testid="loading-state">
      {variante === "cartes" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: nombre }, (_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-6">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-7 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3 p-6">
          {Array.from({ length: nombre }, (_, i) => (
            <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-1/2" : "w-full")} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message?: ReactNode; onRetry?: () => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)} role="alert" data-testid="error-state">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/15">
        <AlertTriangle className="h-6 w-6 text-amber-700 dark:text-amber-300" aria-hidden />
      </div>
      <p className="max-w-md text-sm text-muted-foreground">{message ?? t("common.loadError")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

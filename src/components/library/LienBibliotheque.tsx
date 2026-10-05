/**
 * Petit lien « source » posé à côté d'un chiffre : ouvre la Bibliothèque
 * sur les hypothèses (ou la catégorie) qui l'alimentent — un clic.
 */
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  to: string;
  libelle: string;
  /** Texte accessible plus précis que le libellé visible. */
  titre?: string;
  className?: string;
  testId?: string;
}

export default function LienBibliotheque({ to, libelle, titre, className, testId }: Props) {
  return (
    <Link
      to={to}
      title={titre ?? libelle}
      aria-label={titre ?? libelle}
      data-testid={testId}
      className={cn("inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline", className)}
    >
      <BookOpen className="h-3 w-3 shrink-0" aria-hidden />
      <span>{libelle}</span>
    </Link>
  );
}

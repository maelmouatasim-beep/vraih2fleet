/**
 * VAN décomposée par poste (moteur, §6.4) — Stratégies et Plan. Chaque
 * ligne = économie actualisée du plan sur ce poste (positif = moins cher
 * que le statu quo) ; la somme des lignes est la VAN affichée partout.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResultatPlan } from "@/lib/tco";
import { formateurCad } from "@/lib/format";
import { lignesDecomposition } from "@/lib/journey/synthese";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { lienPoste } from "@/lib/library/liens";

export default function VanDecompositionCard({ resultat }: { resultat: ResultatPlan }) {
  const { t, i18n } = useTranslation();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const lignes = lignesDecomposition(resultat.decompositionVan);
  if (lignes.length === 0) return null;
  const max = Math.max(...lignes.map((l) => Math.abs(l.montant)), 1);
  const signe = (v: number) => (v > 0 ? `+${argent.format(v)}` : argent.format(v));
  return (
    <Card data-testid="van-decomposition">
      <CardHeader>
        <CardTitle className="text-lg">{t("journey.van.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("journey.van.subtitle")}</p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {lignes.map((l) => (
            <li key={l.poste} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
              <Link
                to={lienPoste(l.poste)}
                className="group inline-flex min-w-0 items-center gap-1.5 text-sm underline-offset-2 hover:underline"
                title={t("journey.van.sourceLink")}
                data-testid={`van-lien-${l.poste}`}
              >
                <span className="min-w-0">{t(`journey.van.postes.${l.poste}`)}</span>
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
              </Link>
              <span className="order-3 col-span-2 h-2 rounded bg-muted sm:order-none sm:col-span-1" aria-hidden>
                <span
                  className={cn("block h-2 rounded", l.montant >= 0 ? "bg-primary" : "bg-destructive")}
                  style={{ width: `${Math.max(2, (Math.abs(l.montant) / max) * 100)}%` }}
                />
              </span>
              <span
                className={cn("whitespace-nowrap text-right text-sm font-medium tabular-nums", l.montant >= 0 ? "text-primary" : "text-destructive")}
                data-testid={`van-poste-${l.poste}`}
              >
                {signe(l.montant)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-semibold">
          <span>{t("journey.van.total")}</span>
          <span className={cn("whitespace-nowrap tabular-nums", resultat.vanDifferentielle >= 0 ? "text-primary" : "text-destructive")} data-testid="van-total">
            {signe(resultat.vanDifferentielle)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("journey.van.note")} {t("journey.van.sourceHint")}</p>
      </CardContent>
    </Card>
  );
}

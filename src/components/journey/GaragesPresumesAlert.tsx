/**
 * Audit acheteur, point 8 — appel à l'action quand la puissance électrique
 * d'un garage du projet n'est pas renseignée : le calcul retient alors la
 * valeur PRÉSUMÉE du registre (estimation), qui pèse sur les bornes, le
 * raccordement et la stratégie « Économies d'abord ».
 */
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGarages } from "@/hooks/useGarages";
import { garagesPuissancePresumee } from "@/lib/fleet/garagesModel";
import { HYPOTHESES } from "@/lib/tco";
import { formateurNombre } from "@/lib/format";

interface Props {
  organizationId: string | null | undefined;
  depots: (string | null | undefined)[];
}

export default function GaragesPresumesAlert({ organizationId, depots }: Props) {
  const { t, i18n } = useTranslation();
  const { garages, isLoading } = useGarages(organizationId);
  if (isLoading || depots.length === 0) return null;
  const presumes = garagesPuissancePresumee(depots, garages);
  if (presumes.length === 0) return null;
  const noms = presumes.map((g) => g ?? t("journey.infra.noDepot")).join(", ");
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
      data-testid="garages-presumed"
      role="status"
    >
      <div className="flex min-w-0 gap-2">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{t("journey.garagesPresumed.title", { count: presumes.length, garages: noms })}</p>
          <p className="text-muted-foreground">
            {t("journey.garagesPresumed.body", { kw: formateurNombre(i18n.language).format(HYPOTHESES.puissance_disponible_garage_presumee.valeur) })}
          </p>
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link to="/dashboard/fleet?section=garages" data-testid="garages-presumed-link">
          {t("journey.garagesPresumed.action")}
        </Link>
      </Button>
    </div>
  );
}

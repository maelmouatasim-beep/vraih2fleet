/**
 * C6 — Dimensionnement minimal de la recharge PAR DÉPÔT : bornes selon
 * les véhicules affectés et le calendrier, puissance appelée (fourchette
 * du registre), phasage par année, devis de raccordement client
 * PRIORITAIRE sur l'estimation.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dimensionnerDepots,
  type TypeBorne,
  type VehiculeDepot,
} from "@/lib/journey/infrastructure";
import { HYPOTHESES } from "@/lib/tco";
import { formateurCad } from "@/lib/format";
import { PlugZap } from "lucide-react";

interface DepotInfrastructureCardProps {
  vehicules: VehiculeDepot[];
  anneeReference: number;
  devisRaccordement: number | null | undefined;
}

const ORDRE_TYPES: TypeBorne[] = ["niveau2", "rapide50", "rapide150"];

export default function DepotInfrastructureCard({
  vehicules,
  anneeReference,
  devisRaccordement,
}: DepotInfrastructureCardProps) {
  const { t, i18n } = useTranslation();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  const dimensionnement = useMemo(
    () => dimensionnerDepots(vehicules, { anneeReference, devisRaccordement }),
    [vehicules, anneeReference, devisRaccordement],
  );

  if (dimensionnement.depots.length === 0) return null;

  const puissance = (min: number, max: number) =>
    min === max ? `${max} kW` : `${min}-${max} kW`;

  const listeBornes = (bornes: Partial<Record<TypeBorne, number>>) =>
    ORDRE_TYPES.filter((type) => (bornes[type] ?? 0) > 0)
      .map((type) => `${bornes[type]} × ${t(`journey.infra.borneTypes.${type}`)}`)
      .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PlugZap className="w-5 h-5" /> {t("journey.infra.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("journey.infra.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {dimensionnement.depots.map((d) => (
          <div key={d.depot ?? "__sans_depot__"} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {d.depot ?? t("journey.infra.noDepot")}
                {d.depot == null && (
                  <Badge variant="outline" className="ml-2">{t("journey.infra.noDepotBadge")}</Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("journey.infra.commissioning", { year: d.anneeMiseEnService })}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{t("journey.infra.chargers")}</p>
                <p className="font-medium">{listeBornes(d.bornes) || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("journey.infra.power")}</p>
                <p className="font-medium">
                  {d.puissanceMaxKw > 0 ? puissance(d.puissanceMinKw, d.puissanceMaxKw) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("journey.infra.capexChargers")}</p>
                <p className="font-medium">{d.capexBornes > 0 ? argent.format(d.capexBornes) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("journey.infra.connection")}</p>
                <p className="font-medium">
                  {dimensionnement.devisRaccordement != null ? (
                    <span className="text-muted-foreground line-through mr-1">
                      {argent.format(d.raccordementEstime)}
                    </span>
                  ) : d.raccordementEstime > 0 ? (
                    argent.format(d.raccordementEstime)
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
            {d.nbFcev > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("journey.infra.h2", { count: d.nbFcev, amount: argent.format(d.capexStationH2) })}
              </p>
            )}
            {d.categoriesInconnues.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t("journey.infra.unknownCategories", { count: d.categoriesInconnues.length })}
              </p>
            )}
            {d.phasage.length > 0 && (
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">{t("journey.infra.phasing")}</p>
                <ul className="space-y-0.5">
                  {d.phasage.map((ph) => (
                    <li key={ph.annee}>
                      <span className="font-medium">{ph.annee}</span> — {listeBornes(ph.bornes)}{" "}
                      (+{puissance(ph.puissanceAjouteeMinKw, ph.puissanceAjouteeMaxKw)}) ·{" "}
                      <span className="text-muted-foreground">{ph.unites.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}

        <div className="text-sm space-y-1 border-t border-border pt-3">
          {dimensionnement.devisRaccordement != null ? (
            <p>
              {t("journey.infra.clientQuote", {
                amount: argent.format(dimensionnement.devisRaccordement),
              })}
            </p>
          ) : (
            <p className="text-muted-foreground">{t("journey.infra.quoteHint")}</p>
          )}
          <p className="font-medium">
            {t("journey.infra.total", { amount: argent.format(dimensionnement.totalCapex) })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("journey.infra.sourceNote", {
              source: HYPOTHESES.borne_niveau2_installee.source.organisme,
              date: HYPOTHESES.borne_niveau2_installee.dateVerification,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

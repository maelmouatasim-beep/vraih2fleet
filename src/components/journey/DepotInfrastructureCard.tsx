/**
 * Infrastructure PAR GARAGE : affiche le plan d'infrastructure de la
 * stratégie (source unique, src/lib/journey/infrastructure.ts) — les
 * montants sont EXACTEMENT ceux chiffrés par le moteur dans Stratégies,
 * Financement, Rapports et Excel. Rien n'est recalculé ici.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type PlanInfrastructure, type TypeBorne } from "@/lib/journey/infrastructure";
import { HYPOTHESES } from "@/lib/tco";
import { formateurCad } from "@/lib/format";
import { PlugZap } from "lucide-react";

interface DepotInfrastructureCardProps {
  /** Plan d'infrastructure de la stratégie affichée (StrategieConstruite.infra). */
  infra: PlanInfrastructure;
  anneeReference: number;
}

const ORDRE_TYPES: TypeBorne[] = ["niveau2", "rapide50", "rapide150"];

export default function DepotInfrastructureCard({ infra, anneeReference }: DepotInfrastructureCardProps) {
  const { t, i18n } = useTranslation();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  if (infra.garages.length === 0) return null;

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
        {infra.garages.map((d) => (
          <div key={d.cle} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {d.depot ?? t("journey.infra.noDepot")}
                {d.depot == null && (
                  <Badge variant="outline" className="ml-2">{t("journey.infra.noDepotBadge")}</Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("journey.infra.commissioning", {
                  year:
                    anneeReference +
                    Math.min(d.anneeMiseEnServiceRecharge ?? Infinity, d.anneeMiseEnServiceH2 ?? Infinity),
                })}
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
                  {d.raccordement.source === "aucun" ? "—" : argent.format(d.raccordement.cout)}
                </p>
                {d.raccordement.source !== "aucun" && (
                  <p className="text-xs text-muted-foreground">
                    {t(`journey.infra.connectionSource.${d.raccordement.source}`)}
                  </p>
                )}
              </div>
            </div>
            {d.raccordement.source !== "aucun" && (
              <p className="text-xs text-muted-foreground">
                {t("journey.infra.connectionDetail", {
                  demandes: Math.round(d.raccordement.kwDemandes),
                  disponibles: Math.round(d.raccordement.kwDisponibles),
                  supplementaires: Math.round(d.raccordement.kwSupplementaires),
                })}{" "}
                {d.raccordement.kwDisponiblesSource === "presumee" && t("journey.infra.presumedCapacity")}{" "}
                {d.raccordement.palier > 0
                  ? t("journey.infra.tier", { palier: d.raccordement.palier })
                  : t("journey.infra.noUpgrade")}
              </p>
            )}
            {d.vehiculesFcev.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {t("journey.infra.h2", { count: d.vehiculesFcev.length, amount: argent.format(d.capexStationH2) })}
              </p>
            )}
            {d.categoriesInconnues.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t("journey.infra.unknownCategories", { count: d.categoriesInconnues.length })}
              </p>
            )}
            <p className="text-sm font-medium">
              {t("journey.infra.garageTotal", { amount: argent.format(d.capexTotal) })}
            </p>
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
          {infra.devisRaccordementProjet != null ? (
            <p>
              {t("journey.infra.clientQuote", {
                amount: argent.format(infra.devisRaccordementProjet),
              })}
            </p>
          ) : (
            <p className="text-muted-foreground">{t("journey.infra.quoteHint")}</p>
          )}
          <p className="font-medium">
            {t("journey.infra.total", { amount: argent.format(infra.totalCapex) })}
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

/**
 * Stress test d'une stratégie (méthodologie §7) : les trois scénarios
 * cohérents (prudent / central / favorable), le niveau de risque CALCULÉ
 * et la tornade — chaque barre est le vrai moteur relancé aux bornes
 * SOURCÉES de l'hypothèse (jamais un ±20 % arbitraire).
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { analyserSensibilite, type PlanTcoEntree } from "@/lib/tco";
import { formateurCad, formateurCadCompact } from "@/lib/format";
import { AlertTriangle, BookOpen } from "lucide-react";
import { echelleTornade, explicationStatuQuo, libelleEcart, lignesTornade } from "@/lib/journey/tornade";
import { cn } from "@/lib/utils";

interface StressTestPanelProps {
  plan: PlanTcoEntree;
}

export default function StressTestPanel({ plan }: StressTestPanelProps) {
  const { t, i18n } = useTranslation();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const compact = useMemo(() => formateurCadCompact(i18n.language), [i18n.language]);

  const analyse = useMemo(() => analyserSensibilite(plan), [plan]);
  const langue = i18n.language.startsWith("en") ? "en" : "fr";
  const lignes = useMemo(() => lignesTornade(analyse.tornade, langue), [analyse, langue]);
  const echelle = useMemo(() => echelleTornade(analyse.tornade, analyse.vanCentrale), [analyse]);
  const pos = (v: number) => ((v - echelle.min) / (echelle.max - echelle.min)) * 100;
  const signe = (v: number) => (v > 0 ? `+${compact.format(v)}` : compact.format(v));

  const badgeRisque =
    analyse.niveauRisque === "faible"
      ? "default"
      : analyse.niveauRisque === "moyen"
        ? "secondary"
        : "destructive";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t("journey.strategies.stress.title")}
            </CardTitle>
            <CardDescription>{t("journey.strategies.stress.subtitle")}</CardDescription>
          </div>
          <Badge variant={badgeRisque} className="max-w-full whitespace-normal text-left">
            {t(`journey.strategies.stress.risk.${analyse.niveauRisque}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trois scénarios cohérents */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["prudent", "central", "favorable"] as const).map((cle) => {
            const s = analyse.scenarios[cle];
            return (
              <div key={cle} className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">
                  {t(`journey.strategies.stress.scenarios.${cle}`)}
                </p>
                <p className={`text-xl font-bold ${s.van >= 0 ? "text-primary" : "text-destructive"}`}>
                  {s.van >= 0
                    ? t("journey.feasibility.savings", { amount: argent.format(s.van) })
                    : t("journey.feasibility.extraCost", { amount: argent.format(-s.van) })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("journey.strategies.stress.tcoCompare", {
                    alt: compact.format(s.tcoAlt),
                    ref: compact.format(s.tcoRef),
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1" data-testid={`statu-quo-${cle}`}>
                  {explicationStatuQuo(analyse, cle, langue)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Tornade : économie recalculée aux bornes sourcées de chaque hypothèse */}
        <div className="space-y-2" data-testid="tornade">
          <div>
            <p className="text-sm font-medium">{t("journey.strategies.stress.tornadoTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("journey.strategies.stress.tornadoHelp")}</p>
          </div>
          <ol className="space-y-3">
            {lignes.map((l) => {
              const g = Math.min(pos(l.basse.van), pos(l.haute.van));
              const d = Math.max(pos(l.basse.van), pos(l.haute.van));
              return (
                <li key={l.id} className="space-y-1" data-testid={`tornade-${l.id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <Link
                      to={l.lien}
                      className="group inline-flex min-w-0 items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline"
                      title={t("journey.van.sourceLink")}
                    >
                      <span className="min-w-0">{l.libelle}</span>
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("journey.strategies.stress.tornadoAmplitude", { amount: compact.format(l.amplitude) })}
                    </span>
                  </div>
                  <div className="relative h-3 rounded bg-muted" aria-hidden>
                    <span className="absolute inset-y-0 w-px bg-muted-foreground/60" style={{ left: `${pos(0)}%` }} />
                    <span
                      className={cn("absolute inset-y-0 rounded", l.basse.van < 0 && l.haute.van < 0 ? "bg-destructive/70" : l.basse.van >= 0 && l.haute.van >= 0 ? "bg-primary/70" : "bg-amber-500/70")}
                      style={{ left: `${g}%`, width: `${Math.max(0.8, d - g)}%` }}
                    />
                    <span className="absolute -inset-y-0.5 w-0.5 bg-foreground" style={{ left: `${pos(analyse.vanCentrale)}%` }} />
                  </div>
                  <div className="grid grid-cols-1 gap-x-4 text-xs tabular-nums sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">{t("journey.strategies.stress.tornadoLow", { value: l.basse.valeur })}</span>{" "}
                      <span className={cn("font-medium", l.basse.van >= 0 ? "text-primary" : "text-destructive")}>{signe(l.basse.van)}</span>
                    </p>
                    <p className="sm:text-right">
                      <span className="text-muted-foreground">{t("journey.strategies.stress.tornadoHigh", { value: l.haute.valeur })}</span>{" "}
                      <span className={cn("font-medium", l.haute.van >= 0 ? "text-primary" : "text-destructive")}>{signe(l.haute.van)}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="tornade-centrale">
          {t("journey.strategies.stress.noteCentral", { ecart: libelleEcart(analyse.vanCentrale, langue) })}
        </p>
      </CardContent>
    </Card>
  );
}

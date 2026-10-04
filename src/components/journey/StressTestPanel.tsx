/**
 * Stress test d'une stratégie (méthodologie §7) : les trois scénarios
 * cohérents (prudent / central / favorable), le niveau de risque CALCULÉ
 * et la tornade — chaque barre est le vrai moteur relancé aux bornes
 * SOURCÉES de l'hypothèse (jamais un ±20 % arbitraire).
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { analyserSensibilite, type PlanTcoEntree } from "@/lib/tco";
import { formateurCad, formateurCadCompact } from "@/lib/format";
import { AlertTriangle } from "lucide-react";
import { PARAMETRES_STRESS_EN } from "@/lib/tco/translations-en";
import { INFOBULLE_GRAPHIQUE } from "@/components/layout/charts";
import { useLargeur } from "@/hooks/useLargeur";

interface StressTestPanelProps {
  plan: PlanTcoEntree;
}

export default function StressTestPanel({ plan }: StressTestPanelProps) {
  const { t, i18n } = useTranslation();
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);
  const compact = useMemo(() => formateurCadCompact(i18n.language), [i18n.language]);

  const analyse = useMemo(() => analyserSensibilite(plan), [plan]);

  // Axe des libellés proportionné à la place disponible (mobile : abrégés, nom complet dans l'infobulle).
  const { ref: refTornade, largeur } = useLargeur<HTMLDivElement>();
  const largeurAxe = Math.round(Math.min(220, Math.max(96, (largeur ?? 700) * 0.38)));
  const maxCaracteres = Math.max(12, Math.floor(largeurAxe / 6.2));
  const donneesTornade = analyse.tornade.map((b) => {
    const min = Math.min(b.vanBasse, b.vanHaute);
    const max = Math.max(b.vanBasse, b.vanHaute);
    const libelle = i18n.language.startsWith("en") ? PARAMETRES_STRESS_EN[b.id] ?? b.libelle : b.libelle;
    return { libelle, plage: [min, max], amplitude: b.amplitude };
  });

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
              </div>
            );
          })}
        </div>

        {/* Tornade : VAN aux bornes sourcées de chaque hypothèse */}
        <div className="h-[280px]" ref={refTornade}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={donneesTornade} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => compact.format(v)}
                className="text-xs"
              />
              <YAxis
                dataKey="libelle"
                type="category"
                width={largeurAxe}
                className="text-xs"
                tickFormatter={(v: string) => (v.length > maxCaracteres ? `${v.slice(0, maxCaracteres - 1)}…` : v)}
              />
              <Tooltip
                formatter={(value: [number, number]) => [
                  `${compact.format(value[0])} → ${compact.format(value[1])}`,
                  t("journey.strategies.stress.vanRange"),
                ]}
                {...INFOBULLE_GRAPHIQUE}
              />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
              <ReferenceLine
                x={analyse.vanCentrale}
                stroke="hsl(var(--primary))"
                strokeDasharray="4 4"
              />
              <Bar dataKey="plage" radius={[4, 4, 4, 4]}>
                {donneesTornade.map((entree, i) => (
                  <Cell
                    key={i}
                    fill={entree.plage[0] < 0 ? "hsl(0, 72%, 51%)" : "hsl(160, 84%, 30%)"}
                    fillOpacity={0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("journey.strategies.stress.note", { van: argent.format(analyse.vanCentrale) })}
        </p>
      </CardContent>
    </Card>
  );
}

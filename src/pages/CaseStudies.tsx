/**
 * Exemples illustratifs (Phase 4) — remplace les anciennes « études de
 * cas » (STM, Winnipeg, ERA : chiffres calculés avec des facteurs
 * arbitraires et présentés comme des résultats prouvés d'organisations
 * non clientes). On publie les 7 CAS DE RÉFÉRENCE du moteur : fictifs,
 * contre-calculés par un calculateur indépendant (docs/tco-cas-de-reference.json,
 * écart ≤ 0,01 $ vérifié en CI) et recalculés ICI en direct par le moteur,
 * cas défavorables compris.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { calculerPlan, type PlanTcoEntree } from "@/lib/tco";
import { formateurCad, formateurNombre } from "@/lib/format";
import { texteRecuperation } from "@/lib/journey/payback";
import cas from "../../docs/tco-cas-de-reference.json";

interface CasReference {
  id: number;
  entrees: PlanTcoEntree;
}

export default function CaseStudies() {
  const { t, i18n } = useTranslation();
  const en = i18n.language === "en";
  const argent = useMemo(() => formateurCad(i18n.language), [i18n.language]);

  const exemples = useMemo(
    () =>
      (cas.cas as unknown as CasReference[]).map((c) => {
        const r = calculerPlan(c.entrees);
        const v = c.entrees.vehicules;
        return {
          id: c.id,
          r,
          nbVehicules: v.length,
          kmParAn: v.reduce((a, x) => a + x.kmParAn, 0),
          technologie: v[0].alternative.technologie,
          subventions: v.flatMap((x) => x.subventionsAlternative ?? []).reduce((a, s) => a + s.montant, 0),
          infra: (c.entrees.sitesInfra ?? []).reduce((a, s) => a + s.capexAvantTaxes, 0),
          horizon: c.entrees.parametres.horizonAns,
        };
      }),
    [],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-12 max-w-5xl space-y-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">{t("examples.title")}</h1>
          <p className="text-lg text-muted-foreground mt-2">{t("examples.subtitle")}</p>
        </div>
        <div role="note" className="flex gap-3 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>{t("examples.disclaimer")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {exemples.map((e) => {
            const van = e.r.vanDifferentielle;
            return (
              <Card key={e.id} data-cas={e.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{t(`examples.cases.c${e.id}`)}</CardTitle>
                    <Badge variant="outline">{t("examples.fictional")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {t("examples.inputs", {
                      count: e.nbVehicules,
                      km: e.kmParAn.toLocaleString(en ? "en-CA" : "fr-CA"),
                      horizon: e.horizon,
                      infra: argent.format(e.infra),
                      subventions: argent.format(e.subventions),
                    })}
                  </p>
                  <p className={van >= 0 ? "text-primary font-semibold text-base" : "text-destructive font-semibold text-base"}>
                    {van >= 0
                      ? t("journey.feasibility.savings", { amount: argent.format(van) })
                      : t("journey.feasibility.extraCost", { amount: argent.format(-van) })}
                  </p>
                  <p>
                    {t("examples.payback")} : {texteRecuperation(e.r.paybackActualise, e.r.horizonAns, en)}
                  </p>
                  <p>
                    {t("journey.strategies.metrics.co2", {
                      ttw: formateurNombre(i18n.language).format(e.r.co2EviteTtwTonnes),
                      wtw: formateurNombre(i18n.language).format(e.r.co2EviteWtwTonnes),
                    })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          {t("examples.method")}{" "}
          <Link to="/methodology" className="text-primary underline">
            {t("examples.methodLink")}
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}

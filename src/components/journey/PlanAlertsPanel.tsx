/**
 * Phase 5.6 — Panneau « Surveillance du plan » (étape Suivi) : alertes
 * calculées par le moteur, gravité, lien vers l'étape à reprendre,
 * « Marquer comme vue » (éditeurs, tracé dans plan_alerts).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlanSurveillance, type AlerteAffichee } from "@/hooks/usePlanSurveillance";
import type { ProjectDTO } from "@/lib/supabase/projects";
import type { GraviteAlerte, NiveauSante } from "@/lib/journey/surveillance";
import { texteAlerte } from "./surveillanceTexts";
import { Activity, AlertOctagon, AlertTriangle, ArrowRight, Eye, Info } from "lucide-react";
import { StatusBadge } from "@/components/layout/States";
import { TON_GRAVITE, TON_SANTE } from "@/components/layout/tons";

/** Pastille de santé du plan (même rendu dans Suivi et sur l'Accueil). */
export function BadgeSante({ niveau, ...rest }: { niveau: NiveauSante; "data-testid"?: string }) {
  const { t } = useTranslation();
  return (
    <StatusBadge ton={TON_SANTE[niveau]} data-level={niveau} {...rest}>
      {t(`journey.monitoring.health.${niveau}`)}
    </StatusBadge>
  );
}

const ICONES: Record<GraviteAlerte, typeof Info> = { critique: AlertOctagon, attention: AlertTriangle, info: Info };
const COULEURS: Record<GraviteAlerte, string> = {
  critique: "border-red-300 bg-red-50/70 dark:bg-red-950/20",
  attention: "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20",
  info: "border-border bg-muted/30",
};

function Ligne({
  a,
  projectId,
  peutModifier,
  onVue,
}: {
  a: AlerteAffichee;
  projectId: string;
  peutModifier: boolean;
  onVue?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language === "en" ? "en" : "fr";
  const { titre, message } = texteAlerte(a, t, langue);
  const Icone = ICONES[a.gravite];
  return (
    <li className={`rounded-lg border p-3 space-y-1 ${COULEURS[a.gravite]}`} data-testid="plan-alert" data-kind={a.type} data-severity={a.gravite}>
      <div className="flex flex-wrap items-center gap-2">
        <Icone className="w-4 h-4 shrink-0" />
        <span className="font-medium">{titre}</span>
        <StatusBadge ton={TON_GRAVITE[a.gravite]}>{t(`journey.monitoring.severity.${a.gravite}`)}</StatusBadge>
        {a.ligne && (
          <span className="text-xs text-muted-foreground">{t("journey.monitoring.since", { date: a.ligne.first_seen_at.slice(0, 10) })}</span>
        )}
      </div>
      <p className="text-sm">{message}</p>
      <div className="flex flex-wrap gap-2 justify-end">
        <Button size="sm" variant="ghost" asChild>
          <Link to={`/dashboard/projects/${projectId}/${a.lien}`}>
            {t("journey.monitoring.open")} <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </Button>
        {onVue && peutModifier && a.ligne && (
          <Button size="sm" variant="outline" onClick={onVue} data-testid="plan-alert-dismiss">
            <Eye className="w-3.5 h-3.5 mr-1" /> {t("journey.monitoring.dismiss")}
          </Button>
        )}
      </div>
    </li>
  );
}

export default function PlanAlertsPanel({ projectId, project }: { projectId: string; project: ProjectDTO | null | undefined }) {
  const { t } = useTranslation();
  const { alertes, sante, peutModifier, marquerVue } = usePlanSurveillance(projectId, project);
  const [voirVues, setVoirVues] = useState(false);
  if (!alertes || !sante) return null;
  const actives = alertes.filter((a) => !a.vue);
  const vues = alertes.filter((a) => a.vue);

  const vue = async (a: AlerteAffichee) => {
    try {
      await marquerVue(a);
      toast({ title: t("journey.monitoring.dismissed") });
    } catch (e) {
      toast({ title: t("common.error"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <Card data-testid="plan-alerts-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex flex-wrap items-center gap-2">
          <Activity className="w-5 h-5 text-muted-foreground" /> {t("journey.monitoring.title")}
          <BadgeSante niveau={sante.niveau} data-testid="plan-health-badge" />
        </CardTitle>
        <CardDescription>{t("journey.monitoring.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actives.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("journey.monitoring.none")}</p>
        ) : (
          <ul className="space-y-2">
            {actives.map((a) => (
              <Ligne key={a.cle} a={a} projectId={projectId} peutModifier={peutModifier} onVue={() => void vue(a)} />
            ))}
          </ul>
        )}
        {vues.length > 0 && (
          <div>
            <Button size="sm" variant="link" className="px-0" onClick={() => setVoirVues((v) => !v)}>
              {t("journey.monitoring.showDismissed", { count: vues.length })}
            </Button>
            {voirVues && (
              <ul className="space-y-2 opacity-70">
                {vues.map((a) => (
                  <Ligne key={a.cle} a={a} projectId={projectId} peutModifier={false} />
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("journey.monitoring.emailNote")}</p>
      </CardContent>
    </Card>
  );
}

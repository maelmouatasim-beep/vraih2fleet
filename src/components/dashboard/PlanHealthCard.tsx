/**
 * Phase 5.6 — Carte « Santé du plan » (Accueil) : pour chaque projet
 * récent, niveau de santé et principales alertes de la surveillance
 * (calculées par le moteur, cf. src/lib/journey/surveillance.ts).
 */
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanSurveillance } from "@/hooks/usePlanSurveillance";
import type { ProjectDTO } from "@/lib/supabase/projects";
import { BadgeSante } from "@/components/journey/PlanAlertsPanel";
import { texteAlerte } from "@/components/journey/surveillanceTexts";
import { Activity, ArrowRight } from "lucide-react";

function LigneProjet({ project }: { project: ProjectDTO }) {
  const { t, i18n } = useTranslation();
  const langue = i18n.language.startsWith("en") ? "en" : "fr";
  const { alertes, sante } = usePlanSurveillance(project.id, project);
  if (!alertes || !sante) {
    return (
      <li className="py-3">
        <span className="font-medium">{project.name}</span>
      </li>
    );
  }
  const actives = alertes.filter((a) => !a.vue && a.gravite !== "info");
  return (
    <li className="py-3 space-y-1" data-testid="plan-health-project">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/dashboard/projects/${project.id}/suivi`} className="font-medium hover:underline">
          {project.name}
        </Link>
        <BadgeSante niveau={sante.niveau} />
        <span className="text-xs text-muted-foreground">
          {actives.length > 0 ? t("pages.dashboard.health.alerts", { count: actives.length }) : t("pages.dashboard.health.allGood")}
        </span>
      </div>
      {actives.length > 0 && (
        <ul className="text-sm text-muted-foreground list-disc pl-5">
          {actives.slice(0, 3).map((a) => (
            <li key={a.cle}>{texteAlerte(a, t, langue).titre}</li>
          ))}
          {actives.length > 3 && <li className="list-none -ml-5">{t("pages.dashboard.health.more", { count: actives.length - 3 })}</li>}
        </ul>
      )}
    </li>
  );
}

export default function PlanHealthCard({ projects }: { projects: ProjectDTO[] }) {
  const { t } = useTranslation();
  return (
    <Card data-testid="plan-health-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-muted-foreground" /> {t("pages.dashboard.health.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("pages.dashboard.health.subtitle")}</p>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pages.dashboard.health.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {projects.slice(0, 5).map((p) => (
              <LigneProjet key={p.id} project={p} />
            ))}
          </ul>
        )}
        {projects.length > 0 && (
          <Link to="/dashboard/projects" className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {t("pages.dashboard.health.open")} <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

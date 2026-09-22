import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Briefcase, FolderOpen, Target, ExternalLink } from "lucide-react";

interface AnalyticsContextBannerProps {
  mode: 'portfolio' | 'project' | 'scenario';
  projectName?: string;
  scenarioName?: string;
  projectId?: string;
  scenarioId?: string;
  projectCount: number;
  scenarioCount: number;
}

const AnalyticsContextBanner = ({
  mode,
  projectName,
  scenarioName,
  projectId,
  scenarioId,
  projectCount,
  scenarioCount,
}: AnalyticsContextBannerProps) => {
  const { t } = useTranslation();

  const configs = {
    portfolio: {
      icon: Briefcase,
      bgClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
      badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      title: t('analytics.context.portfolioTitle', 'Portfolio View'),
      description: t('analytics.context.portfolioDesc', '{{projectCount}} projects • {{scenarioCount}} scenarios analyzed', {
        projectCount,
        scenarioCount,
      }),
    },
    project: {
      icon: FolderOpen,
      bgClass: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
      badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      title: t('analytics.context.projectTitle', 'Project: {{name}}', { name: projectName }),
      description: t('analytics.context.projectDesc', '{{scenarioCount}} scenarios analyzed', {
        scenarioCount,
      }),
    },
    scenario: {
      icon: Target,
      bgClass: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
      badgeClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      title: t('analytics.context.scenarioTitle', 'Scenario: {{name}}', { name: scenarioName }),
      description: t('analytics.context.scenarioDesc', 'Project: {{projectName}}', { projectName }),
    },
  };

  const config = configs[mode];
  const Icon = config.icon;

  return (
    <Alert className={`${config.bgClass} border`}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-background/50">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{config.title}</span>
              <Badge className={config.badgeClass} variant="secondary">
                {mode === 'portfolio' && t('analytics.context.consolidated', 'Consolidated')}
                {mode === 'project' && t('analytics.context.filtered', 'Filtered')}
                {mode === 'scenario' && t('analytics.context.specific', 'Specific')}
              </Badge>
            </div>
            <AlertDescription className="text-sm opacity-80">
              {config.description}
            </AlertDescription>
          </div>
        </div>

        {mode === 'scenario' && scenarioId && projectId && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/dashboard/projects/${projectId}/scenarios/${scenarioId}/results`}>
              {t('analytics.context.viewDetails', 'View detailed results')}
              <ExternalLink className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        )}
      </div>
    </Alert>
  );
};

export default AnalyticsContextBanner;

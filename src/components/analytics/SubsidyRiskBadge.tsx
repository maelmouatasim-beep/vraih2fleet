import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface SubsidyRiskBadgeProps {
  riskPercent: number;
  totalSubsidies: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tcoTotal: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const SubsidyRiskBadge = ({ riskPercent, totalSubsidies, riskLevel, tcoTotal }: SubsidyRiskBadgeProps) => {
  const { t } = useTranslation();

  const config = {
    low: {
      variant: 'secondary' as const,
      icon: CheckCircle,
      label: t('analytics.subsidyRisk.low', 'Low risk'),
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
    },
    medium: {
      variant: 'secondary' as const,
      icon: AlertTriangle,
      label: t('analytics.subsidyRisk.medium', 'Moderate risk'),
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
    },
    high: {
      variant: 'secondary' as const,
      icon: AlertCircle,
      label: t('analytics.subsidyRisk.high', 'High risk'),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
    },
    critical: {
      variant: 'destructive' as const,
      icon: XCircle,
      label: t('analytics.subsidyRisk.critical', 'Critical risk'),
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
    },
  };

  const current = config[riskLevel];
  const Icon = current.icon;

  // Calculate TCO without subsidies
  const tcoWithoutSubsidies = tcoTotal + totalSubsidies;
  const increasePercent = tcoTotal > 0 ? Math.round((totalSubsidies / tcoTotal) * 100) : 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${current.bgColor}`}>
            <Icon className={`h-4 w-4 ${current.color}`} />
            <span className={`text-sm font-medium ${current.color}`}>
              {t('analytics.subsidyRisk.percentAtRisk', '{{percent}}% subsidy-dependent', { percent: riskPercent })}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs p-4">
          <div className="space-y-2">
            <p className="font-semibold">{t('analytics.subsidyRisk.title', 'Subsidy Risk Analysis')}</p>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">{t('analytics.subsidyRisk.totalSubsidies', 'Total subsidies')}:</span>{' '}
                <span className="font-medium">{formatCurrency(totalSubsidies)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{t('analytics.subsidyRisk.currentTco', 'Current TCO')}:</span>{' '}
                <span className="font-medium">{formatCurrency(tcoTotal)}</span>
              </p>
              <hr className="my-2" />
              <p className="font-medium text-destructive">
                {t('analytics.subsidyRisk.withoutSubsidies', 'Without subsidies')}: {formatCurrency(tcoWithoutSubsidies)} (+{increasePercent}%)
              </p>
            </div>
            {riskLevel === 'high' || riskLevel === 'critical' ? (
              <p className="text-xs text-muted-foreground mt-2">
                {t('analytics.subsidyRisk.warning', 'High dependency on subsidies. Consider planning for a scenario without government incentives.')}
              </p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SubsidyRiskBadge;

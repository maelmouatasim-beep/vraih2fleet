import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSubscription } from "@/hooks/useSubscription";
import { useEnhancedAnalytics, AnalyticsFilters } from "@/hooks/useEnhancedAnalytics";
import { useRealDataMetrics } from "@/hooks/useRealDataMetrics";
import { useCustomPricing } from "@/hooks/useCustomPricing";
import { getTotalInfrastructureInvestment } from "@/lib/supabase/infrastructure";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, BarChart3, Loader2, Building2, Layers, TrendingUp, Info, Sliders, Target } from "lucide-react";
import { ShareProjectButton } from "@/components/collaboration/ShareProjectButton";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Components
import AnalyticsFiltersComponent from "@/components/analytics/AnalyticsFilters";
import AnalyticsContextBanner from "@/components/analytics/AnalyticsContextBanner";
import KPIDashboard from "@/components/analytics/KPIDashboard";
import CostProjectionsChart from "@/components/analytics/CostProjectionsChart";
import FleetComparisonChart from "@/components/analytics/FleetComparisonChart";
import ROIChart from "@/components/analytics/ROIChart";
import TransitionScenariosCard from "@/components/analytics/TransitionScenariosCard";
import InvestmentBreakdownChart from "@/components/analytics/InvestmentBreakdownChart";
import DataQualityIndicator from "@/components/analytics/DataQualityIndicator";
import InfrastructureEconomics from "@/components/analytics/InfrastructureEconomics";
import ESGObjectivesTracker from "@/components/analytics/ESGObjectivesTracker";
import SubsidyRiskBadge from "@/components/analytics/SubsidyRiskBadge";
import OperatingCostBreakdownChart from "@/components/analytics/OperatingCostBreakdownChart";
import { EmptyStateWithAction } from "@/components/shared/DataProvenance";
import { AnalyticsPDFDownloadButton } from "@/components/reports/AnalyticsPDFDownloadButton";

const LockedAnalytics = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 p-4 bg-muted rounded-full w-fit">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">{t("analytics.locked.title", "Advanced Analytics")}</CardTitle>
          <CardDescription className="text-base">
            {t(
              "analytics.locked.description",
              "Advanced Analytics is available for Medium and Large Fleet plans. Upgrade to unlock detailed insights, charts, and fleet transition tracking."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/contact">{t("analytics.locked.upgrade", "Contact Us")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

const EmptyAnalytics = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 p-4 bg-muted rounded-full w-fit">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl">{t("analytics.empty.title", "No Data Yet")}</CardTitle>
          <CardDescription className="text-base">
            {t(
              "analytics.empty.description",
              "No data available yet. Create your first project to see analytics."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/dashboard/projects">{t("analytics.empty.createProject", "Create Project")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Empty state component for sections
const SectionEmptyState = ({ 
  icon: Icon, 
  message, 
  actionLabel, 
  actionHref 
}: { 
  icon: React.ElementType;
  message: string; 
  actionLabel: string; 
  actionHref: string;
}) => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mb-4">{message}</p>
      <Button asChild variant="outline">
        <Link to={actionHref}>{actionLabel}</Link>
      </Button>
    </CardContent>
  </Card>
);

// Data quality badge component
const DataQualityBadge = ({ quality, scenarioCount }: { quality: string; scenarioCount: number }) => {
  const { t } = useTranslation();
  
  const config = {
    excellent: { emoji: '🟢', label: t('analytics.quality.excellent', '5+ scenarios'), variant: 'default' as const },
    good: { emoji: '🟡', label: t('analytics.quality.good', '2-4 scenarios'), variant: 'secondary' as const },
    limited: { emoji: '🔴', label: t('analytics.quality.limited', '1 scenario'), variant: 'outline' as const },
    none: { emoji: '⚪', label: t('analytics.quality.none', 'No data'), variant: 'outline' as const },
  };
  
  const current = config[quality as keyof typeof config] || config.none;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant={current.variant} className="text-xs">
            {current.emoji} {scenarioCount > 0 ? `${scenarioCount} ${t('common.scenarios', 'scenarios')}` : current.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('analytics.quality.tooltip', 'Based on {{count}} scenarios with calculated TCO', { count: scenarioCount })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const AnalyticsDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectScenarios, setProjectScenarios] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    projectId: null,
    scenarioId: null,
  });
  const [infrastructureData, setInfrastructureData] = useState({
    totalCapex: 0,
    h2Capex: 0,
    evCapex: 0,
    totalOpex10y: 0,
  });

  const { kpis, costProjections, transitionScenarios, fleetComparison, roiData, annualOpexBreakdown, scenarioPrices, isLoading, hasData } = useEnhancedAnalytics(filters);
  const realDataMetrics = useRealDataMetrics();
  const customPricing = useCustomPricing();
  const hasOpexData = annualOpexBreakdown.length > 0;

  // Derive actual data availability from real metrics
  const hasScenarios = kpis.activeScenarios > 0;
  const hasVehicles = kpis.totalVehicles > 0;
  const hasTcoResults = kpis.sourceScenarioCount > 0;
  const hasInfrastructure = infrastructureData.totalCapex > 0;

  // Calculate current ZEV percent for ESG tracker
  const currentZevPercent = kpis.totalVehicles > 0 
    ? ((kpis.bevCount + kpis.fcevCount) / kpis.totalVehicles) * 100 
    : 0;

  // Determine context mode
  const contextMode: 'portfolio' | 'project' | 'scenario' = 
    filters.scenarioId ? 'scenario' : 
    filters.projectId ? 'project' : 
    'portfolio';

  const selectedProject = projects.find(p => p.id === filters.projectId);
  const selectedScenario = projectScenarios.find(s => s.id === filters.scenarioId);

  // Fetch projects and infrastructure data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      const [projectsData, infraData] = await Promise.all([
        supabase.from('projects').select('id, name').eq('user_id', user.id),
        getTotalInfrastructureInvestment(user.id).catch(() => ({ 
          totalCapex: 0, h2Capex: 0, evCapex: 0, totalOpex10y: 0 
        })),
      ]);
      
      setProjects(projectsData.data || []);
      setInfrastructureData(infraData);
    };
    
    fetchData();
  }, [user?.id]);

  // Fetch scenarios when project changes
  useEffect(() => {
    const fetchScenarios = async () => {
      if (!filters.projectId) {
        setProjectScenarios([]);
        return;
      }
      
      const { data } = await supabase
        .from('scenarios')
        .select('id, name')
        .eq('project_id', filters.projectId)
        .order('created_at', { ascending: false });
      
      setProjectScenarios(data || []);
    };
    
    fetchScenarios();
  }, [filters.projectId]);

  const handleExportExcel = () => {
    if (!hasData) {
      toast.error(t('analytics.export.noData', 'No data to export'));
      return;
    }
    
    const headers = ['Metric', 'Value', 'Source'];
    const rows = [
      ['Total Vehicles', kpis.totalVehicles, `${kpis.sourceScenarioCount} scenarios`],
      ['BEV Count', kpis.bevCount, ''],
      ['FCEV Count', kpis.fcevCount, ''],
      ['Diesel Count', kpis.dieselCount, ''],
      ['CO2 Reduction (t)', kpis.co2Reduction, ''],
      ['TCO Total ($)', kpis.totalTcoSum, 'Real tco_total from DB'],
      ['Payback Period (years)', kpis.avgPaybackYears, ''],
      ['Total Projects', kpis.totalProjects, ''],
      ['Active Scenarios', kpis.activeScenarios, ''],
    ];
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'h2fleet-analytics.csv';
    link.click();
    
    toast.success(t('analytics.export.excelSuccess', 'Excel exported successfully'));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasData) {
    return <EmptyAnalytics />;
  }

  return (
    <div className="space-y-6">
      {/* Context Banner */}
      <AnalyticsContextBanner
        mode={contextMode}
        projectName={selectedProject?.name}
        scenarioName={selectedScenario?.name}
        projectId={filters.projectId || undefined}
        scenarioId={filters.scenarioId || undefined}
        projectCount={kpis.totalProjects}
        scenarioCount={kpis.activeScenarios}
      />

      {/* Header with Share Button */}
      <div className="flex items-center justify-between">
        <AnalyticsFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          projects={projects}
          scenarios={projectScenarios}
          onExportExcel={handleExportExcel}
          kpis={kpis}
          mode={contextMode}
          projectName={selectedProject?.name}
          scenarioName={selectedScenario?.name}
        />
        {filters.projectId && (
          <ShareProjectButton projectId={filters.projectId} variant="outline" />
        )}
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">{t('analytics.tabs.overview', 'Synthèse')}</TabsTrigger>
          <TabsTrigger value="risks" className="flex items-center gap-1">
            <Sliders className="h-3 w-3" />
            {t('analytics.tabs.risks', 'Analyse de Risque')}
          </TabsTrigger>
          <TabsTrigger value="infrastructure" className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {t('analytics.tabs.infrastructure', 'Infrastructure')}
          </TabsTrigger>
          <TabsTrigger value="scenarios">{t('analytics.tabs.scenarios', 'Comparaison')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Custom Pricing Badge */}
          {customPricing.isCustom && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {t('analytics.usingCustomPricing', 'Custom pricing applied')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t('dashboard.energy.electricity', 'Electricity')}: ${customPricing.electricityPrice}/kWh • 
                H₂: ${customPricing.h2Price}/kg • 
                Diesel: ${customPricing.dieselPrice}/L
              </span>
            </div>
          )}
          
          {/* Subsidy Risk Badge + KPIs + ESG Tracker Row */}
          {kpis.subsidyRiskPercent > 0 && (
            <div className="flex justify-end">
              <SubsidyRiskBadge
                riskPercent={kpis.subsidyRiskPercent}
                totalSubsidies={kpis.totalSubsidies}
                riskLevel={kpis.subsidyRiskLevel}
                tcoTotal={kpis.totalTcoSum}
              />
            </div>
          )}
          
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {hasVehicles || hasScenarios ? (
                <KPIDashboard kpis={kpis} />
              ) : (
                <SectionEmptyState
                  icon={BarChart3}
                  message={t('analytics.noKpis', 'No KPI data available. Create scenarios to see metrics.')}
                  actionLabel={t('analytics.createScenario', 'Create Scenario')}
                  actionHref="/dashboard/projects"
                />
              )}
            </div>
            <div>
              <ESGObjectivesTracker 
                currentZevPercent={currentZevPercent}
                currentCo2Reduction={kpis.co2ReductionPercent}
              />
            </div>
          </div>

          {/* Operating Cost Breakdown Chart */}
          {hasOpexData && (
            <OperatingCostBreakdownChart data={annualOpexBreakdown} />
          )}
          
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Fleet Comparison */}
            {hasScenarios && fleetComparison.length > 0 ? (
              <FleetComparisonChart comparison={fleetComparison} />
            ) : (
              <SectionEmptyState
                icon={Layers}
                message={t('analytics.noFleetComparison', 'Create scenarios to compare fleet compositions.')}
                actionLabel={t('analytics.createScenario', 'Create Scenario')}
                actionHref="/dashboard/projects"
              />
            )}
            
            {/* Data Quality */}
            <DataQualityIndicator metrics={realDataMetrics} />
          </div>
          
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ROI Chart */}
            {hasTcoResults && roiData.length > 0 ? (
              <ROIChart 
                data={roiData} 
                initialCapex={kpis.totalCapex}
              />
            ) : (
              <SectionEmptyState
                icon={TrendingUp}
                message={t('analytics.noRoi', 'Calculate TCO for scenarios to see ROI projections.')}
                actionLabel={t('analytics.goToScenarios', 'View Scenarios')}
                actionHref="/dashboard/projects"
              />
            )}
            
            {/* Investment Breakdown */}
            {(hasVehicles || hasInfrastructure || kpis.totalCapex > 0) ? (
              <InvestmentBreakdownChart
                vehicleCost={kpis.totalCapex}
                h2StationsCost={infrastructureData.h2Capex}
                evChargersCost={infrastructureData.evCapex}
                operationsCost={kpis.totalOpex > 0 ? kpis.totalOpex : infrastructureData.totalOpex10y}
                isCalculatedData={kpis.totalCapex > 0}
              />
            ) : (
              <SectionEmptyState
                icon={Building2}
                message={t('analytics.noInvestment', 'No investment data. Create infrastructure plans.')}
                actionLabel={t('analytics.goToInfrastructure', 'Plan Infrastructure')}
                actionHref="/dashboard/infrastructure"
              />
            )}
          </div>
        </TabsContent>

        {/* Risk Analysis Tab (unified What-If + Sensitivity) */}
        <TabsContent value="risks" className="space-y-6">
          {/* Le stress test vit désormais dans l'étape Stratégies du parcours
              projet, branché sur le moteur TCO (sensitivity.ts). */}
          <SectionEmptyState
            icon={Sliders}
            message={t('analytics.riskMoved')}
            actionLabel={t('analytics.riskMovedCta')}
            actionHref="/dashboard/projects"
          />
          {hasTcoResults && costProjections.length > 0 && (
            <CostProjectionsChart projections={costProjections} />
          )}
        </TabsContent>

        {/* Infrastructure Tab */}
        <TabsContent value="infrastructure" className="space-y-6">
          {hasInfrastructure ? (
            <>
              <InfrastructureEconomics />
              <InvestmentBreakdownChart
                vehicleCost={kpis.totalCapex}
                h2StationsCost={infrastructureData.h2Capex}
                evChargersCost={infrastructureData.evCapex}
                operationsCost={kpis.totalOpex > 0 ? kpis.totalOpex : infrastructureData.totalOpex10y}
                isCalculatedData={kpis.totalCapex > 0}
              />
            </>
          ) : (
            <SectionEmptyState
              icon={Building2}
              message={t('analytics.noInfrastructureData', 'No infrastructure plans created yet. Plan your charging and H₂ infrastructure.')}
              actionLabel={t('analytics.goToInfrastructure', 'Plan Infrastructure')}
              actionHref="/dashboard/infrastructure"
            />
          )}
        </TabsContent>

        {/* Scenarios Comparison Tab */}
        <TabsContent value="scenarios" className="space-y-6">
          {transitionScenarios.length > 0 ? (
            <>
              <TransitionScenariosCard scenarios={transitionScenarios} />
              {fleetComparison.length > 0 && <FleetComparisonChart comparison={fleetComparison} />}
            </>
          ) : (
            <SectionEmptyState
              icon={Layers}
              message={t('analytics.noScenarios', 'No scenario data available. Create transition scenarios to compare.')}
              actionLabel={t('analytics.createScenario', 'Create Scenario')}
              actionHref="/dashboard/projects"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Analytics = () => {
  const { t } = useTranslation();
  const { canAccessFeature, isLoading } = useSubscription();

  const hasAccess = canAccessFeature("advanced_analytics");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("analytics.title", "Analytics")}</h1>
          <p className="text-muted-foreground">
            {t("analytics.description", "Vue consolidée de votre portfolio de transition")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : hasAccess ? (
          <AnalyticsDashboard />
        ) : (
          <LockedAnalytics />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Analytics;

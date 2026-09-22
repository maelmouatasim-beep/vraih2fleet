import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Filter, ChevronRight } from "lucide-react";
import { AnalyticsFilters as FiltersType, KPIMetrics } from "@/hooks/useEnhancedAnalytics";
import { AnalyticsPDFDownloadButton } from "@/components/reports/AnalyticsPDFDownloadButton";

interface AnalyticsFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  projects: { id: string; name: string }[];
  scenarios: { id: string; name: string }[];
  onExportExcel: () => void;
  kpis: KPIMetrics;
  mode: 'portfolio' | 'project' | 'scenario';
  projectName?: string;
  scenarioName?: string;
}

const AnalyticsFiltersComponent = ({
  filters,
  onFiltersChange,
  projects,
  scenarios,
  onExportExcel,
  kpis,
  mode,
  projectName,
  scenarioName,
}: AnalyticsFiltersProps) => {
  const { t } = useTranslation();

  const handleProjectChange = (value: string) => {
    const projectId = value === 'all' ? null : value;
    // Reset scenario when project changes
    onFiltersChange({ 
      projectId, 
      scenarioId: null 
    });
  };

  const handleScenarioChange = (value: string) => {
    onFiltersChange({ 
      ...filters, 
      scenarioId: value === 'all' ? null : value 
    });
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t('analytics.filters.title', 'Filters')}</span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            {/* Project Selector */}
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs">{t('analytics.filters.project', 'Project')}</Label>
              <Select
                value={filters.projectId || 'all'}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('analytics.filters.selectProject', 'Select...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      📊 {t('analytics.filters.allProjects', 'Full Portfolio')}
                    </span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        📁 {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scenario Selector - Only visible when project is selected */}
            {filters.projectId && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground mt-5" />
                <div className="space-y-1.5 min-w-[200px]">
                  <Label className="text-xs">{t('analytics.filters.scenario', 'Scenario')}</Label>
                  <Select
                    value={filters.scenarioId || 'all'}
                    onValueChange={handleScenarioChange}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t('analytics.filters.selectScenario', 'Select...')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          📋 {t('analytics.filters.allScenarios', 'All scenarios')}
                        </span>
                      </SelectItem>
                      {scenarios.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            🎯 {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <AnalyticsPDFDownloadButton
              kpis={kpis}
              mode={mode}
              projectName={projectName}
              scenarioName={scenarioName}
              variant="outline"
              size="sm"
            />
            <Button variant="outline" size="sm" onClick={onExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticsFiltersComponent;

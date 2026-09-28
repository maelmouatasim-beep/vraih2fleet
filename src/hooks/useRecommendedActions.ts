import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { 
  FolderPlus, 
  Calculator, 
  Truck, 
  CalendarClock, 
  Map, 
  Zap,
  type LucideIcon 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays } from "date-fns";

export interface RecommendedAction {
  id: string;
  type: 'project' | 'scenario' | 'tco' | 'telematics' | 'subsidy' | 'roadmap' | 'wizard';
  priority: 'urgent' | 'high' | 'medium';
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  badge?: { text: string; variant: 'destructive' | 'warning' | 'default' };
}

export const useRecommendedActions = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['recommended-actions-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch scenarios
  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery({
    queryKey: ['recommended-actions-scenarios', user?.id],
    queryFn: async () => {
      if (!user?.id || projects.length === 0) return [];
      const projectIds = projects.map(p => p.id);
      const { data, error } = await supabase
        .from('scenarios')
        .select('id, name, project_id')
        .in('project_id', projectIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && projects.length > 0,
  });

  // Fetch TCO results
  const { data: tcoResults = [], isLoading: tcoLoading } = useQuery({
    queryKey: ['recommended-actions-tco', user?.id],
    queryFn: async () => {
      if (!user?.id || scenarios.length === 0) return [];
      const scenarioIds = scenarios.map(s => s.id);
      const { data, error } = await supabase
        .from('tco_results')
        .select('scenario_id')
        .in('scenario_id', scenarioIds)
        .eq('is_current', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && scenarios.length > 0,
  });

  // Fetch roadmaps
  const { data: roadmaps = [], isLoading: roadmapsLoading } = useQuery({
    queryKey: ['recommended-actions-roadmaps', user?.id],
    queryFn: async () => {
      if (!user?.id || projects.length === 0) return [];
      const projectIds = projects.map(p => p.id);
      const { data, error } = await supabase
        .from('transition_roadmaps')
        .select('id, project_id')
        .in('project_id', projectIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && projects.length > 0,
  });

  // Fetch expiring subsidies
  const { data: expiringSubsidies = [], isLoading: subsidiesLoading } = useQuery({
    queryKey: ['recommended-actions-subsidies'],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 60);
      
      const { data, error } = await supabase
        .from('incentives_programs')
        .select('id, program_name_en, program_name_fr, deadline')
        .eq('status', 'active')
        .not('deadline', 'is', null)
        .lte('deadline', thirtyDaysFromNow.toISOString())
        .gte('deadline', new Date().toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const isLoading = projectsLoading || scenariosLoading || tcoLoading || roadmapsLoading || subsidiesLoading;

  const actions = useMemo(() => {
    const result: RecommendedAction[] = [];
    const language = t('language') === 'fr' ? 'fr' : 'en';

    // 1. No projects → suggest wizard
    if (projects.length === 0) {
      result.push({
        id: 'create-first-project',
        type: 'wizard',
        priority: 'high',
        icon: FolderPlus,
        title: t('recommendedActions.createFirstProject.title', 'Create your first project'),
        description: t('recommendedActions.createFirstProject.description', 'Start with our guided wizard to create a complete transition plan'),
        actionLabel: t('recommendedActions.createFirstProject.action', 'Start Wizard'),
        href: '/dashboard/wizard',
      });
      return result;
    }

    // 2. Expiring subsidies (urgent)
    expiringSubsidies.forEach(subsidy => {
      const daysLeft = differenceInDays(new Date(subsidy.deadline!), new Date());
      const programName = language === 'fr' ? subsidy.program_name_fr : subsidy.program_name_en;
      
      result.push({
        id: `subsidy-${subsidy.id}`,
        type: 'subsidy',
        priority: daysLeft <= 30 ? 'urgent' : 'high',
        icon: CalendarClock,
        title: t('recommendedActions.subsidyExpiring.title', '{{program}} expires soon', { program: programName }),
        description: t('recommendedActions.subsidyExpiring.description', '{{days}} days left to apply', { days: daysLeft }),
        actionLabel: t('recommendedActions.subsidyExpiring.action', 'View details'),
        href: '/dashboard/projects',
        badge: daysLeft <= 30 
          ? { text: t('recommendedActions.urgent', 'URGENT'), variant: 'destructive' as const }
          : { text: t('recommendedActions.expiringSoon', '{{days}}d left', { days: daysLeft }), variant: 'warning' as const },
      });
    });

    // 3. Projects without scenarios
    const projectsWithScenarios = new Set(scenarios.map(s => s.project_id));
    projects.forEach(project => {
      if (!projectsWithScenarios.has(project.id)) {
        result.push({
          id: `scenario-for-${project.id}`,
          type: 'scenario',
          priority: 'high',
          icon: Calculator,
          title: t('recommendedActions.addScenario.title', 'Add scenario to {{project}}', { project: project.name }),
          description: t('recommendedActions.addScenario.description', 'Create a TCO scenario to analyze transition options'),
          actionLabel: t('recommendedActions.addScenario.action', 'Create scenario'),
          href: `/dashboard/projects/${project.id}/scenarios/new`,
        });
      }
    });

    // 4. Scenarios without TCO results
    const scenariosWithTco = new Set(tcoResults.map(r => r.scenario_id));
    scenarios.forEach(scenario => {
      if (!scenariosWithTco.has(scenario.id)) {
        result.push({
          id: `tco-for-${scenario.id}`,
          type: 'tco',
          priority: 'high',
          icon: Zap,
          title: t('recommendedActions.calculateTco.title', 'Calculate TCO for {{scenario}}', { scenario: scenario.name }),
          description: t('recommendedActions.calculateTco.description', 'Run the calculation to see detailed cost analysis'),
          actionLabel: t('recommendedActions.calculateTco.action', 'Calculate'),
          href: `/dashboard/scenarios/${scenario.id}`,
        });
      }
    });

    // 5. Projects with TCO but no roadmap
    const projectsWithRoadmaps = new Set(roadmaps.map(r => r.project_id));
    const projectsWithCompletedTco = new Set(
      scenarios
        .filter(s => scenariosWithTco.has(s.id))
        .map(s => s.project_id)
    );
    
    projects.forEach(project => {
      if (projectsWithCompletedTco.has(project.id) && !projectsWithRoadmaps.has(project.id)) {
        result.push({
          id: `roadmap-for-${project.id}`,
          type: 'roadmap',
          priority: 'medium',
          icon: Map,
          title: t('recommendedActions.createRoadmap.title', 'Plan transition for {{project}}', { project: project.name }),
          description: t('recommendedActions.createRoadmap.description', 'Create a roadmap with phases and milestones'),
          actionLabel: t('recommendedActions.createRoadmap.action', 'Create roadmap'),
          href: '/dashboard/roadmap',
        });
      }
    });

    // 6. Suggest telematics if no connection (medium priority)
    // Note: We'd need to add telematics_connections query for this
    // For now, add a general telematics suggestion if there are projects
    if (projects.length > 0 && result.length < 4) {
      result.push({
        id: 'connect-telematics',
        type: 'telematics',
        priority: 'medium',
        icon: Truck,
        title: t('recommendedActions.connectTelematics.title', 'Connect your fleet'),
        description: t('recommendedActions.connectTelematics.description', 'Import real data from Geotab or Samsara'),
        actionLabel: t('recommendedActions.connectTelematics.action', 'Connect'),
        href: '/dashboard/telematics',
      });
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2 };
    result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return result.slice(0, 4); // Max 4 actions
  }, [projects, scenarios, tcoResults, roadmaps, expiringSubsidies, t]);

  return {
    actions,
    isLoading,
    totalActions: actions.length,
  };
};

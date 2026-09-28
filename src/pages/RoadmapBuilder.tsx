import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { parseISO, addMonths } from 'date-fns';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Layers, ListTodo, Calendar, CheckSquare, CheckCircle2, Clock, PlayCircle, Ban, XCircle } from 'lucide-react';
import { ShareProjectButton } from '@/components/collaboration/ShareProjectButton';
import {
  GanttChart,
  PhaseForm,
  MilestoneForm,
  RoadmapHeader,
  RoadmapForm,
} from '@/components/roadmap';
import {
  useProjectRoadmaps,
  useRoadmap,
  useRoadmapMutations,
  calculateCriticalPath,
  Phase,
  Milestone,
} from '@/hooks/useRoadmap';
import { listProjects } from '@/lib/supabase/projects';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useMilestoneTaskCounts } from '@/hooks/useMilestoneTaskCounts';

const RoadmapBuilder: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get('projectId')
  );
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const [showRoadmapForm, setShowRoadmapForm] = useState(false);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | undefined>();
  const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>();
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | undefined>();

  // Fetch projects
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: () => listProjects(),
    enabled: !!user?.id,
  });

  // Fetch roadmaps for selected project
  const { data: roadmaps, isLoading: roadmapsLoading } = useProjectRoadmaps(selectedProjectId || undefined);

  // Fetch selected roadmap details
  const { roadmap, phases, milestones, isLoading: roadmapLoading } = useRoadmap(selectedRoadmapId || undefined);

  // Mutations
  const {
    createRoadmap,
    updateRoadmap,
    deleteRoadmap,
    createPhase,
    updatePhase,
    deletePhase,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  } = useRoadmapMutations();

  // Calculate critical path
  const criticalPath = useMemo(() => 
    calculateCriticalPath(milestones),
    [milestones]
  );

  // Get task counts for milestones
  const milestoneIds = useMemo(() => milestones.map(m => m.id), [milestones]);
  const { getCount: getMilestoneTaskCount } = useMilestoneTaskCounts(milestoneIds);

  // Gantt chart date range
  const ganttDates = useMemo(() => {
    if (!roadmap) {
      const now = new Date();
      return { start: now, end: addMonths(now, 12) };
    }
    return {
      start: parseISO(roadmap.start_date),
      end: parseISO(roadmap.end_date),
    };
  }, [roadmap]);

  // Handlers
  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedRoadmapId(null);
    setSearchParams({ projectId });
  };

  const handleRoadmapChange = (roadmapId: string) => {
    setSelectedRoadmapId(roadmapId);
  };

  const handleCreateRoadmap = async (data: Parameters<typeof createRoadmap.mutate>[0]) => {
    if (!selectedProjectId) return;
    createRoadmap.mutate({
      ...data,
      project_id: selectedProjectId,
    }, {
      onSuccess: (newRoadmap) => {
        setSelectedRoadmapId(newRoadmap.id);
      },
    });
  };

  const handleCreatePhase = async (data: Parameters<typeof createPhase.mutate>[0]) => {
    if (!selectedRoadmapId) return;
    createPhase.mutate({
      ...data,
      roadmap_id: selectedRoadmapId,
      order_index: phases.length + 1,
    });
  };

  const handleCreateMilestone = async (data: Parameters<typeof createMilestone.mutate>[0]) => {
    createMilestone.mutate(data);
  };

  const handlePhaseClick = (phase: Phase) => {
    setEditingPhase(phase);
    setShowPhaseForm(true);
  };

  const handleMilestoneClick = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setShowMilestoneForm(true);
  };

  const handleDeleteRoadmap = () => {
    if (!selectedRoadmapId) return;
    if (confirm(t('roadmap.deleteConfirm', 'Are you sure you want to delete this roadmap?'))) {
      deleteRoadmap.mutate(selectedRoadmapId, {
        onSuccess: () => setSelectedRoadmapId(null),
      });
    }
  };

  // Empty state when no project selected
  if (!selectedProjectId && !projectsLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">{t('roadmap.title', 'Roadmap Builder')}</h1>
            <p className="text-muted-foreground">
              {t('roadmap.subtitle', 'Plan and track your fleet transition milestones')}
            </p>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <Calendar className="w-12 h-12 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold">
                  {t('roadmap.selectProject', 'Select a project to get started')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t('roadmap.selectProjectDesc', 'Choose a project to create or view its transition roadmap with phases and milestones.')}
                </p>
              </div>
              <Select onValueChange={handleProjectChange}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t('roadmap.chooseProject', 'Choose a project...')} />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('roadmap.title', 'Roadmap Builder')}</h1>
            <p className="text-muted-foreground">
              {t('roadmap.subtitle', 'Plan and track your fleet transition milestones')}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Project Selector */}
            <Select value={selectedProjectId || ''} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('roadmap.selectProject', 'Select project')} />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Roadmap Selector */}
            {roadmaps && roadmaps.length > 0 && (
              <Select value={selectedRoadmapId || ''} onValueChange={handleRoadmapChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('roadmap.selectRoadmap', 'Select roadmap')} />
                </SelectTrigger>
                <SelectContent>
                  {roadmaps.map((rm) => (
                    <SelectItem key={rm.id} value={rm.id}>
                      {rm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Create Roadmap Button */}
            <Button onClick={() => setShowRoadmapForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('roadmap.createRoadmap', 'New Roadmap')}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {(roadmapsLoading || roadmapLoading) && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}

        {/* No Roadmaps */}
        {!roadmapsLoading && selectedProjectId && (!roadmaps || roadmaps.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <Layers className="w-12 h-12 text-muted-foreground" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold">
                  {t('roadmap.noRoadmaps', 'No roadmaps yet')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {t('roadmap.noRoadmapsDesc', 'Create your first roadmap to start planning your fleet transition.')}
                </p>
              </div>
              <Button onClick={() => setShowRoadmapForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                {t('roadmap.createFirst', 'Create First Roadmap')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Roadmap Content */}
        {roadmap && (
          <>
            <RoadmapHeader
              roadmap={roadmap}
              phases={phases}
              milestones={milestones}
              onEdit={() => setShowRoadmapForm(true)}
              onDelete={handleDeleteRoadmap}
            />

            <Tabs defaultValue="gantt" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="gantt" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    {t('roadmap.tabs.gantt', 'Gantt Chart')}
                  </TabsTrigger>
                  <TabsTrigger value="list" className="gap-2">
                    <ListTodo className="w-4 h-4" />
                    {t('roadmap.tabs.list', 'List View')}
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  {selectedProjectId && (
                    <ShareProjectButton projectId={selectedProjectId} variant="outline" size="sm" />
                  )}
                  <Button variant="outline" onClick={() => {
                    setEditingPhase(undefined);
                    setShowPhaseForm(true);
                  }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t('roadmap.addPhase', 'Add Phase')}
                  </Button>
                  <Button onClick={() => {
                    setEditingMilestone(undefined);
                    setShowMilestoneForm(true);
                  }} className="gap-2" disabled={phases.length === 0}>
                    <Plus className="w-4 h-4" />
                    {t('roadmap.addMilestone', 'Add Milestone')}
                  </Button>
                </div>
              </div>

              <TabsContent value="gantt">
                <GanttChart
                  phases={phases}
                  milestones={milestones}
                  startDate={ganttDates.start}
                  endDate={ganttDates.end}
                  criticalPath={criticalPath}
                  onPhaseClick={handlePhaseClick}
                  onMilestoneClick={handleMilestoneClick}
                />
              </TabsContent>

              <TabsContent value="list">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('roadmap.listView', 'Milestones List')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {phases.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {t('roadmap.noPhasesYet', 'Add phases to start organizing your milestones.')}
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {phases.map((phase) => {
                          const phaseMilestones = milestones.filter(m => m.phase_id === phase.id);
                          return (
                            <div key={phase.id} className="space-y-3">
                              <div 
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                                onClick={() => handlePhaseClick(phase)}
                              >
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: phase.color || 'hsl(var(--primary))' }}
                                />
                                <h3 className="font-semibold">{phase.name}</h3>
                                <Badge variant="outline">{phaseMilestones.length} {t('roadmap.milestones', 'milestones')}</Badge>
                              </div>
                              
                                {phaseMilestones.length > 0 ? (
                                <div className="ml-6 space-y-2">
                                  {phaseMilestones.map((milestone) => {
                                    const taskCount = getMilestoneTaskCount(milestone.id);
                                    const getStatusIcon = () => {
                                      switch (milestone.status) {
                                        case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
                                        case 'in_progress': return <PlayCircle className="w-4 h-4 text-blue-500" />;
                                        case 'blocked': return <Ban className="w-4 h-4 text-red-500" />;
                                        case 'cancelled': return <XCircle className="w-4 h-4 text-muted-foreground" />;
                                        default: return <Clock className="w-4 h-4 text-muted-foreground" />;
                                      }
                                    };
                                    const getStatusLabel = () => {
                                      switch (milestone.status) {
                                        case 'completed': return t('roadmap.milestone.status.completed', 'Terminé');
                                        case 'in_progress': return t('roadmap.milestone.status.inProgress', 'En cours');
                                        case 'blocked': return t('roadmap.milestone.status.blocked', 'Bloqué');
                                        case 'cancelled': return t('roadmap.milestone.status.cancelled', 'Annulé');
                                        default: return t('roadmap.milestone.status.notStarted', 'Non démarré');
                                      }
                                    };
                                    return (
                                      <div
                                        key={milestone.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                      >
                                        <div 
                                          className="flex items-center gap-3 flex-1 cursor-pointer"
                                          onClick={() => handleMilestoneClick(milestone)}
                                        >
                                          {getStatusIcon()}
                                          <span className={milestone.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                                            {milestone.title}
                                          </span>
                                          <Badge variant="secondary" className="text-xs">
                                            {getStatusLabel()}
                                          </Badge>
                                          {taskCount.count > 0 && (
                                            <Badge variant="outline" className="text-xs gap-1">
                                              <CheckSquare className="w-3 h-3" />
                                              {taskCount.completed}/{taskCount.count}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {milestone.status !== 'completed' && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateMilestone.mutate({ 
                                                  id: milestone.id, 
                                                  status: 'completed' 
                                                });
                                                toast({
                                                  title: t('roadmap.milestone.completedToast', '🎉 Jalon terminé !'),
                                                  description: milestone.title,
                                                });
                                              }}
                                            >
                                              <CheckCircle2 className="w-3 h-3 mr-1" />
                                              {t('roadmap.milestone.markComplete', 'Valider')}
                                            </Button>
                                          )}
                                          {taskCount.count > 0 && (
                                            <Link
                                              to={`/dashboard/projects/${selectedProjectId}?tab=tasks`}
                                              onClick={(e) => e.stopPropagation()}
                                              className="text-xs text-primary hover:underline"
                                            >
                                              {t('roadmap.milestone.viewTasks', 'Voir tâches')}
                                            </Link>
                                          )}
                                          <span className="text-sm text-muted-foreground">
                                            {new Date(milestone.due_date).toLocaleDateString()}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="ml-6 text-sm text-muted-foreground">
                                  {t('roadmap.noMilestonesInPhase', 'No milestones in this phase yet.')}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Modals */}
      <RoadmapForm
        open={showRoadmapForm}
        onClose={() => setShowRoadmapForm(false)}
        onSubmit={handleCreateRoadmap}
        roadmap={selectedRoadmapId ? roadmap : undefined}
        isLoading={createRoadmap.isPending}
      />

      <PhaseForm
        open={showPhaseForm}
        onClose={() => {
          setShowPhaseForm(false);
          setEditingPhase(undefined);
        }}
        onSubmit={(data) => {
          if (editingPhase) {
            updatePhase.mutate({ id: editingPhase.id, ...data });
          } else {
            handleCreatePhase(data as any);
          }
          setShowPhaseForm(false);
          setEditingPhase(undefined);
        }}
        phase={editingPhase}
        defaultStartDate={roadmap?.start_date}
        defaultEndDate={roadmap?.end_date}
        isLoading={createPhase.isPending || updatePhase.isPending}
      />

      <MilestoneForm
        open={showMilestoneForm}
        onClose={() => {
          setShowMilestoneForm(false);
          setEditingMilestone(undefined);
        }}
        onSubmit={(data) => {
          if (editingMilestone) {
            updateMilestone.mutate({ id: editingMilestone.id, ...data });
          } else {
            handleCreateMilestone(data);
          }
          setShowMilestoneForm(false);
          setEditingMilestone(undefined);
        }}
        phases={phases}
        milestone={editingMilestone}
        defaultPhaseId={selectedPhaseId}
        isLoading={createMilestone.isPending || updateMilestone.isPending}
        projectId={selectedProjectId || undefined}
      />
    </DashboardLayout>
  );
};

export default RoadmapBuilder;

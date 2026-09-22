import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Map, CheckCircle2, ExternalLink, PartyPopper } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { addMonths, format } from "date-fns";

interface WizardRoadmapStepProps {
  projectId: string;
  scenarioId: string;
  onBack: () => void;
}

const WizardRoadmapStep = ({ projectId, scenarioId, onBack }: WizardRoadmapStepProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [roadmapName, setRoadmapName] = useState('');
  const [isCreated, setIsCreated] = useState(false);
  const [createdRoadmapId, setCreatedRoadmapId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const now = new Date();
      const endDate = addMonths(now, 36); // 3-year roadmap

      // Create roadmap
      const { data: roadmap, error: roadmapError } = await supabase
        .from('transition_roadmaps')
        .insert({
          name: roadmapName.trim() || t('wizard.roadmap.defaultName', 'Transition Roadmap'),
          project_id: projectId,
          user_id: user.id,
          start_date: format(now, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          status: 'draft',
        })
        .select()
        .single();

      if (roadmapError) throw roadmapError;

      // Create default phases
      const phases = [
        { name: t('wizard.roadmap.phase1', 'Phase 1: Planning'), months: 6, order: 0 },
        { name: t('wizard.roadmap.phase2', 'Phase 2: Procurement'), months: 12, order: 1 },
        { name: t('wizard.roadmap.phase3', 'Phase 3: Deployment'), months: 18, order: 2 },
      ];

      let currentStart = now;
      for (const phase of phases) {
        const phaseEnd = addMonths(currentStart, phase.months);
        
        await supabase
          .from('roadmap_phases')
          .insert({
            roadmap_id: roadmap.id,
            name: phase.name,
            start_date: format(currentStart, 'yyyy-MM-dd'),
            end_date: format(phaseEnd, 'yyyy-MM-dd'),
            order_index: phase.order,
            status: phase.order === 0 ? 'in_progress' : 'not_started',
          });

        currentStart = phaseEnd;
      }

      return roadmap;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] });
      setCreatedRoadmapId(data.id);
      setIsCreated(true);
      toast({
        title: t('wizard.roadmap.created', 'Roadmap created!'),
        description: t('wizard.roadmap.createdDesc', 'Your transition roadmap is ready'),
      });
    },
    onError: (error) => {
      console.error('Create roadmap error:', error);
      toast({
        title: t('wizard.roadmap.error', 'Error'),
        description: t('wizard.roadmap.errorDesc', 'Failed to create roadmap'),
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    createMutation.mutate();
  };

  const handleFinish = () => {
    navigate(`/dashboard/projects/${projectId}`);
  };

  const handleOpenRoadmap = () => {
    if (createdRoadmapId) {
      navigate(`/dashboard/roadmap?roadmapId=${createdRoadmapId}`);
    }
  };

  if (isCreated) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
            <PartyPopper className="w-10 h-10 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t('wizard.complete.title', 'Transition Plan Complete!')}
          </h2>
          <p className="text-muted-foreground">
            {t('wizard.complete.subtitle', 'Your project, scenario, and roadmap are ready')}
          </p>
        </div>

        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="py-8 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-accent">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-medium">{t('wizard.complete.success', 'All steps completed successfully')}</span>
            </div>
            <p className="text-muted-foreground">
              {t('wizard.complete.nextSteps', 'You can now view your project details or customize your roadmap')}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button variant="outline" onClick={handleOpenRoadmap} className="gap-2">
            <Map className="w-4 h-4" />
            {t('wizard.complete.openRoadmap', 'Open Roadmap')}
            <ExternalLink className="w-3 h-3" />
          </Button>
          <Button onClick={handleFinish} size="lg">
            {t('wizard.complete.viewProject', 'View Project')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t('wizard.roadmap.title', 'Step 5: Roadmap')}
        </h2>
        <p className="text-muted-foreground">
          {t('wizard.roadmap.subtitle', 'Create a transition roadmap with phases and milestones')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Map className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>{t('wizard.roadmap.createTitle', 'Create Transition Roadmap')}</CardTitle>
              <CardDescription>
                {t('wizard.roadmap.createDesc', 'A 3-year roadmap will be generated with default phases')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roadmap-name">{t('wizard.roadmap.nameLabel', 'Roadmap Name (optional)')}</Label>
            <Input
              id="roadmap-name"
              value={roadmapName}
              onChange={(e) => setRoadmapName(e.target.value)}
              placeholder={t('wizard.roadmap.namePlaceholder', 'e.g., Fleet Electrification 2025-2028')}
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">{t('wizard.roadmap.willCreate', 'This will create:')}</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t('wizard.roadmap.phase1Desc', 'Phase 1: Planning (6 months)')}</li>
              <li>• {t('wizard.roadmap.phase2Desc', 'Phase 2: Procurement (12 months)')}</li>
              <li>• {t('wizard.roadmap.phase3Desc', 'Phase 3: Deployment (18 months)')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('wizard.back', 'Back')}
        </Button>
        <Button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          size="lg"
        >
          {createMutation.isPending 
            ? t('wizard.creating', 'Creating...') 
            : t('wizard.createRoadmap', 'Create Roadmap')
          }
        </Button>
      </div>
    </div>
  );
};

export default WizardRoadmapStep;

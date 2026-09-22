import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, FolderOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface WizardProjectStepProps {
  onComplete: (projectId: string) => void;
}

const WizardProjectStep = ({ onComplete }: WizardProjectStepProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'select' | 'create'>('create');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Fetch existing projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['wizard-projects', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          description: projectDescription.trim() || null,
          user_id: user.id,
          country_or_region: 'Canada',
          currency: 'CAD',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wizard-projects'] });
      toast({
        title: t('wizard.project.created', 'Project created'),
        description: t('wizard.project.createdDesc', 'Your project has been created successfully'),
      });
      onComplete(data.id);
    },
    onError: (error) => {
      console.error('Create project error:', error);
      toast({
        title: t('wizard.project.error', 'Error'),
        description: t('wizard.project.errorDesc', 'Failed to create project'),
        variant: 'destructive',
      });
    },
  });

  const handleContinue = () => {
    if (mode === 'select' && selectedProjectId) {
      onComplete(selectedProjectId);
    } else if (mode === 'create' && projectName.trim()) {
      createMutation.mutate();
    }
  };

  const canContinue = mode === 'select' 
    ? !!selectedProjectId 
    : projectName.trim().length >= 3;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {t('wizard.project.title', 'Step 1: Project')}
        </h2>
        <p className="text-muted-foreground">
          {t('wizard.project.subtitle', 'Select an existing project or create a new one')}
        </p>
      </div>

      {projects.length > 0 && (
        <div className="flex gap-4 justify-center mb-6">
          <Button
            variant={mode === 'create' ? 'default' : 'outline'}
            onClick={() => setMode('create')}
            className="gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            {t('wizard.project.newProject', 'New Project')}
          </Button>
          <Button
            variant={mode === 'select' ? 'default' : 'outline'}
            onClick={() => setMode('select')}
            className="gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            {t('wizard.project.existingProject', 'Existing Project')}
          </Button>
        </div>
      )}

      {mode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('wizard.project.createTitle', 'Create New Project')}</CardTitle>
            <CardDescription>
              {t('wizard.project.createDesc', 'Give your transition project a name and description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">{t('wizard.project.nameLabel', 'Project Name')} *</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={t('wizard.project.namePlaceholder', 'e.g., Fleet Electrification 2025')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">{t('wizard.project.descLabel', 'Description (optional)')}</Label>
              <Textarea
                id="project-desc"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder={t('wizard.project.descPlaceholder', 'Brief description of your transition project...')}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('wizard.project.selectTitle', 'Select Existing Project')}</CardTitle>
            <CardDescription>
              {t('wizard.project.selectDesc', 'Choose a project to add a new scenario')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <RadioGroup
                value={selectedProjectId || ''}
                onValueChange={setSelectedProjectId}
                className="space-y-2"
              >
                {projects.map(project => (
                  <div
                    key={project.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <RadioGroupItem value={project.id} id={project.id} />
                    <Label htmlFor={project.id} className="flex-1 cursor-pointer">
                      <p className="font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleContinue}
          disabled={!canContinue || createMutation.isPending}
          size="lg"
        >
          {createMutation.isPending 
            ? t('wizard.creating', 'Creating...') 
            : t('wizard.continue', 'Continue')
          }
        </Button>
      </div>
    </div>
  );
};

export default WizardProjectStep;

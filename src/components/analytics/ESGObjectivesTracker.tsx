import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Target, Settings, TrendingUp, AlertTriangle, CheckCircle2, Leaf } from "lucide-react";
import { useUserObjectives } from "@/hooks/useUserObjectives";
import { toast } from "sonner";

interface ESGObjectivesTrackerProps {
  currentZevPercent: number;
  currentCo2Reduction: number;
}

const ESGObjectivesTracker = ({ currentZevPercent, currentCo2Reduction }: ESGObjectivesTrackerProps) => {
  const { t } = useTranslation();
  const { objectives, updateObjectives, isUpdating, hasCustomObjectives } = useUserObjectives();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editedObjectives, setEditedObjectives] = useState({
    target_zev_percent: objectives.target_zev_percent,
    target_year: objectives.target_year,
    target_co2_reduction: objectives.target_co2_reduction,
  });

  const currentYear = new Date().getFullYear();
  const yearsRemaining = Math.max(0, objectives.target_year - currentYear);

  // Calculate progress
  const zevProgress = Math.min(100, (currentZevPercent / objectives.target_zev_percent) * 100);
  const co2Progress = Math.min(100, (currentCo2Reduction / objectives.target_co2_reduction) * 100);

  // Determine status
  const getStatus = (progress: number, yearsRemaining: number) => {
    const expectedProgress = 100 - (yearsRemaining / 10) * 100; // Linear expectation over 10 years
    if (progress >= expectedProgress + 10) return 'ahead';
    if (progress >= expectedProgress - 10) return 'onTrack';
    return 'behind';
  };

  const zevStatus = getStatus(zevProgress, yearsRemaining);
  const co2Status = getStatus(co2Progress, yearsRemaining);

  const statusConfig = {
    ahead: {
      label: t('analytics.esg.ahead', 'En avance'),
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      icon: CheckCircle2,
    },
    onTrack: {
      label: t('analytics.esg.onTrack', 'En bonne voie'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      icon: TrendingUp,
    },
    behind: {
      label: t('analytics.esg.behind', 'À risque'),
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      icon: AlertTriangle,
    },
  };

  const handleSaveObjectives = async () => {
    try {
      await updateObjectives(editedObjectives);
      toast.success(t('analytics.esg.saved', 'Objectifs sauvegardés'));
      setDialogOpen(false);
    } catch (error) {
      toast.error(t('analytics.esg.saveError', 'Erreur lors de la sauvegarde'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {t('analytics.esg.title', 'Objectifs ESG')}
            </CardTitle>
            <CardDescription>
              {t('analytics.esg.description', 'Suivi de vos objectifs de transition')}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('analytics.esg.editTitle', 'Configurer vos objectifs')}</DialogTitle>
                <DialogDescription>
                  {t('analytics.esg.editDescription', 'Définissez vos cibles de transition pour suivre votre progression.')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-3">
                  <Label>{t('analytics.esg.targetZev', 'Objectif flotte zéro-émission')}: {editedObjectives.target_zev_percent}%</Label>
                  <Slider
                    value={[editedObjectives.target_zev_percent]}
                    onValueChange={(v) => setEditedObjectives(prev => ({ ...prev, target_zev_percent: v[0] }))}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-3">
                  <Label>{t('analytics.esg.targetCo2', 'Objectif réduction CO₂')}: {editedObjectives.target_co2_reduction}%</Label>
                  <Slider
                    value={[editedObjectives.target_co2_reduction]}
                    onValueChange={(v) => setEditedObjectives(prev => ({ ...prev, target_co2_reduction: v[0] }))}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('analytics.esg.targetYear', 'Année cible')}</Label>
                  <Input
                    type="number"
                    value={editedObjectives.target_year}
                    onChange={(e) => setEditedObjectives(prev => ({ 
                      ...prev, 
                      target_year: Math.max(currentYear, parseInt(e.target.value) || currentYear) 
                    }))}
                    min={currentYear}
                    max={2050}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel', 'Annuler')}
                </Button>
                <Button onClick={handleSaveObjectives} disabled={isUpdating}>
                  {isUpdating ? t('common.saving', 'Sauvegarde...') : t('common.save', 'Sauvegarder')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ZEV Fleet Target */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('analytics.esg.zevFleet', 'Flotte Zéro-Émission')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{Math.round(currentZevPercent)}%</span>
              <span className="text-sm text-muted-foreground">/ {objectives.target_zev_percent}%</span>
            </div>
          </div>
          <Progress value={zevProgress} className="h-2" />
          <div className="flex items-center justify-between">
            <Badge 
              variant="secondary" 
              className={`${statusConfig[zevStatus].bgColor} ${statusConfig[zevStatus].color} border-0`}
            >
              {statusConfig[zevStatus].label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(objectives.target_zev_percent - currentZevPercent)}% {t('analytics.esg.remaining', 'restant')}
            </span>
          </div>
        </div>

        {/* CO2 Reduction Target */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('analytics.esg.co2Reduction', 'Réduction CO₂')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{Math.round(currentCo2Reduction)}%</span>
              <span className="text-sm text-muted-foreground">/ {objectives.target_co2_reduction}%</span>
            </div>
          </div>
          <Progress value={co2Progress} className="h-2" />
          <div className="flex items-center justify-between">
            <Badge 
              variant="secondary"
              className={`${statusConfig[co2Status].bgColor} ${statusConfig[co2Status].color} border-0`}
            >
              {statusConfig[co2Status].label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {Math.round(objectives.target_co2_reduction - currentCo2Reduction)}% {t('analytics.esg.remaining', 'restant')}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t('analytics.esg.targetDate', 'Objectif')} {objectives.target_year}
            </span>
            <Badge variant="outline">
              {yearsRemaining} {t('common.years', 'ans')} {t('analytics.esg.remaining', 'restant')}
            </Badge>
          </div>
        </div>

        {/* Setup prompt if no custom objectives */}
        {!hasCustomObjectives && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              {t('analytics.esg.setupPrompt', 'Cliquez sur ⚙️ pour configurer vos objectifs personnalisés')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ESGObjectivesTracker;

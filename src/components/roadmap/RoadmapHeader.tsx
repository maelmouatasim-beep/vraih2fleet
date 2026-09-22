import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  DollarSign,
  Target,
  MoreVertical,
  Edit,
  Trash2,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Roadmap, Phase, Milestone } from '@/hooks/useRoadmap';
// Simple currency formatter for roadmap
const formatRoadmapCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency || 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface RoadmapHeaderProps {
  roadmap: Roadmap;
  phases: Phase[];
  milestones: Milestone[];
  onEdit?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onShare?: () => void;
}

const RoadmapHeader: React.FC<RoadmapHeaderProps> = ({
  roadmap,
  phases,
  milestones,
  onEdit,
  onDelete,
  onExport,
  onShare,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;

  // Calculate stats
  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const inProgressMilestones = milestones.filter(m => m.status === 'in_progress').length;
  const blockedMilestones = milestones.filter(m => m.status === 'blocked').length;
  const totalMilestones = milestones.length;
  
  const overallProgress = totalMilestones > 0 
    ? Math.round((completedMilestones / totalMilestones) * 100) 
    : 0;

  const totalBudget = roadmap.total_budget || 0;
  const spentBudget = phases.reduce((sum, p) => sum + (p.budget_spent || 0), 0);
  const budgetProgress = totalBudget > 0 ? Math.round((spentBudget / totalBudget) * 100) : 0;

  const criticalMilestones = milestones.filter(m => m.is_critical && m.status !== 'completed').length;

  const getStatusBadge = () => {
    switch (roadmap.status) {
      case 'active':
        return <Badge className="bg-primary">{t('roadmap.status.active', 'Active')}</Badge>;
      case 'completed':
        return <Badge className="bg-accent">{t('roadmap.status.completed', 'Completed')}</Badge>;
      case 'archived':
        return <Badge variant="secondary">{t('roadmap.status.archived', 'Archived')}</Badge>;
      default:
        return <Badge variant="outline">{t('roadmap.status.draft', 'Draft')}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Title Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{roadmap.name}</h1>
            {getStatusBadge()}
          </div>
          {roadmap.description && (
            <p className="text-muted-foreground">{roadmap.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(roadmap.start_date), 'PP', { locale })} - {format(new Date(roadmap.end_date), 'PP', { locale })}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              {t('common.edit', 'Edit')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare}>
              <Share2 className="w-4 h-4 mr-2" />
              {t('common.share', 'Share')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              {t('common.export', 'Export')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              {t('common.delete', 'Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {t('roadmap.stats.progress', 'Progress')}
              </span>
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {completedMilestones}/{totalMilestones} {t('roadmap.stats.milestonesComplete', 'milestones')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {t('roadmap.stats.budget', 'Budget')}
              </span>
              <DollarSign className="w-4 h-4 text-accent" />
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {formatRoadmapCurrency(spentBudget, roadmap.currency)}
                </span>
              </div>
              <Progress value={budgetProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {t('roadmap.stats.of', 'of')} {formatRoadmapCurrency(totalBudget, roadmap.currency)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Milestones Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {t('roadmap.stats.milestones', 'Milestones')}
              </span>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <span className="text-sm">{completedMilestones} {t('roadmap.stats.completed', 'completed')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-sm">{inProgressMilestones} {t('roadmap.stats.inProgress', 'in progress')}</span>
              </div>
              {blockedMilestones > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">{blockedMilestones} {t('roadmap.stats.blocked', 'blocked')}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Critical Path */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {t('roadmap.stats.criticalPath', 'Critical Path')}
              </span>
              <AlertTriangle className={`w-4 h-4 ${criticalMilestones > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div className="space-y-1">
              <span className={`text-2xl font-bold ${criticalMilestones > 0 ? 'text-destructive' : ''}`}>
                {criticalMilestones}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('roadmap.stats.criticalRemaining', 'critical milestones remaining')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RoadmapHeader;

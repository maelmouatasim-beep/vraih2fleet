import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, differenceInDays, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, startOfQuarter, eachQuarterOfInterval } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { Phase, Milestone, getMilestoneStatusColor } from '@/hooks/useRoadmap';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, Clock, Lock, Ban, ChevronDown, ChevronRight } from 'lucide-react';

interface GanttChartProps {
  phases: Phase[];
  milestones: Milestone[];
  startDate: Date;
  endDate: Date;
  criticalPath: string[];
  onMilestoneClick?: (milestone: Milestone) => void;
  onPhaseClick?: (phase: Phase) => void;
}

type TimeGranularity = 'month-full' | 'month-short' | 'quarter';

const GanttChart: React.FC<GanttChartProps> = ({
  phases,
  milestones,
  startDate,
  endDate,
  criticalPath,
  onMilestoneClick,
  onPhaseClick,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'fr' ? fr : enUS;
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(phases.map(p => p.id)));
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const totalDays = differenceInDays(endDate, startDate) + 1;

  // Determine time granularity based on total duration
  const getTimeGranularity = (days: number): TimeGranularity => {
    if (days <= 180) return 'month-full';      // < 6 months
    if (days <= 540) return 'month-short';     // 6-18 months  
    return 'quarter';                           // > 18 months
  };

  const granularity = getTimeGranularity(totalDays);

  // Generate time periods based on granularity
  const periods = useMemo(() => {
    if (granularity === 'quarter') {
      return eachQuarterOfInterval({ start: startDate, end: endDate });
    }
    return eachMonthOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate, granularity]);

  // Format period label based on granularity
  const formatPeriod = (date: Date): string => {
    switch (granularity) {
      case 'quarter':
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        return `Q${quarter} ${date.getFullYear()}`;
      case 'month-short':
        return format(date, 'MMM yy', { locale });
      default:
        return format(date, 'MMMM yyyy', { locale });
    }
  };

  // Calculate column widths
  const minColumnWidth = 80; // pixels
  const tasksColumnWidth = 256; // pixels
  const timelineWidth = periods.length * minColumnWidth;
  const chartMinWidth = timelineWidth + tasksColumnWidth;

  // Sync scroll between header and body
  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const getPositionAndWidth = (itemStart: Date, itemEnd: Date) => {
    const startOffset = Math.max(0, differenceInDays(itemStart, startDate));
    const endOffset = Math.min(totalDays, differenceInDays(itemEnd, startDate) + 1);
    const width = endOffset - startOffset;
    
    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(width / totalDays) * 100}%`,
    };
  };

  const getStatusIcon = (status: Milestone['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3 h-3" />;
      case 'in_progress': return <Clock className="w-3 h-3" />;
      case 'blocked': return <Lock className="w-3 h-3" />;
      case 'cancelled': return <Ban className="w-3 h-3" />;
      default: return null;
    }
  };

  // Calculate period width percentage
  const getPeriodWidth = (periodDate: Date): number => {
    let periodStart: Date;
    let periodEnd: Date;

    if (granularity === 'quarter') {
      periodStart = startOfQuarter(periodDate);
      periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0);
    } else {
      periodStart = startOfMonth(periodDate);
      periodEnd = endOfMonth(periodDate);
    }

    const effectiveStart = periodStart < startDate ? startDate : periodStart;
    const effectiveEnd = periodEnd > endDate ? endDate : periodEnd;
    const daysInView = differenceInDays(effectiveEnd, effectiveStart) + 1;
    
    return (daysInView / totalDays) * 100;
  };

  return (
    <div className="w-full border rounded-lg bg-card overflow-hidden">
      {/* Header - Time Periods */}
      <div className="flex border-b bg-muted/50 sticky top-0 z-20">
        {/* Fixed Tasks column */}
        <div 
          className="flex-shrink-0 p-3 font-medium border-r bg-muted/50 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
          style={{ width: tasksColumnWidth, minWidth: tasksColumnWidth }}
        >
          {t('roadmap.gantt.tasks', 'Tasks')}
        </div>
        {/* Scrollable header */}
        <div 
          ref={headerRef}
          className="flex-1 overflow-hidden"
        >
          <div 
            className="flex"
            style={{ minWidth: timelineWidth }}
          >
            {periods.map((period, idx) => {
              const widthPercent = getPeriodWidth(period);
              
              return (
                <div
                  key={idx}
                  className="text-center py-2 text-sm font-medium border-r last:border-r-0 whitespace-nowrap"
                  style={{ 
                    width: `${widthPercent}%`,
                    minWidth: minColumnWidth,
                  }}
                >
                  {formatPeriod(period)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Body - Phases and Milestones */}
      <div 
        ref={bodyRef}
        className="overflow-x-auto"
        onScroll={handleBodyScroll}
      >
        <div 
          className="divide-y"
          style={{ minWidth: chartMinWidth }}
        >
          {phases.map((phase) => {
            const phaseMilestones = milestones.filter(m => m.phase_id === phase.id);
            const isExpanded = expandedPhases.has(phase.id);
            const phaseStart = parseISO(phase.start_date);
            const phaseEnd = parseISO(phase.end_date);
            const phasePosition = getPositionAndWidth(phaseStart, phaseEnd);

            return (
              <React.Fragment key={phase.id}>
                {/* Phase Row */}
                <div 
                  className="flex hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onPhaseClick?.(phase)}
                >
                  <div 
                    className="flex-shrink-0 p-3 border-r flex items-center gap-2 bg-background sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                    style={{ width: tasksColumnWidth, minWidth: tasksColumnWidth }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePhase(phase.id);
                      }}
                      className="p-0.5 hover:bg-muted rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: phase.color || 'hsl(var(--primary))' }}
                    />
                    <span className="font-medium truncate flex-1">{phase.name}</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {phase.completion_percentage}%
                    </Badge>
                  </div>
                  <div 
                    className="relative h-12 py-2"
                    style={{ width: timelineWidth, minWidth: timelineWidth }}
                  >
                    <div
                      className="absolute h-8 rounded-md opacity-80"
                      style={{
                        ...phasePosition,
                        backgroundColor: phase.color || 'hsl(var(--primary))',
                      }}
                    />
                  </div>
                </div>

                {/* Milestones */}
                {isExpanded && phaseMilestones.map((milestone) => {
                  const msStart = milestone.start_date ? parseISO(milestone.start_date) : parseISO(milestone.due_date);
                  const msEnd = parseISO(milestone.due_date);
                  const msPosition = getPositionAndWidth(msStart, msEnd);
                  const isCritical = criticalPath.includes(milestone.id);

                  return (
                    <div
                      key={milestone.id}
                      className={cn(
                        "flex hover:bg-muted/30 cursor-pointer transition-colors",
                        isCritical && "bg-destructive/5"
                      )}
                      onClick={() => onMilestoneClick?.(milestone)}
                    >
                      <div 
                        className="flex-shrink-0 p-3 pl-10 border-r flex items-center gap-2 bg-background sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
                        style={{ width: tasksColumnWidth, minWidth: tasksColumnWidth }}
                      >
                        <span className="text-sm truncate">{milestone.title}</span>
                        {isCritical && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('roadmap.gantt.criticalPath', 'Critical path')}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <div 
                        className="relative h-10 py-2"
                        style={{ width: timelineWidth, minWidth: timelineWidth }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "absolute h-6 rounded flex items-center justify-center gap-1 px-2 text-xs text-white font-medium cursor-pointer transition-all hover:opacity-90",
                                isCritical && "ring-2 ring-destructive ring-offset-1"
                              )}
                              style={{
                                ...msPosition,
                                backgroundColor: getMilestoneStatusColor(milestone.status),
                                minWidth: '24px',
                              }}
                            >
                              {getStatusIcon(milestone.status)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium">{milestone.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(msEnd, 'PPP', { locale })}
                              </p>
                              {milestone.description && (
                                <p className="text-xs">{milestone.description}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {phases.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {t('roadmap.gantt.noPhases', 'No phases yet. Create your first phase to get started.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GanttChart;

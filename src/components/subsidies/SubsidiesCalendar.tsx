import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  AlertTriangle, 
  Clock, 
  CalendarPlus,
  ExternalLink,
  Bell
} from 'lucide-react';
import { IncentiveProgram } from '@/hooks/useIncentives';
import { toast } from 'sonner';

interface SubsidiesCalendarProps {
  programs: IncentiveProgram[];
}

export function SubsidiesCalendar({ programs }: SubsidiesCalendarProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

  // Get programs with deadlines
  const programsWithDeadlines = useMemo(() => {
    return programs
      .filter(p => p.deadline && p.status === 'active')
      .map(p => {
        const deadlineDate = new Date(p.deadline!);
        const now = new Date();
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...p,
          deadlineDate,
          daysUntil,
          isExpired: daysUntil < 0,
          isUrgent: daysUntil >= 0 && daysUntil <= 30,
          isWarning: daysUntil > 30 && daysUntil <= 60,
        };
      })
      .filter(p => !p.isExpired)
      .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());
  }, [programs]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups: { [key: string]: typeof programsWithDeadlines } = {};
    
    programsWithDeadlines.forEach(program => {
      const monthKey = program.deadlineDate.toLocaleDateString(isEnglish ? 'en-CA' : 'fr-CA', { 
        year: 'numeric', 
        month: 'long' 
      });
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(program);
    });
    
    return groups;
  }, [programsWithDeadlines, isEnglish]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isEnglish ? 'en-CA' : 'fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportICS = (program: typeof programsWithDeadlines[0]) => {
    const title = isEnglish 
      ? `Deadline: ${program.program_name_en}`
      : `Échéance: ${program.program_name_fr}`;
    
    const description = isEnglish
      ? `Deadline to apply for ${program.program_name_en}. Amount: ${formatCurrency(program.amount_cad)}. Apply at: ${program.application_url}`
      : `Date limite pour ${program.program_name_fr}. Montant: ${formatCurrency(program.amount_cad)}. Demander à: ${program.application_url}`;

    const startDate = program.deadlineDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = startDate;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//H2Fleet Planner//Subsidies Calendar//EN',
      'BEGIN:VEVENT',
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `URL:${program.application_url}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subsidy-deadline-${program.id.slice(0, 8)}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(isEnglish ? 'Calendar event exported' : 'Événement de calendrier exporté');
  };

  const getUrgencyColor = (program: typeof programsWithDeadlines[0]) => {
    if (program.isUrgent) return 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20';
    if (program.isWarning) return 'border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
    return 'border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20';
  };

  // Upcoming deadlines summary
  const urgentCount = programsWithDeadlines.filter(p => p.isUrgent).length;
  const warningCount = programsWithDeadlines.filter(p => p.isWarning).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={urgentCount > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${urgentCount > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
              {t('subsidies.urgentDeadlines')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${urgentCount > 0 ? 'text-red-600' : ''}`}>{urgentCount}</p>
            <p className="text-xs text-muted-foreground">{t('subsidies.within30Days')}</p>
          </CardContent>
        </Card>

        <Card className={warningCount > 0 ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className={`h-4 w-4 ${warningCount > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              {t('subsidies.approachingDeadlines')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${warningCount > 0 ? 'text-yellow-600' : ''}`}>{warningCount}</p>
            <p className="text-xs text-muted-foreground">{t('subsidies.within60Days')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {t('subsidies.totalWithDeadlines')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{programsWithDeadlines.length}</p>
            <p className="text-xs text-muted-foreground">{t('subsidies.activePrograms')}</p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('subsidies.upcomingDeadlines')}</h3>
        <Select value={viewMode} onValueChange={(v: 'timeline' | 'list') => setViewMode(v)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="timeline">{t('subsidies.timeline')}</SelectItem>
            <SelectItem value="list">{t('subsidies.list')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' ? (
        <div className="space-y-6">
          {Object.entries(groupedByMonth).map(([month, monthPrograms]) => (
            <div key={month}>
              <h4 className="font-medium text-lg mb-3 capitalize">{month}</h4>
              <div className="space-y-3">
                {monthPrograms.map(program => (
                  <Card key={program.id} className={getUrgencyColor(program)}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {isEnglish ? program.program_name_en : program.program_name_fr}
                            </span>
                            {program.isUrgent && (
                              <Badge variant="destructive" className="animate-pulse">
                                {program.daysUntil} {isEnglish ? 'days' : 'jours'}
                              </Badge>
                            )}
                            {program.isWarning && (
                              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                                {program.daysUntil} {isEnglish ? 'days' : 'jours'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t('subsidies.deadline')}: {program.deadlineDate.toLocaleDateString(isEnglish ? 'en-CA' : 'fr-CA', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-lg font-bold text-green-600 mt-1">
                            {formatCurrency(program.amount_cad)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleExportICS(program)}>
                            <CalendarPlus className="h-4 w-4 mr-1" />
                            {t('subsidies.addToCalendar')}
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={program.application_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              {t('subsidies.apply')}
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {programsWithDeadlines.map(program => (
                <div 
                  key={program.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${getUrgencyColor(program)}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center w-14">
                      <p className="text-2xl font-bold">{program.deadlineDate.getDate()}</p>
                      <p className="text-xs text-muted-foreground">
                        {program.deadlineDate.toLocaleDateString(isEnglish ? 'en-CA' : 'fr-CA', { month: 'short' })}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">{isEnglish ? program.program_name_en : program.program_name_fr}</p>
                      <p className="text-sm text-muted-foreground">
                        {program.daysUntil} {isEnglish ? 'days remaining' : 'jours restants'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-600">{formatCurrency(program.amount_cad)}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleExportICS(program)}>
                      <CalendarPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {programsWithDeadlines.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('subsidies.noDeadlines')}</p>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{t('subsidies.deadlineAlerts')}</p>
              <p className="text-sm text-muted-foreground">{t('subsidies.alertsActiveDescription', 'Vous recevrez des rappels 7 jours et 1 jour avant chaque échéance.')}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/dashboard/settings">
                {t('subsidies.manageAlerts', 'Gérer')}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

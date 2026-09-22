import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Calculator, 
  FileText, 
  Calendar,
  Building2,
  TrendingUp,
  Leaf,
  AlertCircle,
  Clock,
  ExternalLink,
  FileDown,
  CheckCircle2
} from 'lucide-react';
import { useIncentives, CANADIAN_PROVINCES } from '@/hooks/useIncentives';
import { SubsidiesCalculator } from '@/components/subsidies/SubsidiesCalculator';
import { SubsidiesProgramsList } from '@/components/subsidies/SubsidiesProgramsList';
import { SubsidiesAssistant } from '@/components/subsidies/SubsidiesAssistant';
import { SubsidiesCalendar } from '@/components/subsidies/SubsidiesCalendar';

export default function SubsidiesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isEnglish = i18n.language === 'en';
  const [activeTab, setActiveTab] = useState('calculator');
  
  const { allPrograms, loading } = useIncentives();

  // Calculate summary stats
  const stats = useMemo(() => {
    const activePrograms = allPrograms.filter(p => p.status === 'active');
    const federalPrograms = activePrograms.filter(p => p.level === 'federal');
    const provincialPrograms = activePrograms.filter(p => p.level === 'provincial');
    
    const maxFederal = federalPrograms.reduce((max, p) => Math.max(max, p.amount_cad), 0);
    const maxProvincial = provincialPrograms.reduce((max, p) => Math.max(max, p.amount_cad), 0);
    
    const upcomingDeadlines = activePrograms.filter(p => {
      if (!p.deadline) return false;
      const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 60;
    });

    return {
      totalActive: activePrograms.length,
      federalCount: federalPrograms.length,
      provincialCount: provincialPrograms.length,
      maxFederal,
      maxProvincial,
      maxStackable: maxFederal + maxProvincial,
      upcomingDeadlines: upcomingDeadlines.length
    };
  }, [allPrograms]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isEnglish ? 'en-CA' : 'fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <DollarSign className="h-3 w-3 mr-1" />
              Canada 2025-2026
            </Badge>
            {stats.upcomingDeadlines > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                <Clock className="h-3 w-3 mr-1" />
                {stats.upcomingDeadlines} {isEnglish ? 'deadline(s) soon' : 'échéance(s) proche(s)'}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('subsidies.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('subsidies.subtitle')}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('subsidies.activePrograms')}
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActive}</div>
              <p className="text-xs text-muted-foreground">
                {stats.federalCount} {t('subsidies.federal')} · {stats.provincialCount} {t('subsidies.provincial')}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('subsidies.maxFederal')}
              </CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.maxFederal)}</div>
              <p className="text-xs text-muted-foreground">
                {isEnglish ? 'iMHZEV per vehicle' : 'iVMLZE par véhicule'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('subsidies.maxProvincial')}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.maxProvincial)}</div>
              <p className="text-xs text-muted-foreground">
                {isEnglish ? 'Quebec Écocamionnage' : 'Écocamionnage Québec'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('subsidies.maxStackable')}
              </CardTitle>
              <Leaf className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.maxStackable)}</div>
              <p className="text-xs text-muted-foreground">
                {t('subsidies.federalPlusProvincial')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="calculator" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">{t('subsidies.calculator')}</span>
            </TabsTrigger>
            <TabsTrigger value="programs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t('subsidies.programs')}</span>
            </TabsTrigger>
            <TabsTrigger value="assistant" className="flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">{t('subsidies.assistant')}</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t('subsidies.calendar')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-4">
            <SubsidiesCalculator showExport={true} />
          </TabsContent>

          <TabsContent value="programs" className="space-y-4">
            <SubsidiesProgramsList programs={allPrograms} loading={loading} />
          </TabsContent>

          <TabsContent value="assistant" className="space-y-4">
            <SubsidiesAssistant />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <SubsidiesCalendar programs={allPrograms} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

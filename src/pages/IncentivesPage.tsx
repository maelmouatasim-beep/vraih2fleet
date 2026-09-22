import React from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { IncentivesCalculator } from '@/components/incentives/IncentivesCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Leaf, Building2 } from 'lucide-react';

export default function IncentivesPage() {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <DollarSign className="h-3 w-3 mr-1" />
              {isEnglish ? 'Canada 2025-2026' : 'Canada 2025-2026'}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('incentives.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('incentives.subtitle')}
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isEnglish ? 'Max Federal Incentive' : 'Subvention Fédérale Max'}
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">$200,000</div>
              <p className="text-xs text-muted-foreground">
                {isEnglish ? 'iMHZEV per vehicle' : 'iVMLZE par véhicule'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isEnglish ? 'Max Provincial Incentive' : 'Subvention Provinciale Max'}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">$150,000</div>
              <p className="text-xs text-muted-foreground">
                {isEnglish ? 'Alberta AZETEC' : 'Alberta AZETEC'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {isEnglish ? 'Max Stackable Total' : 'Maximum Cumulable'}
              </CardTitle>
              <Leaf className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">$300,000</div>
              <p className="text-xs text-muted-foreground">
                {isEnglish ? 'Federal + Provincial (QC)' : 'Fédéral + Provincial (QC)'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Calculator */}
        <IncentivesCalculator showExport={true} />
      </div>
    </DashboardLayout>
  );
}

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  Fuel,
  Route,
  Info
} from 'lucide-react';
import { useReconciliation } from '@/hooks/useReconciliation';
import { Skeleton } from '@/components/ui/skeleton';

interface ReconciliationCardProps {
  projectId?: string;
}

const ReconciliationCard = ({ projectId }: ReconciliationCardProps) => {
  const { t } = useTranslation();
  const {
    items,
    hasData,
    hasSignificantDeviation,
    overallKmDeviation,
    overallConsumptionDeviation,
    alerts,
    isLoading,
    telematicsVehicleCount,
  } = useReconciliation(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            {t('telematics.reconciliation.title')}
          </CardTitle>
          <CardDescription>
            {t('telematics.reconciliation.noData')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground max-w-md">
              {t('telematics.reconciliation.connectPrompt')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDeviationColor = (deviation: number) => {
    const abs = Math.abs(deviation);
    if (abs <= 5) return 'text-green-600';
    if (abs <= 15) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusBadge = (status: 'good' | 'warning' | 'alert') => {
    switch (status) {
      case 'good':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" />{t('telematics.reconciliation.deviationGood')}</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="w-3 h-3 mr-1" />{t('telematics.reconciliation.deviationWarning')}</Badge>;
      case 'alert':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{t('telematics.reconciliation.deviationAlert')}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {t('telematics.reconciliation.title')}
            </CardTitle>
            <CardDescription>
              {t('telematics.reconciliation.description', { count: telematicsVehicleCount })}
            </CardDescription>
          </div>
          {hasSignificantDeviation ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {alerts.length} {t('telematics.reconciliation.alertsCount')}
            </Badge>
          ) : (
            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {t('telematics.reconciliation.inRange')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Route className="w-4 h-4" />
              {t('telematics.reconciliation.kmDeviation')}
            </div>
            <div className={`text-2xl font-bold ${getDeviationColor(overallKmDeviation)}`}>
              {overallKmDeviation > 0 ? '+' : ''}{overallKmDeviation}%
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {overallKmDeviation > 0 ? (
                <><TrendingUp className="w-3 h-3" /> {t('telematics.reconciliation.abovePredicted')}</>
              ) : (
                <><TrendingDown className="w-3 h-3" /> {t('telematics.reconciliation.belowPredicted')}</>
              )}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Fuel className="w-4 h-4" />
              {t('telematics.reconciliation.consumptionDeviation')}
            </div>
            <div className={`text-2xl font-bold ${getDeviationColor(overallConsumptionDeviation)}`}>
              {overallConsumptionDeviation > 0 ? '+' : ''}{overallConsumptionDeviation}%
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              {overallConsumptionDeviation > 0 ? (
                <><TrendingUp className="w-3 h-3" /> {t('telematics.reconciliation.higherThanExpected')}</>
              ) : (
                <><TrendingDown className="w-3 h-3" /> {t('telematics.reconciliation.lowerThanExpected')}</>
              )}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('telematics.reconciliation.alertTitle')}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {alerts.map((alert, idx) => (
                  <li key={idx} className="text-sm">{alert.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('telematics.reconciliation.vehicleType')}</TableHead>
                <TableHead className="text-center">{t('telematics.reconciliation.count')}</TableHead>
                <TableHead className="text-right">{t('telematics.reconciliation.realKm')}</TableHead>
                <TableHead className="text-right">{t('telematics.reconciliation.predictedKm')}</TableHead>
                <TableHead className="text-right">{t('telematics.reconciliation.realConsumption')}</TableHead>
                <TableHead className="text-right">{t('telematics.reconciliation.predictedConsumption')}</TableHead>
                <TableHead className="text-center">{t('telematics.reconciliation.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.vehicleType}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{item.vehicleType}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{item.vehicleCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.realAnnualKm.toLocaleString()}
                      <span className={`text-xs ${getDeviationColor(item.kmDeviation)}`}>
                        ({item.kmDeviation > 0 ? '+' : ''}{item.kmDeviation}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.predictedAnnualKm.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {item.realConsumption} L
                      <span className={`text-xs ${getDeviationColor(item.consumptionDeviation)}`}>
                        ({item.consumptionDeviation > 0 ? '+' : ''}{item.consumptionDeviation}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.predictedConsumption} L
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(item.deviationStatus)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>≤ 5% {t('telematics.reconciliation.deviationGood')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>5-15% {t('telematics.reconciliation.deviationWarning')}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>&gt; 15% {t('telematics.reconciliation.deviationAlert')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReconciliationCard;

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Satellite, Edit3, BookOpen, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export type DataSourceType = 'telematics' | 'manual' | 'reference';

interface TelematicsStats {
  vehicleCount: number;
  avgAnnualKm: number;
  avgFuelConsumption: number;
  lastSyncAt: string | null;
  isConnected: boolean;
}

interface ReferenceDataStats {
  avgAnnualKm: number;
  avgFuelConsumption: number;
  electricityPrice: number;
  dieselPrice: number;
  hydrogenPrice: number;
  region: string;
}

interface DataSourceSelectorProps {
  selectedSource: DataSourceType;
  onSourceChange: (source: DataSourceType) => void;
  onTelematicsData?: (data: {
    vehicleCount: number;
    annualKm: number;
    fuelConsumption: number;
  }) => void;
  onReferenceData?: (data: {
    annualKm: number;
    electricityPrice: number;
    dieselPrice: number;
    hydrogenPrice: number;
  }) => void;
  region?: string;
  className?: string;
}

export function DataSourceSelector({
  selectedSource,
  onSourceChange,
  onTelematicsData,
  onReferenceData,
  region = 'Canada',
  className,
}: DataSourceSelectorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [telematicsStats, setTelematicsStats] = useState<TelematicsStats | null>(null);
  const [referenceStats, setReferenceStats] = useState<ReferenceDataStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Fetch telematics data
        const [telematicsResult, referenceResult] = await Promise.all([
          supabase
            .from('telematics_vehicles')
            .select('annual_km, fuel_consumption')
            .eq('user_id', user.id),
          supabase
            .from('reference_data_ranges')
            .select('category, subcategory, mid_value, region')
            .or(`region.eq.${region},region.eq.Canada`)
            .order('date_effective', { ascending: false }),
        ]);

        // Process telematics stats
        if (telematicsResult.data && telematicsResult.data.length > 0) {
          const vehicles = telematicsResult.data;
          const avgKm = vehicles.reduce((sum, v) => sum + (v.annual_km || 0), 0) / vehicles.length;
          const avgFuel = vehicles.reduce((sum, v) => sum + (v.fuel_consumption || 0), 0) / vehicles.length;

          // Get last sync
          const { data: connectionData } = await supabase
            .from('telematics_connections')
            .select('last_sync_at, status')
            .eq('user_id', user.id)
            .order('last_sync_at', { ascending: false })
            .limit(1);

          setTelematicsStats({
            vehicleCount: vehicles.length,
            avgAnnualKm: Math.round(avgKm),
            avgFuelConsumption: Math.round(avgFuel * 10) / 10,
            lastSyncAt: connectionData?.[0]?.last_sync_at || null,
            isConnected: connectionData?.[0]?.status === 'connected',
          });
        } else {
          setTelematicsStats({
            vehicleCount: 0,
            avgAnnualKm: 0,
            avgFuelConsumption: 0,
            lastSyncAt: null,
            isConnected: false,
          });
        }

        // Process reference data stats
        if (referenceResult.data) {
          const refData = referenceResult.data;
          const getRefValue = (category: string, subcategory: string) => {
            const entry = refData.find(
              r => r.category === category && r.subcategory === subcategory
            );
            return entry?.mid_value || 0;
          };

          setReferenceStats({
            avgAnnualKm: 50000, // Default average
            avgFuelConsumption: 32,
            electricityPrice: getRefValue('electricity', 'commercial_rate') || 0.12,
            dieselPrice: getRefValue('fuel_prices', 'diesel') || 1.50,
            hydrogenPrice: getRefValue('hydrogen', 'retail_price') || 12,
            region: region,
          });
        }
      } catch (error) {
        console.error('Error fetching data sources:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id, region]);

  const handleSourceChange = (source: DataSourceType) => {
    onSourceChange(source);

    // Notify parent with data based on source
    if (source === 'telematics' && telematicsStats && onTelematicsData) {
      onTelematicsData({
        vehicleCount: telematicsStats.vehicleCount,
        annualKm: telematicsStats.avgAnnualKm,
        fuelConsumption: telematicsStats.avgFuelConsumption,
      });
    } else if (source === 'reference' && referenceStats && onReferenceData) {
      onReferenceData({
        annualKm: referenceStats.avgAnnualKm,
        electricityPrice: referenceStats.electricityPrice,
        dieselPrice: referenceStats.dieselPrice,
        hydrogenPrice: referenceStats.hydrogenPrice,
      });
    }
  };

  const isTelematicsAvailable = telematicsStats && telematicsStats.vehicleCount > 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          {t('scenarios.dataSource.title', 'Source des données')}
        </CardTitle>
        <CardDescription>
          {t('scenarios.dataSource.description', 'Choisissez l\'origine des données pour pré-remplir le formulaire')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <RadioGroup
            value={selectedSource}
            onValueChange={(value) => handleSourceChange(value as DataSourceType)}
            className="space-y-3"
          >
            {/* Telematics Option */}
            <div
              className={cn(
                'flex items-start space-x-3 p-4 rounded-lg border transition-colors',
                selectedSource === 'telematics'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50',
                !isTelematicsAvailable && 'opacity-60'
              )}
            >
              <RadioGroupItem
                value="telematics"
                id="source-telematics"
                disabled={!isTelematicsAvailable}
              />
              <Label
                htmlFor="source-telematics"
                className={cn(
                  'flex-1 cursor-pointer',
                  !isTelematicsAvailable && 'cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Satellite className="h-4 w-4 text-green-500" />
                  <span className="font-medium">
                    {t('scenarios.dataSource.telematics', 'Données télématiques')}
                  </span>
                </div>
                {isTelematicsAvailable ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {t('scenarios.dataSource.telematicsConnected', '{{count}} véhicules connectés', {
                        count: telematicsStats.vehicleCount,
                      })}
                    </p>
                    <p>
                      {t('scenarios.dataSource.telematicsStats', 'Moy. {{km}} km/an, {{fuel}} L/100km', {
                        km: telematicsStats.avgAnnualKm.toLocaleString(),
                        fuel: telematicsStats.avgFuelConsumption,
                      })}
                    </p>
                    {telematicsStats.lastSyncAt && (
                      <p className="text-xs opacity-70">
                        {t('scenarios.dataSource.lastSync', 'Dernière sync:')} {new Date(telematicsStats.lastSyncAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-orange-500" />
                      {t('scenarios.dataSource.noTelematics', 'Aucune connexion télématique')}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      asChild
                    >
                      <a href="/dashboard/telematics">
                        {t('scenarios.dataSource.connectTelematics', 'Connecter un fournisseur →')}
                      </a>
                    </Button>
                  </div>
                )}
              </Label>
            </div>

            {/* Manual Input Option */}
            <div
              className={cn(
                'flex items-start space-x-3 p-4 rounded-lg border transition-colors',
                selectedSource === 'manual'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <RadioGroupItem value="manual" id="source-manual" />
              <Label htmlFor="source-manual" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <Edit3 className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">
                    {t('scenarios.dataSource.manual', 'Saisie manuelle')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('scenarios.dataSource.manualDesc', 'Entrez vos propres valeurs pour chaque paramètre')}
                </p>
              </Label>
            </div>

            {/* Reference Data Option */}
            <div
              className={cn(
                'flex items-start space-x-3 p-4 rounded-lg border transition-colors',
                selectedSource === 'reference'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <RadioGroupItem value="reference" id="source-reference" />
              <Label htmlFor="source-reference" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">
                    {t('scenarios.dataSource.reference', 'Moyennes régionales')}
                  </span>
                </div>
                {referenceStats ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      {t('scenarios.dataSource.referenceRegion', 'Données pour: {{region}}', {
                        region: referenceStats.region,
                      })}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {t('scenarios.dataSource.elecPrice', 'Élec:')} ${referenceStats.electricityPrice}/kWh
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t('scenarios.dataSource.dieselPrice', 'Diesel:')} ${referenceStats.dieselPrice}/L
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t('scenarios.dataSource.h2Price', 'H₂:')} ${referenceStats.hydrogenPrice}/kg
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('scenarios.dataSource.referenceDesc', 'Utiliser les moyennes industrielles pour votre région')}
                  </p>
                )}
              </Label>
            </div>
          </RadioGroup>
        )}

        {/* Info Alert */}
        {selectedSource === 'telematics' && isTelematicsAvailable && (
          <Alert className="mt-4 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              {t('scenarios.dataSource.telematicsApplied', 'Les données de vos véhicules connectés seront utilisées pour pré-remplir le formulaire.')}
            </AlertDescription>
          </Alert>
        )}

        {selectedSource === 'reference' && (
          <Alert className="mt-4 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
            <BookOpen className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700 dark:text-orange-400">
              {t('scenarios.dataSource.referenceApplied', 'Les moyennes régionales seront utilisées. Ajustez selon vos contrats réels pour plus de précision.')}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default DataSourceSelector;

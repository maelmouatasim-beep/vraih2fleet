import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Layers, 
  Rocket, 
  TrendingUp, 
  Shield,
  Calculator,
  Play,
  DollarSign,
  Calendar,
  MapPin,
  Navigation,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from 'recharts';
import { useInfrastructureTelematicsData } from '@/hooks/useInfrastructureTelematicsData';

interface DeploymentScenario {
  id: string;
  name: string;
  type: 'rapid' | 'progressive' | 'conservative';
  years: number;
  evChargersYear1: number;
  evChargersTotal: number;
  h2StationsYear1: number;
  h2StationsTotal: number;
  totalCapex: number;
  yearlyBreakdown: { year: number; evChargers: number; h2Stations: number; capex: number }[];
}

interface InfrastructureScenariosProps {
  baseEvChargers: number;
  baseH2Stations: number;
  totalVehicles: number;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
};

const InfrastructureScenarios = ({ 
  baseEvChargers, 
  baseH2Stations,
  totalVehicles,
}: InfrastructureScenariosProps) => {
  const { t } = useTranslation();
  const [selectedScenario, setSelectedScenario] = useState<string>('progressive');
  const [whatIfVehicles, setWhatIfVehicles] = useState(0);
  const [showWhatIf, setShowWhatIf] = useState(false);

  // Get telematics data for location recommendations
  const { 
    recommendedLocations, 
    geographicClusters,
    hasRealData,
    heatmapPoints 
  } = useInfrastructureTelematicsData();

  // Get top 3 priority zones
  const top3Zones = geographicClusters
    .filter(c => c.priority === 'high' || c.priority === 'medium')
    .slice(0, 3);

  // Generate deployment scenarios
  const scenarios: DeploymentScenario[] = [
    {
      id: 'rapid',
      name: t('infrastructure.scenarios.rapid', 'Rapid Deployment'),
      type: 'rapid',
      years: 2,
      evChargersYear1: Math.ceil(baseEvChargers * 0.7),
      evChargersTotal: baseEvChargers,
      h2StationsYear1: Math.ceil(baseH2Stations * 0.7),
      h2StationsTotal: baseH2Stations,
      totalCapex: baseEvChargers * 60000 + baseH2Stations * 3000000,
      yearlyBreakdown: [
        { year: 1, evChargers: Math.ceil(baseEvChargers * 0.7), h2Stations: Math.ceil(baseH2Stations * 0.7), capex: (baseEvChargers * 60000 + baseH2Stations * 3000000) * 0.7 },
        { year: 2, evChargers: baseEvChargers - Math.ceil(baseEvChargers * 0.7), h2Stations: baseH2Stations - Math.ceil(baseH2Stations * 0.7), capex: (baseEvChargers * 60000 + baseH2Stations * 3000000) * 0.3 },
      ],
    },
    {
      id: 'progressive',
      name: t('infrastructure.scenarios.progressive', 'Progressive Deployment'),
      type: 'progressive',
      years: 3,
      evChargersYear1: Math.ceil(baseEvChargers * 0.4),
      evChargersTotal: baseEvChargers,
      h2StationsYear1: Math.ceil(baseH2Stations * 0.4),
      h2StationsTotal: baseH2Stations,
      totalCapex: baseEvChargers * 60000 + baseH2Stations * 3000000,
      yearlyBreakdown: [
        { year: 1, evChargers: Math.ceil(baseEvChargers * 0.4), h2Stations: Math.ceil(baseH2Stations * 0.4), capex: (baseEvChargers * 60000 + baseH2Stations * 3000000) * 0.4 },
        { year: 2, evChargers: Math.ceil(baseEvChargers * 0.35), h2Stations: Math.ceil(baseH2Stations * 0.35), capex: (baseEvChargers * 60000 + baseH2Stations * 3000000) * 0.35 },
        { year: 3, evChargers: baseEvChargers - Math.ceil(baseEvChargers * 0.75), h2Stations: baseH2Stations - Math.ceil(baseH2Stations * 0.75), capex: (baseEvChargers * 60000 + baseH2Stations * 3000000) * 0.25 },
      ],
    },
    {
      id: 'conservative',
      name: t('infrastructure.scenarios.conservative', 'Conservative Deployment'),
      type: 'conservative',
      years: 5,
      evChargersYear1: Math.ceil(baseEvChargers * 0.2),
      evChargersTotal: baseEvChargers,
      h2StationsYear1: Math.ceil(baseH2Stations * 0.2),
      h2StationsTotal: baseH2Stations,
      totalCapex: baseEvChargers * 60000 + baseH2Stations * 3000000,
      yearlyBreakdown: Array.from({ length: 5 }, (_, i) => ({
        year: i + 1,
        evChargers: Math.ceil(baseEvChargers * 0.2),
        h2Stations: Math.ceil(baseH2Stations * 0.2),
        capex: (baseEvChargers * 60000 + baseH2Stations * 3000000) * 0.2,
      })),
    },
  ];

  const currentScenario = scenarios.find(s => s.id === selectedScenario)!;

  // What-if calculation
  const whatIfImpact = {
    additionalEvChargers: Math.ceil(whatIfVehicles * 0.3),
    additionalH2Stations: Math.ceil(whatIfVehicles * 0.1 / 10),
    additionalCapex: whatIfVehicles * 0.3 * 60000 + Math.ceil(whatIfVehicles * 0.1 / 10) * 3000000,
  };

  const scenarioColors = {
    rapid: 'border-purple-500 bg-purple-50 dark:bg-purple-950/20',
    progressive: 'border-green-500 bg-green-50 dark:bg-green-950/20',
    conservative: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
  };

  const scenarioIcons = {
    rapid: Rocket,
    progressive: TrendingUp,
    conservative: Shield,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          {t('infrastructure.scenarios.title', 'Deployment Scenarios')}
        </CardTitle>
        <CardDescription>
          {t('infrastructure.scenarios.description', 'Compare different infrastructure deployment strategies')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recommended Locations Section */}
        {top3Zones.length > 0 && (
          <div className="p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {t('infrastructure.recommendedLocations.title', 'Recommended Locations')}
              {hasRealData && (
                <Badge variant="outline" className="text-xs">
                  {t('infrastructure.recommendedLocations.fromTelematics', 'From Telematics')}
                </Badge>
              )}
            </h4>
            <div className="grid md:grid-cols-3 gap-3">
              {top3Zones.map((zone, idx) => (
                <div 
                  key={zone.id} 
                  className={`p-3 rounded-lg border ${
                    zone.priority === 'high' 
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                      : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">#{idx + 1}</span>
                      <Badge variant={zone.priority === 'high' ? 'default' : 'secondary'}>
                        {zone.priority}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {zone.recommendedStationType === 'ev_charger' ? 'EV' : 
                       zone.recommendedStationType === 'h2_station' ? 'H₂' : 'Mix'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Navigation className="h-3 w-3" />
                      <span>
                        {zone.centroid.lat.toFixed(2)}°N, {Math.abs(zone.centroid.lng).toFixed(2)}°W
                      </span>
                    </div>
                    <p className="font-medium">{zone.vehicleCount} {t('infrastructure.recommendedLocations.vehicles', 'vehicles')}</p>
                    <p className="text-xs text-muted-foreground">
                      {zone.totalDailyKm} km/{t('common.day', 'day')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {top3Zones.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('infrastructure.recommendedLocations.noData', 'Connect telematics to see location recommendations')}
              </p>
            )}
          </div>
        )}

        {/* Scenario Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {scenarios.map((scenario) => {
            const Icon = scenarioIcons[scenario.type];
            const isSelected = selectedScenario === scenario.id;
            
            return (
              <div
                key={scenario.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected 
                    ? `${scenarioColors[scenario.type]} ring-2 ring-offset-2 ring-primary` 
                    : 'border-muted hover:border-primary/50'
                }`}
                onClick={() => setSelectedScenario(scenario.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${
                      scenario.type === 'rapid' ? 'text-purple-500' :
                      scenario.type === 'progressive' ? 'text-green-500' : 'text-blue-500'
                    }`} />
                    <h4 className="font-semibold">{scenario.name}</h4>
                  </div>
                  {isSelected && <Badge>{t('common.selected', 'Selected')}</Badge>}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('infrastructure.scenarios.duration', 'Duration')}</span>
                    <span className="font-medium">{scenario.years} {t('common.years', 'years')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('infrastructure.scenarios.evYear1', 'EV Year 1')}</span>
                    <span className="font-medium">{scenario.evChargersYear1} {t('infrastructure.scenarios.chargers', 'chargers')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('infrastructure.scenarios.h2Year1', 'H₂ Year 1')}</span>
                    <span className="font-medium">{scenario.h2StationsYear1} {t('infrastructure.scenarios.stations', 'stations')}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-muted-foreground">{t('infrastructure.scenarios.totalCapex', 'Total CAPEX')}</span>
                    <span className="font-bold">{formatCurrency(scenario.totalCapex)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deployment Timeline */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t('infrastructure.scenarios.timeline', 'Deployment Timeline')}
          </h4>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={currentScenario.yearlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" tickFormatter={(v) => `Y${v}`} className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'capex') return [formatCurrency(value), 'CAPEX'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="evChargers" 
                  name={t('infrastructure.scenarios.evChargers', 'EV Chargers')}
                  fill="hsl(142, 76%, 36%)" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="h2Stations" 
                  name={t('infrastructure.scenarios.h2Stations', 'H₂ Stations')}
                  fill="hsl(217, 91%, 60%)" 
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="capex" 
                  name="CAPEX"
                  stroke="hsl(0, 84%, 60%)" 
                  strokeWidth={2}
                  dot
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* What-If Analysis */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              {t('infrastructure.scenarios.whatIf', 'What-If Simulation')}
            </h4>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowWhatIf(!showWhatIf)}
            >
              <Play className="h-4 w-4 mr-2" />
              {showWhatIf ? t('common.hide', 'Hide') : t('common.simulate', 'Simulate')}
            </Button>
          </div>

          {showWhatIf && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('infrastructure.scenarios.additionalVehicles', 'Additional Vehicles')}: +{whatIfVehicles}</Label>
                <Slider
                  value={[whatIfVehicles]}
                  onValueChange={([v]) => setWhatIfVehicles(v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              {whatIfVehicles > 0 && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground">{t('infrastructure.scenarios.additionalEv', 'Additional EV')}</p>
                    <p className="text-xl font-bold text-green-600">+{whatIfImpact.additionalEvChargers}</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground">{t('infrastructure.scenarios.additionalH2', 'Additional H₂')}</p>
                    <p className="text-xl font-bold text-blue-600">+{whatIfImpact.additionalH2Stations}</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground">{t('infrastructure.scenarios.additionalCapex', 'Additional CAPEX')}</p>
                    <p className="text-xl font-bold text-red-600">+{formatCurrency(whatIfImpact.additionalCapex)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InfrastructureScenarios;

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Fuel, 
  Zap, 
  AlertTriangle,
  Loader2,
  Check,
  ArrowRight,
  Calculator,
  Link2,
  Plus,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Helper functions for labels
const getRefuelingFreqLabel = (freq: number): string => {
  switch(freq) {
    case 1: return 'Quotidien';
    case 2: return 'Tous les 2 jours';
    case 3: return '2 fois/semaine';
    default: return `Tous les ${freq} jours`;
  }
};

const getChargingSpeedLabel = (speed: string): string => {
  switch(speed) {
    case 'slow': return 'Niveau 2 (7-19 kW)';
    case 'fast': return 'DC Rapide (50-150 kW)';
    case 'ultra': return 'Ultra-rapide (350+ kW)';
    default: return speed;
  }
};

import InfrastructurePricingSelector, { 
  type PricingSourceType, 
  type InfrastructurePricing,
  DEFAULT_REFERENCE_PRICING,
} from '@/components/infrastructure/InfrastructurePricingSelector';
import { BreakdownCard } from '@/components/shared/DataProvenance';
import {
  calculateEVChargers,
  calculateH2Stations,
  calculateTotalInfrastructure,
  EV_CHARGER_COSTS,
} from '@/lib/calculations/infrastructure';
import { calculateTCO } from '@/lib/calculations/tco';
import { saveTCOResult } from '@/lib/supabase/tcoResults';
import { fetchReferenceData } from '@/lib/supabase/referenceData';
import { getScenario } from '@/lib/supabase/scenarios';
import { DEFAULT_REFERENCE_DATA } from '@/lib/calculations/types';

interface ScenarioOption {
  id: string;
  name: string;
  projectName: string;
  hasInfra: boolean;
  evCount: number;
  h2Count: number;
}

export default function Infrastructure() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Scenario mode state
  const scenarioIdFromUrl = searchParams.get('scenario');
  const returnTo = searchParams.get('returnTo');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(scenarioIdFromUrl);
  const [isApplying, setIsApplying] = useState(false);
  const [isLoadingScenario, setIsLoadingScenario] = useState(false);
  const [existingPlanDate, setExistingPlanDate] = useState<string | null>(null);
  
  // Modal state for applying to scenario (only when no scenario selected)
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [modalScenarioId, setModalScenarioId] = useState<string | null>(null);
  const [availableScenarios, setAvailableScenarios] = useState<ScenarioOption[]>([]);

  // H2 State
  const [h2VehicleCount, setH2VehicleCount] = useState(0);
  const [h2DailyKg, setH2DailyKg] = useState(0);
  const [h2RefuelingFreq, setH2RefuelingFreq] = useState(1);
  const [h2StationCapacity, setH2StationCapacity] = useState<'100' | '200' | '500' | '1000'>('200');
  const [h2OperatingHours, setH2OperatingHours] = useState(12);

  // EV State
  const [evVehicleCount, setEvVehicleCount] = useState(0);
  const [evBatteryCapacity, setEvBatteryCapacity] = useState(100);
  const [evDailyKwh, setEvDailyKwh] = useState(0);
  const [evChargingSpeed, setEvChargingSpeed] = useState<'slow' | 'fast' | 'ultra'>('fast');
  const [evChargingHours, setEvChargingHours] = useState(8);
  const [evGridUpgrade, setEvGridUpgrade] = useState(0);
  
  // Pricing state
  const [pricingSource, setPricingSource] = useState<PricingSourceType>('reference');
  const [currentPricing, setCurrentPricing] = useState<InfrastructurePricing>({
    ...DEFAULT_REFERENCE_PRICING,
    source: 'reference',
  });
  
  // Track if user has entered any data
  const hasUserInput = h2VehicleCount > 0 || evVehicleCount > 0;

  // Selected scenario info
  const selectedScenario = useMemo(() => 
    availableScenarios.find(s => s.id === selectedScenarioId),
    [availableScenarios, selectedScenarioId]
  );

  // Fetch available scenarios for modal (filtered by user)
  useEffect(() => {
    const fetchScenarios = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('scenarios')
        .select('id, name, fleet_composition, projects!inner(name, user_id)')
        .eq('projects.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!error && data) {
        setAvailableScenarios(data.map(s => {
          const fleet = s.fleet_composition as any;
          return {
            id: s.id,
            name: s.name,
            projectName: (s.projects as any)?.name || 'Projet',
            hasInfra: !!fleet?.infrastructure,
            evCount: fleet?.ev?.count || fleet?.bev?.count || 0,
            h2Count: fleet?.hydrogen?.count || fleet?.h2?.count || 0,
          };
        }));
      }
    };
    fetchScenarios();
  }, [user]);

  // Load scenario data and existing infra plan when scenario changes
  useEffect(() => {
    if (selectedScenarioId) {
      loadScenarioAndPlan(selectedScenarioId);
    }
  }, [selectedScenarioId]);

  const loadScenarioAndPlan = async (id: string) => {
    setIsLoadingScenario(true);
    try {
      // 1. Load scenario fleet data
      const { data: scenarioData, error: scenarioError } = await supabase
        .from('scenarios')
        .select('name, fleet_composition')
        .eq('id', id)
        .single();

      if (scenarioError) throw scenarioError;
      
      const fleet = scenarioData.fleet_composition as any;
      
      // Set EV count from scenario
      const evCount = fleet?.ev?.count || fleet?.bev?.count || 0;
      if (evCount > 0) {
        setEvVehicleCount(evCount);
        const annualKm = fleet?.ev?.annualKm || fleet?.bev?.annualKm || 30000;
        setEvDailyKwh(Math.round((annualKm / 365) * 0.25));
      }
      
      // Set H2 count from scenario
      const h2Count = fleet?.hydrogen?.count || fleet?.h2?.count || 0;
      if (h2Count > 0) {
        setH2VehicleCount(h2Count);
        const annualKm = fleet?.hydrogen?.annualKm || fleet?.h2?.annualKm || 50000;
        setH2DailyKg(Math.round((annualKm / 365) * 0.08));
      }

      // 2. Check for existing infrastructure plan
      const { data: planData, error: planError } = await supabase
        .from('infrastructure_plans')
        .select('*')
        .eq('scenario_id', id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planError) {
        console.warn('Unable to load existing infrastructure plan:', planError);
      }

      if (planData) {
        // Pre-fill from existing plan
        setH2VehicleCount(planData.h2_vehicles_count);
        setH2DailyKg(planData.h2_daily_kg);
        setH2RefuelingFreq(planData.h2_refueling_frequency);
        // Validate h2_station_capacity
        const validCapacities = ['100', '200', '500', '1000'] as const;
        const loadedCapacity = planData.h2_station_capacity?.toString();
        setH2StationCapacity(
          validCapacities.includes(loadedCapacity as any) 
            ? (loadedCapacity as '100' | '200' | '500' | '1000') 
            : '200'
        );
        setH2OperatingHours(planData.h2_operating_hours);
        
        setEvVehicleCount(planData.ev_vehicles_count);
        setEvBatteryCapacity(planData.ev_battery_capacity_kwh);
        setEvDailyKwh(planData.ev_daily_kwh);
        // Validate ev_charging_speed
        const validSpeeds = ['slow', 'fast', 'ultra'] as const;
        const loadedSpeed = planData.ev_charging_speed;
        setEvChargingSpeed(
          validSpeeds.includes(loadedSpeed as any) 
            ? (loadedSpeed as 'slow' | 'fast' | 'ultra') 
            : 'fast'
        );
        setEvChargingHours(planData.ev_charging_hours);
        setEvGridUpgrade(planData.ev_grid_upgrade);
        
        setExistingPlanDate(new Date(planData.updated_at).toLocaleDateString('fr-CA'));
        
        toast({
          title: t('infrastructure.toast.scenarioLoaded', 'Scénario chargé'),
          description: t('infrastructure.toast.scenarioLoadedDesc', 'Les données du plan existant ont été restaurées'),
        });
      } else {
        setExistingPlanDate(null);
      }
    } catch (error) {
      console.error('Error loading scenario:', error);
    } finally {
      setIsLoadingScenario(false);
    }
  };

  // Handle scenario selection change
  const handleScenarioSelect = (scenarioId: string) => {
    if (scenarioId === 'none') {
      setSelectedScenarioId(null);
      setExistingPlanDate(null);
      // Reset fleet counts
      setH2VehicleCount(0);
      setEvVehicleCount(0);
    } else {
      setSelectedScenarioId(scenarioId);
      // Update URL without navigation
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('scenario', scenarioId);
      window.history.replaceState({}, '', newUrl.toString());
    }
  };
  
  // Apply infrastructure to scenario
  const handleApplyToScenario = async (targetScenarioId: string) => {
    if (!user || !targetScenarioId) {
      console.error('Missing user or targetScenarioId', { user: !!user, targetScenarioId });
      toast({
        title: t('common.error'),
        description: t('infrastructure.errors.missingUserOrScenario'),
        variant: 'destructive',
      });
      return;
    }
    
    setIsApplying(true);
    console.log('Starting handleApplyToScenario for:', targetScenarioId);
    
    try {
      const targetScenario = availableScenarios.find(s => s.id === targetScenarioId);
      const planName = `Infra - ${targetScenario?.name || 'Scénario'} - ${new Date().toLocaleDateString()}`;
      
      // 1. Check for existing infrastructure plan
      console.log('Checking for existing infrastructure plan...');
      const { data: existingPlan, error: existingPlanError } = await supabase
        .from('infrastructure_plans')
        .select('id')
        .eq('scenario_id', targetScenarioId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPlanError) {
        console.error('Error checking existing plan:', existingPlanError);
        throw new Error(t('infrastructure.errors.checkPlanError') + `: ${existingPlanError.message}`);
      }
      
      console.log('Existing plan:', existingPlan);

      const planPayload = {
        user_id: user.id,
        scenario_id: targetScenarioId,
        name: planName,
        h2_vehicles_count: h2VehicleCount,
        h2_daily_kg: h2DailyKg,
        h2_refueling_frequency: h2RefuelingFreq,
        h2_station_capacity: parseInt(h2StationCapacity),
        h2_operating_hours: h2OperatingHours,
        h2_stations_count: h2StationsNeeded,
        h2_capex: h2TotalCapex,
        h2_opex: h2AnnualOpex,
        h2_land_permits: currentPricing.h2LandPermits,
        ev_vehicles_count: evVehicleCount,
        ev_battery_capacity_kwh: evBatteryCapacity,
        ev_daily_kwh: evDailyKwh,
        ev_charging_speed: evChargingSpeed,
        ev_charging_hours: evChargingHours,
        chargers_slow: evChargingSpeed === 'slow' ? chargersNeeded : 0,
        chargers_fast: evChargingSpeed === 'fast' ? chargersNeeded : 0,
        chargers_ultra: evChargingSpeed === 'ultra' ? chargersNeeded : 0,
        ev_capex: evTotalCapex,
        ev_installation: chargersNeeded * EV_CHARGER_COSTS[evChargingSpeed].install,
        ev_grid_upgrade: needsGridUpgrade ? evGridUpgrade : 0,
        ev_opex: evAnnualOpex,
        total_capex: totalCapex,
        total_opex_10y: totalOpex10y,
      };

      let planId: string;
      if (existingPlan?.id) {
        // Update existing plan
        console.log('Updating existing plan:', existingPlan.id);
        const { error: updatePlanError } = await supabase
          .from('infrastructure_plans')
          .update(planPayload)
          .eq('id', existingPlan.id);
        if (updatePlanError) {
          console.error('Error updating plan:', updatePlanError);
          throw new Error(`Erreur mise à jour plan: ${updatePlanError.message}`);
        }
        planId = existingPlan.id;
      } else {
        // Insert new plan
        console.log('Creating new infrastructure plan...');
        const { data: newPlan, error: planError } = await supabase
          .from('infrastructure_plans')
          .insert(planPayload)
          .select('id')
          .single();
        if (planError) {
          console.error('Error creating plan:', planError);
          throw new Error(`Erreur création plan: ${planError.message}`);
        }
        if (!newPlan) {
          throw new Error('Plan créé mais pas de données retournées');
        }
        planId = newPlan.id;
        console.log('New plan created:', planId);
      }
      
      // 2. Fetch current scenario fleet_composition
      console.log('Fetching scenario fleet_composition...');
      const { data: scenarioData, error: fetchError } = await supabase
        .from('scenarios')
        .select('fleet_composition, project_id')
        .eq('id', targetScenarioId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching scenario:', fetchError);
        throw new Error(`Erreur récupération scénario: ${fetchError.message}`);
      }
      if (!scenarioData) {
        throw new Error('Scénario introuvable');
      }
      
      console.log('Current fleet_composition:', scenarioData.fleet_composition);
      
      // 3. Update scenario's fleet_composition with infrastructure block
      const existingFleet = scenarioData.fleet_composition as Record<string, unknown>;
      const updatedFleet = {
        ...existingFleet,
        infrastructure: {
          source: 'infrastructure_plan',
          planId: planId,
          totalCapex: totalCapex,
          evCapex: evTotalCapex,
          h2Capex: h2TotalCapex,
          pricingSource: pricingSource,
          updatedAt: new Date().toISOString(),
        },
      };
      
      console.log('Updating scenario with new fleet_composition...');
      const { data: updatedScenario, error: updateError } = await supabase
        .from('scenarios')
        .update({ fleet_composition: updatedFleet })
        .eq('id', targetScenarioId)
        .select('id');
        
      if (updateError) {
        console.error('Error updating scenario:', updateError);
        throw new Error(`Erreur mise à jour scénario: ${updateError.message}`);
      }
      
      if (!updatedScenario || updatedScenario.length === 0) {
        console.error('No scenario returned after update - possible RLS issue');
        throw new Error('Mise à jour scénario bloquée (vérifiez les permissions)');
      }
      
      console.log('Scenario updated successfully:', updatedScenario);

      // 4. RECALCULATE TCO WITH NEW INFRASTRUCTURE
      console.log('Recalculating TCO with new infrastructure...');
      
      // Fetch the full scenario with updated fleet_composition
      const fullScenario = await getScenario(targetScenarioId);
      if (!fullScenario) {
        throw new Error('Scénario complet introuvable après mise à jour');
      }

      // Fetch reference data for the scenario's region
      let refData = DEFAULT_REFERENCE_DATA;
      try {
        refData = await fetchReferenceData(fullScenario.region);
      } catch (e) {
        console.warn('Using default reference data:', e);
      }

      // Calculate and save new TCO result
      const newTcoResult = calculateTCO(fullScenario, refData);
      await saveTCOResult(newTcoResult);
      console.log('TCO recalculated:', {
        totalInfrastructureCost: newTcoResult.totalInfrastructureCost,
        h2StationsCost: newTcoResult.h2StationsCost,
        chargingStationsCost: newTcoResult.chargingStationsCost,
        tcoTotal: newTcoResult.tcoTotal,
      });

      toast({
        title: t('infrastructure.toast.saved', 'Infrastructure appliquée !'),
        description: t('infrastructure.toast.savedDescWithRecalc', 'Les coûts ont été ajoutés au scénario et le TCO a été recalculé.'),
      });
      
      setShowApplyModal(false);
      
      // Navigate back
      if (returnTo) {
        navigate(returnTo);
      } else {
        navigate(`/dashboard/scenarios/${targetScenarioId}/results`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error applying infrastructure:', error);
      toast({
        title: t('infrastructure.toast.error', 'Erreur'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  };

  // Calculations
  const evResult = calculateEVChargers({
    evFleetSize: evVehicleCount,
    batteryCapacity: evBatteryCapacity,
    chargingSpeed: evChargingSpeed,
    hoursAvailable: evChargingHours,
  });

  const h2Result = calculateH2Stations({
    h2FleetSize: h2VehicleCount,
    dailyKgPerVehicle: h2DailyKg,
    refuelingFrequency: h2RefuelingFreq,
    stationCapacity: h2StationCapacity,
    capexPerStation: currentPricing.h2StationCost,
    landAndPermits: currentPricing.h2LandPermits,
  });

  const needsGridUpgrade = evResult.totalPowerCapacity > 200;
  const gridUpgradeCost = needsGridUpgrade ? evGridUpgrade : 0;

  const totalResult = calculateTotalInfrastructure({
    evResult,
    h2Result,
    gridUpgradeCosts: gridUpgradeCost,
  });

  // Derived values
  const h2TotalDailyDemand = h2Result.totalDailyDemand;
  const h2StationsNeeded = h2Result.stationsNeeded;
  const h2PeakDemand = h2TotalDailyDemand / h2OperatingHours;
  const h2StorageRecommended = h2TotalDailyDemand * 1.5;
  const h2TotalCapex = h2Result.totalCapex;
  const h2AnnualOpex = h2TotalCapex * 0.12;

  const chargersNeeded = evResult.chargersNeeded;
  const evTotalPower = evResult.totalPowerCapacity;
  const evTotalDailyKwh = evVehicleCount * evDailyKwh;
  const evTotalCapex = evResult.totalCapex + gridUpgradeCost;
  const evAnnualOpex = evTotalCapex * 0.05;

  const totalCapex = totalResult.totalCapex;
  const totalOpex10y = totalResult.annualOpex * 10;
  const totalVehicles = h2VehicleCount + evVehicleCount;
  const costPerVehicle = totalVehicles > 0 ? totalCapex / totalVehicles : 0;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t('infrastructure.title', 'Calculateur d\'infrastructure')}</h1>
          <p className="text-muted-foreground">
            {t('infrastructure.subtitle', 'Estimez les coûts d\'infrastructure pour votre flotte')}
          </p>
        </div>

        {/* Scenario Source Block */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t('infrastructure.scenarioSource.title', 'Source des données de flotte')}
            </CardTitle>
            <CardDescription>
              {t('infrastructure.scenarioSource.description', 'Connectez un scénario TCO pour éviter la double saisie')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {availableScenarios.length === 0 ? (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{t('infrastructure.scenarioSource.noScenarios', 'Aucun scénario TCO trouvé')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('infrastructure.scenarioSource.createFirst', 'Créez d\'abord un scénario pour connecter l\'infrastructure')}
                  </p>
                </div>
                <Button asChild>
                  <Link to="/dashboard/scenarios/new">
                    <Plus className="h-4 w-4 mr-2" />
                    {t('infrastructure.scenarioSource.createScenario', 'Créer un scénario')}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[250px]">
                  <Select 
                    value={selectedScenarioId || 'none'} 
                    onValueChange={handleScenarioSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('infrastructure.scenarioSource.selectPlaceholder', 'Sélectionner un scénario...')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">{t('infrastructure.scenarioSource.manualEntry', 'Saisie manuelle (sans scénario)')}</span>
                      </SelectItem>
                      {availableScenarios.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            <span className="text-xs text-muted-foreground">({s.projectName})</span>
                            {s.hasInfra && (
                              <Badge variant="secondary" className="text-xs">{t('infrastructure.scenarioSource.linked', 'Lié')}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedScenario && (
                  <div className="flex items-center gap-2 text-sm">
                    {isLoadingScenario ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Badge variant="outline" className="gap-1">
                          <Zap className="h-3 w-3" />
                          {selectedScenario.evCount} EV
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Fuel className="h-3 w-3" />
                          {selectedScenario.h2Count} H₂
                        </Badge>
                        {existingPlanDate && (
                          <Badge variant="secondary" className="gap-1">
                            <RefreshCw className="h-3 w-3" />
                            {t('infrastructure.scenarioSource.lastUpdated', 'Mis à jour')} {existingPlanDate}
                          </Badge>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="ml-2"
                          onClick={() => navigate(`/dashboard/scenarios/${selectedScenarioId}/results`)}
                        >
                          {t('infrastructure.scenarioSource.viewScenario', 'Voir le scénario')}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scenario Data Import Alert */}
        {selectedScenarioId && selectedScenario && (evVehicleCount > 0 || h2VehicleCount > 0) && (
          <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 dark:text-green-200">
              {t('infrastructure.importAlert.title', 'Données importées du scénario')} "{selectedScenario.name}"
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              {evVehicleCount > 0 && h2VehicleCount > 0 
                ? t('infrastructure.importAlert.bothTypes', '{{evCount}} véhicules électriques, {{h2Count}} véhicules hydrogène. Les valeurs ci-dessous sont pré-remplies mais modifiables.', { evCount: evVehicleCount, h2Count: h2VehicleCount })
                : evVehicleCount > 0 
                  ? t('infrastructure.importAlert.evOnly', '{{evCount}} véhicules électriques. Les valeurs ci-dessous sont pré-remplies mais modifiables.', { evCount: evVehicleCount })
                  : t('infrastructure.importAlert.h2Only', '{{h2Count}} véhicules hydrogène. Les valeurs ci-dessous sont pré-remplies mais modifiables.', { h2Count: h2VehicleCount })
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Input Forms - 2 columns */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Hydrogen Infrastructure */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-blue-50 dark:bg-blue-950/20">
              <CardTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-blue-600" />
                {t('infrastructure.h2.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>{t('infrastructure.h2.fleetSize')}</Label>
                <Input
                  type="number"
                  value={h2VehicleCount || ''}
                  onChange={(e) => setH2VehicleCount(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.h2.dailyConsumption')}</Label>
                <Input
                  type="number"
                  value={h2DailyKg || ''}
                  onChange={(e) => setH2DailyKg(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.h2.refuelingFreq')}</Label>
                <Select value={h2RefuelingFreq.toString()} onValueChange={(v) => setH2RefuelingFreq(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{t('infrastructure.h2.daily', 'Quotidien')}</SelectItem>
                    <SelectItem value="2">{t('infrastructure.h2.everyOtherDay', 'Tous les 2 jours')}</SelectItem>
                    <SelectItem value="3">{t('infrastructure.h2.twiceWeekly', '2 fois/semaine')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.h2.stationCapacity')}</Label>
                <Select value={h2StationCapacity} onValueChange={(v) => setH2StationCapacity(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100 kg/jour</SelectItem>
                    <SelectItem value="200">200 kg/jour</SelectItem>
                    <SelectItem value="500">500 kg/jour</SelectItem>
                    <SelectItem value="1000">1000 kg/jour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.h2.operatingHours')}</Label>
                <Input
                  type="number"
                  value={h2OperatingHours}
                  onChange={(e) => setH2OperatingHours(parseInt(e.target.value) || 12)}
                  min={4}
                  max={24}
                />
              </div>
              
              {h2VehicleCount > 0 && (
                <BreakdownCard
                  title={t('infrastructure.h2.stationsRequired', 'Résumé H₂')}
                  items={[
                    { label: t('infrastructure.h2.totalCapacity', 'Demande quotidienne'), value: `${h2TotalDailyDemand.toFixed(0)} kg`, source: pricingSource === 'custom' ? 'user_input' : 'reference_data' },
                    { label: t('infrastructure.h2.stationsRequired', 'Stations requises'), value: h2StationsNeeded, source: 'calculated' },
                    { label: t('infrastructure.h2.peakDemand', 'Demande de pointe'), value: `${h2PeakDemand.toFixed(1)} kg/h`, source: 'calculated' },
                    { label: t('infrastructure.h2.storageRecommended', 'Stockage recommandé'), value: `${h2StorageRecommended.toFixed(0)} kg`, source: 'calculated' },
                  ]}
                  total={{ label: t('infrastructure.h2.totalCapex', 'CAPEX H₂'), value: formatCurrency(h2TotalCapex) }}
                />
              )}
            </CardContent>
          </Card>

          {/* EV Infrastructure */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="bg-green-50 dark:bg-green-950/20">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                {t('infrastructure.ev.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>{t('infrastructure.ev.fleetSize')}</Label>
                <Input
                  type="number"
                  value={evVehicleCount || ''}
                  onChange={(e) => setEvVehicleCount(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.ev.batteryCapacity')}</Label>
                <Input
                  type="number"
                  value={evBatteryCapacity}
                  onChange={(e) => setEvBatteryCapacity(parseInt(e.target.value) || 100)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.ev.dailyCharging')}</Label>
                <Input
                  type="number"
                  value={evDailyKwh || ''}
                  onChange={(e) => setEvDailyKwh(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.ev.chargingSpeed')}</Label>
                <Select value={evChargingSpeed} onValueChange={(v) => setEvChargingSpeed(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">{t('infrastructure.ev.speeds.slow', 'Lent')} (7-19 kW)</SelectItem>
                    <SelectItem value="fast">{t('infrastructure.ev.speeds.fast', 'Rapide')} (50-150 kW)</SelectItem>
                    <SelectItem value="ultra">{t('infrastructure.ev.speeds.ultra', 'Ultra-rapide')} (350+ kW)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{t('infrastructure.ev.chargingHours')}</Label>
                <Input
                  type="number"
                  value={evChargingHours}
                  onChange={(e) => setEvChargingHours(parseInt(e.target.value) || 8)}
                  min={1}
                  max={24}
                />
              </div>
              
              {needsGridUpgrade && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {t('infrastructure.ev.gridUpgrade')}
                  </Label>
                  <Input
                    type="number"
                    value={evGridUpgrade}
                    onChange={(e) => setEvGridUpgrade(parseInt(e.target.value) || 0)}
                    placeholder={t('infrastructure.ev.gridUpgradeCost', 'Coût estimé du raccordement')}
                  />
                  <p className="text-xs text-amber-600">
                    {t('infrastructure.grid.upgradeDesc', 'Puissance requise > 200 kW : mise à niveau réseau probable')}
                  </p>
                </div>
              )}
              
              {evVehicleCount > 0 && (
                <BreakdownCard
                  title={t('infrastructure.ev.chargersRequired', 'Résumé EV')}
                  items={[
                    { label: t('infrastructure.ev.chargersRequired', 'Bornes requises'), value: chargersNeeded, source: 'calculated' },
                    { label: t('infrastructure.ev.totalPower', 'Puissance totale'), value: `${evTotalPower} kW`, source: 'calculated' },
                    { label: t('infrastructure.ev.dailyCharging', 'Énergie quotidienne'), value: `${evTotalDailyKwh.toFixed(0)} kWh`, source: 'calculated' },
                    ...(needsGridUpgrade ? [{ label: t('infrastructure.ev.gridUpgradeCost', 'Coût réseau'), value: formatCurrency(gridUpgradeCost), source: 'user_input' as const }] : []),
                  ]}
                  total={{ label: t('infrastructure.ev.totalCapex', 'CAPEX EV'), value: formatCurrency(evTotalCapex) }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pricing Selector */}
        <InfrastructurePricingSelector
          selectedSource={pricingSource}
          onSourceChange={setPricingSource}
          currentPricing={currentPricing}
          onPricingChange={setCurrentPricing}
        />

        {/* Results Summary */}
        {hasUserInput && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                {t('infrastructure.summary.title', 'Résultats du calcul')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Récapitulatif des paramètres saisis */}
              <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                {h2VehicleCount > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-blue-600 mb-2 flex items-center gap-1">
                      <Fuel className="h-4 w-4" />
                      {t('infrastructure.h2.title', 'Hydrogène')}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• {h2VehicleCount} {t('common.vehicles', 'véhicules')}</li>
                      <li>• {h2DailyKg} kg/jour par véhicule</li>
                      <li>• Ravitaillement : {getRefuelingFreqLabel(h2RefuelingFreq)}</li>
                      <li>• Capacité station : {h2StationCapacity} kg/jour</li>
                      <li>• {h2OperatingHours}h d'opération</li>
                    </ul>
                  </div>
                )}
                {evVehicleCount > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-green-600 mb-2 flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      {t('infrastructure.ev.title', 'Électrique')}
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• {evVehicleCount} {t('common.vehicles', 'véhicules')}</li>
                      <li>• Batterie : {evBatteryCapacity} kWh</li>
                      <li>• Conso/jour : {evDailyKwh} kWh</li>
                      <li>• Vitesse : {getChargingSpeedLabel(evChargingSpeed)}</li>
                      <li>• {evChargingHours}h de charge disponible</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Résultats calculés */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {h2VehicleCount > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-muted-foreground mb-1">{t('infrastructure.h2.title', 'Infrastructure H₂')}</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(h2TotalCapex)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{h2StationsNeeded} {t('infrastructure.h2.stationsLower', 'station(s)')}</p>
                  </div>
                )}
                {evVehicleCount > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center border border-green-200 dark:border-green-800">
                    <p className="text-sm text-muted-foreground mb-1">{t('infrastructure.ev.title', 'Infrastructure EV')}</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(evTotalCapex)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{chargersNeeded} {t('infrastructure.ev.chargersLower', 'borne(s)')}</p>
                  </div>
                )}
                <div className="p-4 bg-primary/10 rounded-lg text-center border border-primary/30">
                  <p className="text-sm text-muted-foreground mb-1">{t('infrastructure.summary.totalCapex', 'CAPEX Total')}</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalCapex)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatCurrency(costPerVehicle)}/{t('common.perVehicle', 'per vehicle')}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-secondary rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{t('infrastructure.summary.totalOpex10y', 'OPEX 10 ans')}</p>
                  <p className="text-lg font-bold">{formatCurrency(totalOpex10y)}</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{t('infrastructure.summary.total10Year', 'Coût total 10 ans')}</p>
                  <p className="text-lg font-bold">{formatCurrency(totalCapex + totalOpex10y)}</p>
                </div>
              </div>

              {/* Bouton appliquer */}
              <div className="flex justify-center pt-4">
                {selectedScenarioId ? (
                  <Button 
                    size="lg" 
                    onClick={() => handleApplyToScenario(selectedScenarioId)}
                    disabled={isApplying || totalCapex === 0}
                    className="gap-2"
                  >
                    {isApplying ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Check className="h-5 w-5" />
                    )}
                    {existingPlanDate 
                      ? t('infrastructure.actions.updateScenario', 'Mettre à jour le scénario')
                      : t('infrastructure.actions.applyToSelected', 'Appliquer au scénario sélectionné')
                    }
                  </Button>
                ) : (
                  <Button 
                    size="lg" 
                    onClick={() => setShowApplyModal(true)}
                    disabled={isApplying || totalCapex === 0 || availableScenarios.length === 0}
                    className="gap-2"
                  >
                    <ArrowRight className="h-5 w-5" />
                    {t('infrastructure.actions.applyToScenario', 'Appliquer à un scénario')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal for selecting scenario (only when no scenario pre-selected) */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('infrastructure.modal.title', 'Appliquer à un scénario')}</DialogTitle>
            <DialogDescription>
              {t('infrastructure.modal.description', 'Les coûts d\'infrastructure seront ajoutés au scénario et le TCO sera recalculé automatiquement.')}
            </DialogDescription>
          </DialogHeader>
          
          {/* Cost summary */}
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            {evVehicleCount > 0 && (
              <div className="flex justify-between text-sm">
                <span>{t('infrastructure.ev.chargers', 'Bornes EV')} ({chargersNeeded})</span>
                <span className="font-medium">{formatCurrency(evTotalCapex)}</span>
              </div>
            )}
            {h2VehicleCount > 0 && (
              <div className="flex justify-between text-sm">
                <span>{t('infrastructure.h2.stations', 'Stations H₂')} ({h2StationsNeeded})</span>
                <span className="font-medium">{formatCurrency(h2TotalCapex)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between font-bold">
              <span>{t('infrastructure.summary.totalCapex', 'CAPEX Total')}</span>
              <span className="text-primary">{formatCurrency(totalCapex)}</span>
            </div>
          </div>
          
          {/* Scenario selector */}
          <div className="space-y-2">
            <Label>{t('infrastructure.modal.selectScenario', 'Sélectionner le scénario')}</Label>
            {availableScenarios.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                <p>{t('infrastructure.scenarioSource.noScenarios', 'Aucun scénario disponible.')}</p>
                <Button asChild variant="link" className="p-0 h-auto mt-1">
                  <Link to="/dashboard/scenarios/new">
                    {t('infrastructure.scenarioSource.createScenario', 'Créer un scénario')}
                  </Link>
                </Button>
              </div>
            ) : (
              <Select value={modalScenarioId || ''} onValueChange={setModalScenarioId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('infrastructure.modal.choosePlaceholder', 'Choisir un scénario...')} />
                </SelectTrigger>
                <SelectContent>
                  {availableScenarios.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span>{s.name}</span>
                        <span className="text-xs text-muted-foreground">({s.projectName})</span>
                        {s.hasInfra && (
                          <Badge variant="secondary" className="text-xs">{t('infrastructure.scenarioSource.linked', 'Déjà lié')}</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowApplyModal(false)}>
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button 
              onClick={() => modalScenarioId && handleApplyToScenario(modalScenarioId)} 
              disabled={!modalScenarioId || isApplying}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t('common.apply', 'Appliquer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

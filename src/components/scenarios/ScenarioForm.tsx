import { useMemo, useState, useEffect, useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSubscription } from '@/hooks/useSubscription';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  CreateScenarioForm,
  Region,
  Country,
  COUNTRIES,
  STATES_PROVINCES,
  VehicleCategory,
  VEHICLE_CATEGORY_LABELS,
  PTAC_OPTIONS,
  CurrentPowertrain,
  CURRENT_POWERTRAIN_LABELS,
  TargetPowertrain,
  TARGET_POWERTRAIN_LABELS,
  TripType,
  TRIP_TYPE_LABELS,
  ChargingTime,
  CHARGING_TIME_LABELS,
  LoadProfile,
  LOAD_PROFILE_LABELS,
  MinTemperature,
  MIN_TEMPERATURE_LABELS,
  MaxTemperature,
  MAX_TEMPERATURE_LABELS,
  TerrainType,
  TERRAIN_TYPE_LABELS,
} from '@/lib/calculations/types';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { VehicleLimitAlert } from './VehicleLimitAlert';
import { PriceGuidance } from './PriceGuidance';
import { DataSourceSelector, type DataSourceType } from './DataSourceSelector';
import { ConditionImpactBadge } from './ConditionImpactBadge';
import { useMultiplierOverrides } from '@/hooks/useMultiplierOverrides';
import { 
  getTemperatureMultiplierId, 
  getTerrainMultiplierId, 
  getTripTypeMultiplierId, 
  getLoadProfileMultiplierId 
} from '@/lib/calculations/conditionMapping';
import { getMultiplierByCategoryAndKey, MultiplierSource } from '@/lib/calculations/configurableMultipliers';
import { getDefaultH2ConsumptionByPtac, getH2ConsumptionSource } from '@/lib/calculations/h2Defaults';
import { Truck, Zap, Route, MapPin, DollarSign, Fuel, Atom, AlertTriangle, CheckCircle, Info, Lightbulb, Percent, Check, Satellite, Edit3, BookOpen, Calculator, X, Clock, Shield, Thermometer, Leaf, Gauge } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// Data source provenance type for tracking field sources
type FieldSourceType = 'telematics' | 'manual' | 'reference' | 'calculated' | 'default';

interface FieldSources {
  vehicleCount: FieldSourceType;
  annualKm: FieldSourceType;
  electricityPrice: FieldSourceType;
  dieselPrice: FieldSourceType;
  hydrogenPrice: FieldSourceType;
}

// Helper component for data source badge
function SourceBadge({ source, className }: { source: FieldSourceType; className?: string }) {
  const { t } = useTranslation();
  
  const config: Record<FieldSourceType, { icon: React.ReactNode; label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    telematics: { icon: <Satellite className="h-3 w-3" />, label: t('dataProvenance.sources.telematics', 'Telematics'), variant: 'default' },
    manual: { icon: <Edit3 className="h-3 w-3" />, label: t('dataProvenance.sources.manual', 'Manual'), variant: 'secondary' },
    reference: { icon: <BookOpen className="h-3 w-3" />, label: t('dataProvenance.sources.reference', 'Ref. Data'), variant: 'outline' },
    calculated: { icon: <Calculator className="h-3 w-3" />, label: t('dataProvenance.sources.calculated', 'Calculated'), variant: 'outline' },
    default: { icon: <BookOpen className="h-3 w-3" />, label: t('dataProvenance.sources.default', 'Default'), variant: 'outline' },
  };
  
  const { icon, label, variant } = config[source];
  
  return (
    <Badge variant={variant} className={`text-xs gap-1 ${className}`}>
      {icon}
      {label}
    </Badge>
  );
}

// Helper to extract country from region code (Canada only)
const getCountryFromRegion = (region: string): Country => {
  return 'Canada';
};

// Helper to get default region for a country (Canada only)
const getDefaultRegion = (country: Country): Region => {
  return 'Canada';
};

// Type for powertrain mix record
type PowertrainMixRecord = Record<TargetPowertrain, number>;

const defaultPowertrainMix: PowertrainMixRecord = {
  diesel: 0,
  bev: 100,
  fcev: 0,
  phev: 0,
  biomethane: 0,
};

// Helper to handle optional number fields that may be empty strings
const optionalNumber = (min?: number, max?: number) => {
  let schema = z.union([
    z.literal('').transform(() => undefined),
    z.coerce.number()
  ]).optional();
  
  return schema.refine(
    (val) => {
      if (val === undefined) return true;
      if (min !== undefined && val < min) return false;
      if (max !== undefined && val > max) return false;
      return true;
    },
    { message: `Valeur doit être entre ${min ?? 0} et ${max ?? '∞'}` }
  );
};

const scenarioSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100),
  country: z.enum(['Canada']),
  stateProvince: z.string().min(1, 'State/Province requis'),
  analysisYears: z.coerce.number().min(1).max(30),
  discountRate: z.coerce.number().min(0).max(20),

  // Section A - Vehicle Type
  category: z.string().min(1, 'Catégorie requise'),
  ptac: z.string().optional(),
  currentPowertrain: z.string().min(1, 'Motorisation actuelle requise'),
  // Multiple target powertrains - stored in form
  targetPowertrains: z.array(z.string()).min(1, 'Sélectionnez au moins une motorisation cible'),
  // Powertrain mix with validation for total = 100%
  powertrainMix: z.record(z.string(), z.number()).refine(
    (mix) => {
      const total = Object.values(mix).reduce((sum, v) => sum + (v || 0), 0);
      return Math.abs(total - 100) < 0.01; // Allow small floating point tolerance
    },
    { message: 'Le total de la répartition doit être égal à 100%' }
  ).optional(),

  // Section B - Operational Usage
  annualKm: z.coerce.number().min(1000, 'Min 1000 km'),
  tripType: z.string().min(1, 'Type de trajets requis'),
  minAutonomy: z.coerce.number().min(0),
  chargingTime: z.string().min(1, 'Temps de recharge requis'),
  loadProfile: z.string().min(1, 'Profil de charge requis'),
  vehicleCount: z.coerce.number().min(1, 'Min 1 véhicule'),

  // Section C - Environmental Constraints
  minTemperature: z.string().min(1, 'Température min requise'),
  maxTemperature: z.string().min(1, 'Température max requise'),
  terrainTypes: z.array(z.string()).min(1, 'Sélectionnez au moins un type de terrain'),

  // Section D - Economic Data
  currentVehiclePrice: z.coerce.number().min(0),
  alternativeVehiclePrice: z.coerce.number().min(0),
  // Per-powertrain vehicle prices for mixed strategies
  vehiclePrices: z.record(z.string(), z.number()).optional(),
  currentConsumption: z.coerce.number().min(0),
  annualMaintenanceCost: z.coerce.number().min(0),
  subsidies: optionalNumber(0),
  
  // Vehicle life and residual value - truly optional, empty = use defaults
  vehicleLifeYears: optionalNumber(5, 25),
  residualValuePercent: optionalNumber(0, 50),
  
  // Custom consumption per powertrain - truly optional
  consumptionBev: optionalNumber(0),
  consumptionH2: optionalNumber(0),
  consumptionBiomethane: optionalNumber(0),
  consumptionPhev: optionalNumber(0),
  
  // Custom infrastructure
  customInfraEnabled: z.boolean().optional(),
  infrastructureCostPerVehicle: optionalNumber(0),
  
  // User-provided energy prices
  electricityPrice: z.coerce.number().min(0, 'Prix électricité requis'),
  dieselPrice: z.coerce.number().min(0, 'Prix diesel requis'),
  hydrogenPrice: optionalNumber(0),
  
  // H2 specific parameters - truly optional when disabled
  h2Type: z.enum(['green', 'blue', 'grey']).optional(),
  fcStackReplacementEnabled: z.boolean().optional(),
  fcStackReplacementCost: optionalNumber(0),
  fcStackLifespanYears: optionalNumber(3, 15),
  h2InflationEnabled: z.boolean().optional(),
  h2InflationRate: optionalNumber(-20, 20),
  h2InfraScaleEnabled: z.boolean().optional(),
  h2InfraScaleFactor: optionalNumber(0, 50),

  // Section E - Operational Costs (Advanced) - truly optional
  downtimeHoursPerYear: optionalNumber(0),
  downtimeCostPerHour: optionalNumber(0),
  insuranceBaseline: optionalNumber(0),
  insuranceEvPremiumPercent: optionalNumber(0, 100),
  insuranceH2PremiumPercent: optionalNumber(0, 100),
  telematicsProvider: z.string().optional(),
  telematicsCostPerMonth: optionalNumber(0),

  // Section F - Energy Parameters (Advanced) - truly optional
  gridDemandChargePerKw: optionalNumber(0),
  touEnabled: z.boolean().optional(),
  touOffPeakPrice: optionalNumber(0),
  touOnPeakPrice: optionalNumber(0),
  touOffPeakPercent: optionalNumber(0, 100),

  // Section G - Carbon Credits (Advanced) - truly optional
  // Note: Cold weather impact is handled automatically via temperature multiplier in Section C
  carbonCreditsEnabled: z.boolean().optional(),
  carbonCreditsProgram: z.string().optional(),
  carbonCreditsPrice: optionalNumber(0),
});

type FormValues = z.infer<typeof scenarioSchema>;

interface ScenarioFormProps {
  onSubmit: (data: CreateScenarioForm) => void;
  onCancel?: () => void;
  initialData?: Partial<CreateScenarioForm>;
  isLoading?: boolean;
}

interface Recommendation {
  type: 'success' | 'warning' | 'info';
  message: string;
}

export function ScenarioForm({ onSubmit, onCancel, initialData, isLoading }: ScenarioFormProps) {
  const { t, i18n } = useTranslation();
  const { vehicleLimit, isUnlimited, isVehicleCountAllowed } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dataSource, setDataSource] = useState<DataSourceType>('manual');
  const [fieldSources, setFieldSources] = useState<FieldSources>({
    vehicleCount: 'default',
    annualKm: 'default',
    electricityPrice: 'default',
    dieselPrice: 'default',
    hydrogenPrice: 'default',
  });
  
  // Telematics prefill banner state
  const [showTelematicsBanner, setShowTelematicsBanner] = useState(false);
  const [telematicsPrefillData, setTelematicsPrefillData] = useState<{
    vehicleCount: number;
    annualKm: number;
    fuelConsumption: number;
  } | null>(null);

  // Multiplier overrides for expert adjustments
  const {
    overrides: multiplierOverrides,
    getMultiplier,
    setMultiplier,
    resetToSystem,
    isOverridden,
    overrideCount,
  } = useMultiplierOverrides(
    initialData?.vehicleConfiguration?.multiplierOverrides
  );
  
  // Handler for multiplier changes from impact badges
  const handleMultiplierChange = useCallback((multiplierId: string, value: number, source: MultiplierSource) => {
    if (source === 'expert') {
      setMultiplier(multiplierId, value);
    } else {
      resetToSystem(multiplierId);
    }
  }, [setMultiplier, resetToSystem]);

  // Track manual edits to update field sources
  const handleManualFieldChange = (field: keyof FieldSources) => {
    setFieldSources(prev => ({
      ...prev,
      [field]: 'manual',
    }));
  };

  // Compute initial values for powertrains
  const initialTargetPowertrains: TargetPowertrain[] =
    initialData?.vehicleConfiguration?.targetPowertrains?.length
      ? (initialData.vehicleConfiguration.targetPowertrains as TargetPowertrain[])
      : ['bev'];

  const computeInitialMix = (): PowertrainMixRecord => {
    const base: PowertrainMixRecord = { diesel: 0, bev: 0, fcev: 0, phev: 0, biomethane: 0 };
    const fromInitial = initialData?.vehicleConfiguration?.targetPowertrainMix as
      | Partial<PowertrainMixRecord>
      | undefined;

    if (fromInitial) {
      return {
        diesel: fromInitial.diesel ?? 0,
        bev: fromInitial.bev ?? 0,
        fcev: fromInitial.fcev ?? 0,
        phev: fromInitial.phev ?? 0,
        biomethane: fromInitial.biomethane ?? 0,
      };
    }

    const equalShare = Math.floor(100 / initialTargetPowertrains.length);
    const remainder = 100 - equalShare * initialTargetPowertrains.length;
    initialTargetPowertrains.forEach((p, index) => {
      base[p] = equalShare + (index === 0 ? remainder : 0);
    });
    return base;
  };

  const initialRegion = (initialData?.region || 'Canada') as Region;
  const initialCountry = getCountryFromRegion(initialRegion);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(scenarioSchema),
    defaultValues: {
      name: initialData?.name || '',
      country: initialCountry,
      stateProvince: initialRegion,
      analysisYears: initialData?.analysisYears || 10,
      discountRate: initialData?.discountRate || 5,
      category: initialData?.vehicleConfiguration?.category || 'rigid_truck',
      ptac: initialData?.vehicleConfiguration?.ptac || '19T',
      currentPowertrain: initialData?.vehicleConfiguration?.currentPowertrain || 'diesel',
      targetPowertrains: initialTargetPowertrains,
      powertrainMix: computeInitialMix(),
      annualKm: initialData?.vehicleConfiguration?.annualKm || 80000,
      tripType: initialData?.vehicleConfiguration?.tripType || 'periurban',
      minAutonomy: initialData?.vehicleConfiguration?.minAutonomy || 200,
      chargingTime: initialData?.vehicleConfiguration?.chargingTime || 'night_8h',
      loadProfile: initialData?.vehicleConfiguration?.loadProfile || 'medium',
      vehicleCount: initialData?.vehicleConfiguration?.vehicleCount || 10,
      minTemperature: initialData?.vehicleConfiguration?.minTemperature || '0',
      maxTemperature: initialData?.vehicleConfiguration?.maxTemperature || '35',
      terrainTypes: initialData?.vehicleConfiguration?.terrainTypes || ['flat'],
      currentVehiclePrice: initialData?.vehicleConfiguration?.currentVehiclePrice || 120000,
      alternativeVehiclePrice: initialData?.vehicleConfiguration?.alternativeVehiclePrice || 280000,
      vehiclePrices: initialData?.vehicleConfiguration?.vehiclePrices || {
        diesel: 120000,
        bev: 280000,
        fcev: 350000,
        phev: 200000,
        biomethane: 150000,
      },
      currentConsumption: initialData?.vehicleConfiguration?.currentConsumption || 32,
      annualMaintenanceCost: initialData?.vehicleConfiguration?.annualMaintenanceCost || 12000,
      subsidies: initialData?.vehicleConfiguration?.subsidies || 0,
      // Vehicle life and residual value
      vehicleLifeYears: initialData?.vehicleConfiguration?.vehicleLifeYears,
      residualValuePercent: initialData?.vehicleConfiguration?.residualValuePercent,
      // Custom consumption
      consumptionBev: initialData?.vehicleConfiguration?.consumptionBev,
      consumptionH2: initialData?.vehicleConfiguration?.consumptionH2,
      consumptionBiomethane: initialData?.vehicleConfiguration?.consumptionBiomethane,
      consumptionPhev: initialData?.vehicleConfiguration?.consumptionPhev,
      // Custom infrastructure
      customInfraEnabled: initialData?.vehicleConfiguration?.customInfraEnabled || false,
      infrastructureCostPerVehicle: initialData?.vehicleConfiguration?.infrastructureCostPerVehicle,
      // Energy prices
      hydrogenPrice: initialData?.vehicleConfiguration?.hydrogenPrice || 12,
      electricityPrice: initialData?.vehicleConfiguration?.electricityPrice || 0.12,
      dieselPrice: initialData?.vehicleConfiguration?.dieselPrice || 1.50,
      // H2 specific parameters
      h2Type: (initialData?.vehicleConfiguration as any)?.h2Type || 'blue',
      fcStackReplacementEnabled: initialData?.vehicleConfiguration?.fcStackReplacementEnabled || false,
      fcStackReplacementCost: initialData?.vehicleConfiguration?.fcStackReplacementCost,
      fcStackLifespanYears: initialData?.vehicleConfiguration?.fcStackLifespanYears,
      h2InflationEnabled: initialData?.vehicleConfiguration?.h2InflationEnabled || false,
      h2InflationRate: initialData?.vehicleConfiguration?.h2InflationRate,
      h2InfraScaleEnabled: initialData?.vehicleConfiguration?.h2InfraScaleEnabled || false,
      h2InfraScaleFactor: initialData?.vehicleConfiguration?.h2InfraScaleFactor,
      // Advanced operational costs defaults
      downtimeHoursPerYear: undefined,
      downtimeCostPerHour: undefined,
      insuranceBaseline: undefined,
      insuranceEvPremiumPercent: undefined,
      insuranceH2PremiumPercent: undefined,
      telematicsProvider: undefined,
      telematicsCostPerMonth: undefined,
      // Advanced energy parameters defaults
      gridDemandChargePerKw: undefined,
      touEnabled: false,
      touOffPeakPrice: undefined,
      touOnPeakPrice: undefined,
      touOffPeakPercent: undefined,
      // Advanced carbon credits defaults
      carbonCreditsEnabled: false,
      carbonCreditsProgram: undefined,
      carbonCreditsPrice: undefined,
    },
  });

  // Check for telematics prefill on mount
  useEffect(() => {
    const source = searchParams.get('source');
    const prefill = searchParams.get('prefill');
    
    if (source === 'telematics' && prefill === 'true') {
      const storedData = sessionStorage.getItem('telematics_prefill');
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setTelematicsPrefillData({
            vehicleCount: data.vehicleCount,
            annualKm: data.annualKm,
            fuelConsumption: data.fuelConsumption,
          });
          setShowTelematicsBanner(true);
          setDataSource('telematics');
        } catch (e) {
          console.error('Error parsing telematics prefill data:', e);
        }
      }
    }
  }, [searchParams]);

  // Apply telematics prefill data
  const handleApplyTelematicsData = () => {
    if (telematicsPrefillData) {
      setValue('vehicleCount', telematicsPrefillData.vehicleCount);
      setValue('annualKm', telematicsPrefillData.annualKm);
      setValue('currentConsumption', telematicsPrefillData.fuelConsumption);
      setFieldSources(prev => ({
        ...prev,
        vehicleCount: 'telematics',
        annualKm: 'telematics',
      }));
      setShowTelematicsBanner(false);
      // Clean up session storage and URL params
      sessionStorage.removeItem('telematics_prefill');
      setSearchParams({});
    }
  };

  const handleDismissTelematicsBanner = () => {
    setShowTelematicsBanner(false);
    setDataSource('manual');
    sessionStorage.removeItem('telematics_prefill');
    setSearchParams({});
  };

  // Watch form values using useWatch for reliable re-renders
  const country = watch('country');
  const stateProvince = watch('stateProvince');
  const category = watch('category');
  const tripType = watch('tripType');
  const annualKm = watch('annualKm');
  const ptac = watch('ptac');
  const minTemperature = watch('minTemperature');
  const chargingTime = watch('chargingTime');
  const vehicleCountValue = watch('vehicleCount') || 0;
  const isOverLimit = !isVehicleCountAllowed(vehicleCountValue);

  // *** Use useWatch for reliable re-renders on array/object fields ***
  const selectedPowertrains = (useWatch({ control, name: 'targetPowertrains' }) || ['bev']) as TargetPowertrain[];
  const powertrainMix = (useWatch({ control, name: 'powertrainMix' }) || defaultPowertrainMix) as PowertrainMixRecord;
  const terrainTypes = (useWatch({ control, name: 'terrainTypes' }) || ['flat']) as string[];
  const vehiclePrices = (useWatch({ control, name: 'vehiclePrices' }) || {}) as Partial<Record<TargetPowertrain, number>>;

  // Check if any selected powertrain needs hydrogen
  const needsHydrogen = selectedPowertrains.includes('fcev');
  // Check if any selected powertrain needs electricity
  const needsElectricity = selectedPowertrains.includes('bev') || selectedPowertrains.includes('phev');

  // Watch current consumptionH2 value
  const currentConsumptionH2 = watch('consumptionH2');
  
  // Calculate smart default H2 consumption based on PTAC
  const defaultH2Consumption = getDefaultH2ConsumptionByPtac(ptac);
  
  // Track if user has manually edited H2 consumption
  const [isH2ConsumptionCustom, setIsH2ConsumptionCustom] = useState(false);
  
  // Pre-fill H2 consumption when FCEV is selected and field is empty
  useEffect(() => {
    if (needsHydrogen && !currentConsumptionH2 && !isH2ConsumptionCustom) {
      setValue('consumptionH2', defaultH2Consumption);
    }
  }, [needsHydrogen, currentConsumptionH2, defaultH2Consumption, setValue, isH2ConsumptionCustom]);
  
  // Update H2 consumption when PTAC changes (if not customized)
  useEffect(() => {
    if (needsHydrogen && !isH2ConsumptionCustom && currentConsumptionH2) {
      // Check if current value matches a previous default (indicating auto-fill)
      const previousDefaults = Object.values(
        { '3.5T': 3.5, '7.5T': 5.0, '12T': 6.5, '19T': 8.0, '26T': 10.0, '44T': 12.0 }
      );
      if (previousDefaults.includes(currentConsumptionH2)) {
        setValue('consumptionH2', defaultH2Consumption);
      }
    }
  }, [ptac, needsHydrogen, isH2ConsumptionCustom, defaultH2Consumption, setValue, currentConsumptionH2]);

  // Check if region has limited H2 infrastructure (outside BC and QC)
  const hasLimitedH2Infrastructure = stateProvince !== 'CA_BC' && stateProvince !== 'CA_QC';

  // Get current state info for price display
  const selectedStateInfo = STATES_PROVINCES[country]?.find((s) => s.code === stateProvince);

  // Handle country change - reset state to national average
  const handleCountryChange = (newCountry: Country) => {
    setValue('country', newCountry);
    setValue('stateProvince', getDefaultRegion(newCountry));
  };

  // Handle powertrain selection change (update form values only)
  const handlePowertrainChange = (powertrain: TargetPowertrain, checked: boolean) => {
    // Create a fresh copy of the current selection
    const currentSelection = [...selectedPowertrains];
    let updated: TargetPowertrain[];

    if (checked) {
      // Add powertrain if not already present
      if (!currentSelection.includes(powertrain)) {
        updated = [...currentSelection, powertrain];
      } else {
        return; // Already selected, no change needed
      }
    } else {
      updated = currentSelection.filter((p) => p !== powertrain);
      // Don't allow deselecting all
      if (updated.length === 0) {
        return;
      }
    }

    // Update form with new powertrain selection
    setValue('targetPowertrains', updated, { 
      shouldValidate: true, 
      shouldDirty: true, 
      shouldTouch: true 
    });

    // Redistribute percentages equally when selection changes
    const equalShare = Math.floor(100 / updated.length);
    const remainder = 100 - equalShare * updated.length;

    const newMix: PowertrainMixRecord = {
      diesel: 0,
      bev: 0,
      fcev: 0,
      phev: 0,
      biomethane: 0,
    };

    updated.forEach((p, index) => {
      newMix[p] = equalShare + (index === 0 ? remainder : 0);
    });

    setValue('powertrainMix', newMix, { 
      shouldValidate: true, 
      shouldDirty: true, 
      shouldTouch: true 
    });

    // Trigger validation to ensure UI updates
    trigger(['targetPowertrains', 'powertrainMix']);
  };

  // Handle powertrain mix slider change
  const handleMixChange = (powertrain: TargetPowertrain, value: number) => {
    if (selectedPowertrains.length < 2) return;

    const otherPowertrains = selectedPowertrains.filter((p) => p !== powertrain);
    const remaining = 100 - value;
    const equalShare = Math.floor(remaining / otherPowertrains.length);
    const remainder = remaining - equalShare * otherPowertrains.length;

    const newMix: PowertrainMixRecord = {
      diesel: 0,
      bev: 0,
      fcev: 0,
      phev: 0,
      biomethane: 0,
    };

    newMix[powertrain] = value;
    otherPowertrains.forEach((p, index) => {
      newMix[p] = equalShare + (index === 0 ? remainder : 0);
    });

    setValue('powertrainMix', newMix, { 
      shouldValidate: true, 
      shouldDirty: true, 
      shouldTouch: true 
    });
  };

  // Generate recommendations based on inputs
  // Note: We use useMemo (no setState) to avoid render loops.
  const computedRecommendations = useMemo(() => {
    const newRecommendations: Recommendation[] = [];
    const dailyKm = annualKm / 250; // Assuming 250 working days

    // Long distance + heavy PTAC → Consider hydrogen
    if (tripType === 'long_distance' && dailyKm > 300 && ['26T', '44T'].includes(ptac || '')) {
      if (!selectedPowertrains.includes('fcev')) {
        newRecommendations.push({
          type: 'warning',
          message: t(
            'scenarios.recommendations.considerFcev',
            'Attention: Autonomie BEV limitée pour ce profil. Considérez FCEV (hydrogène) pour les longues distances avec charge lourde.'
          ),
        });
      }
    }

    // Urban short distance → Ideal for BEV
    if (tripType === 'urban' && dailyKm < 80) {
      newRecommendations.push({
        type: 'success',
        message: t(
          'scenarios.recommendations.idealBev',
          '✅ Profil idéal pour BEV: trajets urbains courts avec recharge nocturne possible.'
        ),
      });
    }

    // Cold temperature warning
    if (minTemperature === '-20' || minTemperature === '-10') {
      newRecommendations.push({
        type: 'warning',
        message: t(
          'scenarios.recommendations.coldWeather',
          '⚠️ Performances batterie réduites par temps froid. Prévoyez une autonomie réduite de 15-25%.'
        ),
      });
    }

    // No fixed charging time
    if (chargingTime === 'no_fixed' && selectedPowertrains.includes('bev')) {
      newRecommendations.push({
        type: 'warning',
        message: t(
          'scenarios.recommendations.noFixedCharging',
          '⚠️ Sans temps de recharge fixe, une infrastructure de recharge rapide sera nécessaire (coût élevé).'
        ),
      });
    }

    // Hydrogen selected but urban use
    if (selectedPowertrains.includes('fcev') && tripType === 'urban') {
      newRecommendations.push({
        type: 'info',
        message: t(
          'scenarios.recommendations.fcevUrban',
          "ℹ️ L'hydrogène est généralement plus adapté aux longues distances. Pour l'urbain, le BEV peut être plus économique."
        ),
      });
    }

    // Mixed strategy info
    if (selectedPowertrains.length > 1) {
      newRecommendations.push({
        type: 'info',
        message: t(
          'scenarios.recommendations.mixedStrategy',
          'ℹ️ Stratégie mixte: les coûts TCO seront pondérés selon la répartition définie.'
        ),
      });
    }

    return newRecommendations;
  }, [tripType, annualKm, ptac, selectedPowertrains, minTemperature, chargingTime, i18n.language, t]);

  const handleTerrainChange = (terrain: TerrainType, checked: boolean) => {
    const currentTerrains = [...terrainTypes];
    const updated = checked
      ? [...currentTerrains, terrain]
      : currentTerrains.filter((t) => t !== terrain);
    setValue('terrainTypes', updated, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
  };

  const handleFormSubmit = (data: FormValues) => {
    const vehicleCount = data.vehicleCount;
    const mix = (data.powertrainMix || defaultPowertrainMix) as PowertrainMixRecord;
    const powertrains = (data.targetPowertrains || ['bev']) as TargetPowertrain[];

    // Calculate fleet composition based on powertrain mix
    // Diesel stays as diesel, EV = BEV + PHEV, H2 = FCEV
    const dieselPercent = (mix.diesel || 0) + (mix.biomethane || 0);
    const evPercent = (mix.bev || 0) + (mix.phev || 0);
    const h2Percent = mix.fcev || 0;
    
    let dieselCount = Math.round(vehicleCount * dieselPercent / 100);
    let evCount = Math.round(vehicleCount * evPercent / 100);
    let h2Count = Math.round(vehicleCount * h2Percent / 100);
    
    // Adjust for rounding errors - ensure total equals vehicleCount
    const allocated = dieselCount + evCount + h2Count;
    if (allocated !== vehicleCount) {
      const diff = vehicleCount - allocated;
      // Add difference to the largest group
      const maxCount = Math.max(dieselCount, evCount, h2Count);
      if (evCount === maxCount) {
        evCount += diff;
      } else if (h2Count === maxCount) {
        h2Count += diff;
      } else {
        dieselCount += diff;
      }
    }

    // Build operationalCosts if any advanced fields are provided
    const hasOperationalCosts = data.downtimeHoursPerYear || data.insuranceBaseline || data.telematicsCostPerMonth;
    const hasEnergyCosts = data.gridDemandChargePerKw || data.touEnabled;
    const hasEnvironmental = data.carbonCreditsEnabled;

    const operationalCosts = hasOperationalCosts ? {
      downtime: (data.downtimeHoursPerYear && data.downtimeCostPerHour) ? {
        hoursPerYear: data.downtimeHoursPerYear,
        costPerHour: data.downtimeCostPerHour,
      } : undefined,
      insurance: data.insuranceBaseline ? {
        dieselBaseline: data.insuranceBaseline,
        evPremium: data.insuranceBaseline * (data.insuranceEvPremiumPercent || 0) / 100,
        h2Premium: data.insuranceBaseline * (data.insuranceH2PremiumPercent || 0) / 100,
      } : undefined,
      telematics: data.telematicsCostPerMonth ? {
        provider: (data.telematicsProvider || 'other') as 'geotab' | 'samsara' | 'other' | 'none',
        costPerVehiclePerMonth: data.telematicsCostPerMonth,
      } : undefined,
    } : undefined;

    const energyCosts = hasEnergyCosts ? {
      gridCharges: data.gridDemandChargePerKw ? {
        demandCharge: data.gridDemandChargePerKw,
        touRates: data.touEnabled ? {
          offPeak: data.touOffPeakPrice || 0,
          midPeak: ((data.touOffPeakPrice || 0) + (data.touOnPeakPrice || 0)) / 2, // Approximate mid-peak
          onPeak: data.touOnPeakPrice || 0,
          offPeakPercentage: data.touOffPeakPercent || 70,
        } : undefined,
      } : undefined,
    } : undefined;

    const environmental = hasEnvironmental ? {
      carbonCredits: data.carbonCreditsEnabled ? {
        enabled: true,
        program: (data.carbonCreditsProgram || 'none') as 'LCFS' | 'ZEV' | 'none',
        pricePerTonne: data.carbonCreditsPrice || 0,
      } : undefined,
      // Note: Cold weather impact is now handled automatically via temperature multiplier in Section C
    } : undefined;

    const scenarioData: CreateScenarioForm = {
      name: data.name,
      region: data.stateProvince as Region,
      analysisYears: data.analysisYears,
      discountRate: data.discountRate,
      fleetComposition: {
        diesel: { count: dieselCount, annualKm: data.annualKm },
        ev: { count: evCount, annualKm: data.annualKm },
        hydrogen: { count: h2Count, annualKm: data.annualKm },
        operationalCosts,
        energyCosts,
        environmental,
      },
      vehicleConfiguration: {
        category: data.category as VehicleCategory,
        ptac: data.ptac as any,
        currentPowertrain: data.currentPowertrain as CurrentPowertrain,
        targetPowertrains: powertrains,
        targetPowertrainMix: mix,
        annualKm: data.annualKm,
        tripType: data.tripType as TripType,
        minAutonomy: data.minAutonomy,
        chargingTime: data.chargingTime as ChargingTime,
        loadProfile: data.loadProfile as LoadProfile,
        vehicleCount: data.vehicleCount,
        minTemperature: data.minTemperature as MinTemperature,
        maxTemperature: data.maxTemperature as MaxTemperature,
        terrainTypes: data.terrainTypes as TerrainType[],
        currentVehiclePrice: data.currentVehiclePrice,
        alternativeVehiclePrice: data.alternativeVehiclePrice,
        vehiclePrices: data.vehiclePrices as Partial<Record<TargetPowertrain, number>>,
        currentConsumption: data.currentConsumption,
        annualMaintenanceCost: data.annualMaintenanceCost,
        subsidies: data.subsidies,
        // Vehicle life and residual value
        vehicleLifeYears: data.vehicleLifeYears,
        residualValuePercent: data.residualValuePercent,
        // Custom consumption
        consumptionBev: data.consumptionBev,
        consumptionH2: data.consumptionH2,
        consumptionBiomethane: data.consumptionBiomethane,
        consumptionPhev: data.consumptionPhev,
        // Custom infrastructure
        customInfraEnabled: data.customInfraEnabled,
        infrastructureCostPerVehicle: data.infrastructureCostPerVehicle,
        // Energy prices
        hydrogenPrice: data.hydrogenPrice,
        electricityPrice: data.electricityPrice || 0.12,
        dieselPrice: data.dieselPrice || 1.50,
        // H2 specific parameters
        h2Type: data.h2Type || 'blue',
        fcStackReplacementEnabled: data.fcStackReplacementEnabled,
        fcStackReplacementCost: data.fcStackReplacementCost,
        fcStackLifespanYears: data.fcStackLifespanYears,
        h2InflationEnabled: data.h2InflationEnabled,
        h2InflationRate: data.h2InflationRate,
        h2InfraScaleEnabled: data.h2InfraScaleEnabled,
        h2InfraScaleFactor: data.h2InfraScaleFactor,
        // Expert multiplier overrides
        multiplierOverrides: Object.keys(multiplierOverrides).length > 0 ? multiplierOverrides : undefined,
      },
    };
    onSubmit(scenarioData);
  };

  // Handle data source changes - prefill fields from telematics or reference
  const handleDataSourceChange = (source: DataSourceType) => {
    setDataSource(source);
  };

  const handleTelematicsData = (data: { vehicleCount: number; annualKm: number; fuelConsumption: number }) => {
    setValue('vehicleCount', data.vehicleCount);
    setValue('annualKm', data.annualKm);
    setValue('currentConsumption', data.fuelConsumption);
    setFieldSources(prev => ({
      ...prev,
      vehicleCount: 'telematics',
      annualKm: 'telematics',
    }));
  };

  const handleReferenceData = (data: { annualKm: number; electricityPrice: number; dieselPrice: number; hydrogenPrice: number }) => {
    setValue('annualKm', data.annualKm);
    setValue('electricityPrice', data.electricityPrice);
    setValue('dieselPrice', data.dieselPrice);
    setValue('hydrogenPrice', data.hydrogenPrice);
    setFieldSources(prev => ({
      ...prev,
      annualKm: 'reference',
      electricityPrice: 'reference',
      dieselPrice: 'reference',
      hydrogenPrice: 'reference',
    }));
  };

  const showPTAC = ['rigid_truck', 'tractor'].includes(category);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Telematics Data Available Banner */}
      {showTelematicsBanner && telematicsPrefillData && (
        <Alert className="border-primary/50 bg-primary/5">
          <Satellite className="h-4 w-4 text-primary" />
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="font-medium">{t('scenarios.telematicsDataAvailable', 'Telematics Data Available')}</span>
              <span className="text-muted-foreground ml-2">
                {t('scenarios.telematicsDataAvailableDesc', '{{count}} vehicles detected. Use as starting point?', { count: telematicsPrefillData.vehicleCount })}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleApplyTelematicsData}
              >
                <Satellite className="h-3 w-3 mr-1" />
                {t('scenarios.useTelematicsData', 'Use My Data')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleDismissTelematicsBanner}
              >
                <X className="h-3 w-3 mr-1" />
                {t('scenarios.enterManually', 'Enter Manually')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Source Selector - FIRST */}
      <DataSourceSelector
        selectedSource={dataSource}
        onSourceChange={handleDataSourceChange}
        onTelematicsData={handleTelematicsData}
        onReferenceData={handleReferenceData}
        region={stateProvince}
      />

      {/* Recommendations - only show if there are warnings or important info */}
      {computedRecommendations.filter(r => r.type === 'warning').length > 0 && (
        <div className="space-y-2">
          {computedRecommendations.filter(r => r.type === 'warning').map((rec, idx) => (
            <Alert
              key={idx}
              variant="destructive"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{rec.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {computedRecommendations.length > 0 && (
        <div className="space-y-2">
          {computedRecommendations.map((rec, idx) => (
            <Alert
              key={idx}
              variant={rec.type === 'warning' ? 'destructive' : 'default'}
              className={
                rec.type === 'success'
                  ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                  : rec.type === 'info'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : ''
              }
            >
              {rec.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {rec.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
              {rec.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
              <AlertDescription
                className={
                  rec.type === 'success'
                    ? 'text-green-700 dark:text-green-400'
                    : rec.type === 'info'
                      ? 'text-blue-700 dark:text-blue-400'
                      : ''
                }
              >
                {rec.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Section 1: Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('scenarios.sections.basicInfo', 'Informations de base')}</CardTitle>
          <CardDescription>{t('scenarios.sections.basicInfoDesc', 'Définissez les paramètres généraux de l\'analyse')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('forms.scenario.name', 'Nom du scénario')}</Label>
            <Input
              id="name"
              placeholder="Ex: Transition flotte urbaine 2025"
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          {/* Country & State/Province Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {t('forms.scenario.country', 'Pays')}
              </Label>
              <Select value={country} onValueChange={(v) => handleCountryChange(v as Country)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COUNTRIES).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('forms.scenario.stateProvince', 'Province')}</Label>
              <Select value={stateProvince} onValueChange={(v) => setValue('stateProvince', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state/province" />
                </SelectTrigger>
                <SelectContent>
                  {STATES_PROVINCES[country]?.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="analysisYears">{t('forms.scenario.analysisYears', 'Période d\'analyse (années)')}</Label>
              <Input
                id="analysisYears"
                type="number"
                min={1}
                max={30}
                {...register('analysisYears')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountRate">{t('forms.scenario.discountRate', 'Taux d\'actualisation (%)')}</Label>
              <Input
                id="discountRate"
                type="number"
                step="0.1"
                min={0}
                max={20}
                {...register('discountRate')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section A - Vehicle Type with Target Powertrains */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('scenarios.sections.vehicleType', 'Section A - Type de véhicule')}</CardTitle>
          </div>
          <CardDescription>{t('scenarios.sections.vehicleTypeDesc', 'Caractéristiques du véhicule et motorisations cibles')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('forms.scenario.vehicleCategory', 'Catégorie de véhicule')}</Label>
              <Select
                value={category}
                onValueChange={(value) => setValue('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>
            
            {showPTAC && (
              <div className="space-y-2">
                <Label>{t('forms.scenario.ptac', 'PTAC - Poids Total')}</Label>
                <Select
                  value={ptac}
                  onValueChange={(value) => setValue('ptac', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez" />
                  </SelectTrigger>
                  <SelectContent>
                    {PTAC_OPTIONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>{t('forms.scenario.currentPowertrain', 'Motorisation actuelle')}</Label>
            <Select
              value={watch('currentPowertrain')}
              onValueChange={(value) => setValue('currentPowertrain', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CURRENT_POWERTRAIN_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Multiple Target Powertrains Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {t('forms.scenario.targetPowertrains', 'Motorisation(s) cible(s)')}
              <InfoTooltip content={t('tooltips.targetPowertrains', 'Sélectionnez une ou plusieurs motorisations pour des stratégies mixtes')} />
            </Label>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
              {Object.entries(TARGET_POWERTRAIN_LABELS).map(([value, label]) => {
                const powertrain = value as TargetPowertrain;
                const checked = selectedPowertrains.includes(powertrain);

                return (
                  <div
                    key={value}
                    role="button"
                    tabIndex={0}
                    title={label}
                    className={`relative flex items-center justify-center p-3 pt-8 rounded-lg border-2 transition-all text-center w-full cursor-pointer min-h-[80px] ${
                      checked ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePowertrainChange(powertrain, !checked);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handlePowertrainChange(powertrain, !checked);
                      }
                    }}
                    aria-pressed={checked}
                  >
                    <div 
                      className={`absolute left-2.5 top-2.5 h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center ${
                        checked 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'border-primary'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <span className="font-medium text-sm leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">{label}</span>
                  </div>
                );
              })}
            </div>
            {errors.targetPowertrains && (
              <p className="text-sm text-destructive">{errors.targetPowertrains.message}</p>
            )}
          </div>

          {/* Powertrain Mix - Only show if multiple selected */}
          {selectedPowertrains.length > 1 && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                <Label className="font-medium">{t('forms.scenario.powertrainMix', 'Répartition de la flotte')}</Label>
              </div>
              <div className="space-y-4">
                {selectedPowertrains.map((powertrain) => (
                  <div key={powertrain} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{TARGET_POWERTRAIN_LABELS[powertrain]}</span>
                      <Badge variant="secondary">{powertrainMix[powertrain]}%</Badge>
                    </div>
                    <Slider
                      value={[powertrainMix[powertrain]]}
                      onValueChange={(values) => handleMixChange(powertrain, values[0])}
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                  </div>
                ))}
                <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t">
                  <span>{t('forms.scenario.totalAllocation', 'Total')}</span>
                  <span className={selectedPowertrains.reduce((sum, p) => sum + powertrainMix[p], 0) === 100 ? 'text-green-600' : 'text-destructive'}>
                    {selectedPowertrains.reduce((sum, p) => sum + powertrainMix[p], 0)}%
                  </span>
                </div>
                {errors.powertrainMix && typeof errors.powertrainMix.message === 'string' && (
                  <p className="text-sm text-destructive mt-2">{errors.powertrainMix.message}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section: Energy Prices */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('pricing.yourPrices', 'Vos prix d\'énergie')}</CardTitle>
          </div>
          <CardDescription>{t('pricing.yourPricesRequired', 'Entrez vos prix réels pour des calculs précis')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Electricity - always show if BEV or PHEV selected */}
            {needsElectricity && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="electricityPrice" className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    {t('pricing.yourElectricity', 'Prix électricité ($/kWh)')}
                  </Label>
                  <SourceBadge source={fieldSources.electricityPrice} />
                </div>
                <Input
                  id="electricityPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('pricing.enterYourPrice', 'Entrez votre prix')}
                  {...register('electricityPrice', {
                    onChange: () => handleManualFieldChange('electricityPrice')
                  })}
                />
                {errors.electricityPrice && (
                  <p className="text-sm text-destructive">{errors.electricityPrice.message}</p>
                )}
              </div>
            )}

            {/* Diesel - always show for baseline comparison */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="dieselPrice" className="flex items-center gap-2">
                  <Fuel className="h-4 w-4 text-orange-500" />
                  {t('pricing.yourDiesel', 'Prix diesel ($/L)')}
                </Label>
                <SourceBadge source={fieldSources.dieselPrice} />
              </div>
              <Input
                id="dieselPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder={t('pricing.enterYourPrice', 'Entrez votre prix')}
                {...register('dieselPrice', {
                  onChange: () => handleManualFieldChange('dieselPrice')
                })}
              />
              {errors.dieselPrice && (
                <p className="text-sm text-destructive">{errors.dieselPrice.message}</p>
              )}
            </div>

            {/* Hydrogen - only show if FCEV selected */}
            {needsHydrogen && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label htmlFor="hydrogenPrice" className="flex items-center gap-2">
                    <Atom className="h-4 w-4 text-blue-500" />
                    {t('pricing.yourHydrogen', 'Prix hydrogène ($/kg)')}
                    {hasLimitedH2Infrastructure && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30">
                        ⚠️ {t('hydrogen.limitedInfrastructure', 'Infrastructure limitée')}
                      </Badge>
                    )}
                  </Label>
                  <SourceBadge source={fieldSources.hydrogenPrice} />
                </div>
                <Input
                  id="hydrogenPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('forms.scenario.hydrogenPricePlaceholder', 'Ex: 12 $/kg (prix moyen canadien)')}
                  {...register('hydrogenPrice', {
                    onChange: () => handleManualFieldChange('hydrogenPrice')
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  {t('forms.scenario.hydrogenPriceHint', 'Prix indicatif: 10-15 $/kg au Canada. Dépend du type (vert/bleu/gris) et de l\'approvisionnement.')}
                </p>
                
                {/* H2 Type Selector - Moved here from Section H for better grouping */}
                <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-medium flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-green-500" />
                      {t('forms.scenario.h2Type', 'Source d\'hydrogène')}
                      <InfoTooltip content={t('tooltips.h2Type', 'Le type d\'hydrogène impacte fortement les émissions CO₂. L\'hydrogène vert (électrolyse renouvelable) émet 20x moins que le gris.')} />
                    </Label>
                    <Badge variant="outline" className="text-xs gap-1">
                      <BookOpen className="h-3 w-3" />
                      {t('forms.scenario.h2TypeBadge.reference', 'Réf. IEA 2023')}
                    </Badge>
                  </div>
                  <Select
                    value={watch('h2Type') || 'blue'}
                    onValueChange={(value) => setValue('h2Type', value as 'green' | 'blue' | 'grey')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                            {t('forms.scenario.h2TypeGreen', 'H₂ Vert (Électrolyse renouvelable)')}
                          </div>
                          <Badge variant="secondary" className="text-green-600 text-xs ml-2">-95% CO₂</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="blue">
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500" />
                            {t('forms.scenario.h2TypeBlue', 'H₂ Bleu (Gaz naturel + CCS)')}
                          </div>
                          <Badge variant="secondary" className="text-blue-600 text-xs ml-2">-70% CO₂</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="grey">
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-gray-400" />
                            {t('forms.scenario.h2TypeGrey', 'H₂ Gris (Reformage méthane)')}
                          </div>
                          <Badge variant="outline" className="text-gray-500 text-xs ml-2">Baseline</Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('forms.scenario.h2TypeHint', 'Facteurs: Vert = 0.5 | Bleu = 3.0 | Gris = 10.0 kg CO₂/kg H₂ (Source: IEA 2023)')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Price Guidance */}
          <PriceGuidance 
            region={stateProvince as Region}
            targetPowertrain={needsHydrogen ? 'fcev' : 'bev'}
            onPrefill={(prices) => {
              if (needsElectricity) setValue('electricityPrice', prices.electricity);
              setValue('dieselPrice', prices.diesel);
              if (needsHydrogen) setValue('hydrogenPrice', prices.hydrogen);
            }}
          />
        </CardContent>
      </Card>

      {/* Section B - Operational Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('scenarios.sections.operationalUsage', 'Section B - Utilisation opérationnelle')}</CardTitle>
          </div>
          <CardDescription>{t('scenarios.sections.operationalUsageDesc', 'Profil d\'utilisation des véhicules')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="vehicleCount">{t('forms.scenario.vehicleCount', 'Nombre de véhicules')}</Label>
                <SourceBadge source={fieldSources.vehicleCount} />
              </div>
              <Input
                id="vehicleCount"
                type="number"
                min={1}
                {...register('vehicleCount', {
                  onChange: () => handleManualFieldChange('vehicleCount')
                })}
              />
              {errors.vehicleCount && (
                <p className="text-sm text-destructive">{errors.vehicleCount.message}</p>
              )}
              <VehicleLimitAlert vehicleCount={vehicleCountValue} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="annualKm">{t('forms.scenario.annualKm', 'Kilométrage annuel (km/an)')}</Label>
                <SourceBadge source={fieldSources.annualKm} />
              </div>
              <Input
                id="annualKm"
                type="number"
                min={0}
                {...register('annualKm', {
                  onChange: () => handleManualFieldChange('annualKm')
                })}
              />
              {errors.annualKm && (
                <p className="text-sm text-destructive">{errors.annualKm.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="minAutonomy">{t('forms.scenario.minAutonomy', 'Autonomie minimale requise (km)')}</Label>
              <Input
                id="minAutonomy"
                type="number"
                min={0}
                {...register('minAutonomy')}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('forms.scenario.tripType', 'Type de trajets')}</Label>
                {tripType && (
                  <ConditionImpactBadge
                    category="trip_type"
                    conditionKey={tripType}
                    currentValue={getMultiplier(getTripTypeMultiplierId(tripType)).value}
                    currentSource={getMultiplier(getTripTypeMultiplierId(tripType)).source}
                    onChange={(value, source) => handleMultiplierChange(getTripTypeMultiplierId(tripType), value, source)}
                  />
                )}
              </div>
              <Select
                value={tripType}
                onValueChange={(value) => setValue('tripType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIP_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('forms.scenario.chargingTime', 'Temps de pause disponible')}</Label>
              <Select
                value={chargingTime}
                onValueChange={(value) => setValue('chargingTime', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHARGING_TIME_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('forms.scenario.loadProfile', 'Profil de charge')}</Label>
                {watch('loadProfile') && (
                  <ConditionImpactBadge
                    category="load"
                    conditionKey={watch('loadProfile')}
                    currentValue={getMultiplier(getLoadProfileMultiplierId(watch('loadProfile'))).value}
                    currentSource={getMultiplier(getLoadProfileMultiplierId(watch('loadProfile'))).source}
                    onChange={(value, source) => handleMultiplierChange(getLoadProfileMultiplierId(watch('loadProfile')), value, source)}
                  />
                )}
              </div>
              <Select
                value={watch('loadProfile')}
                onValueChange={(value) => setValue('loadProfile', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOAD_PROFILE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section C - Environmental Constraints */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('scenarios.sections.environmental', 'Section C - Contraintes environnementales')}</CardTitle>
          </div>
          <CardDescription>{t('scenarios.sections.environmentalDesc', 'Conditions d\'exploitation du véhicule')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('forms.scenario.minTemperature', 'Température minimale d\'exploitation')}</Label>
                {minTemperature && (
                  <ConditionImpactBadge
                    category="temperature"
                    conditionKey={minTemperature}
                    currentValue={getMultiplier(getTemperatureMultiplierId(minTemperature)).value}
                    currentSource={getMultiplier(getTemperatureMultiplierId(minTemperature)).source}
                    onChange={(value, source) => handleMultiplierChange(getTemperatureMultiplierId(minTemperature), value, source)}
                  />
                )}
              </div>
              <Select
                value={minTemperature}
                onValueChange={(value) => setValue('minTemperature', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MIN_TEMPERATURE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Hint explaining that cold weather is automatically factored in */}
              {minTemperature && parseInt(minTemperature) < 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Thermometer className="h-3 w-3 text-blue-500" />
                  {t('forms.scenario.coldWeatherAutoHint', 'La surconsommation hivernale est automatiquement incluse dans le calcul TCO.')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('forms.scenario.maxTemperature', 'Température maximale d\'exploitation')}</Label>
              <Select
                value={watch('maxTemperature')}
                onValueChange={(value) => setValue('maxTemperature', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MAX_TEMPERATURE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>{t('forms.scenario.terrainTypes', 'Type de terrain')}</Label>
            <div className="flex flex-wrap gap-4 pt-2">
              {Object.entries(TERRAIN_TYPE_LABELS).map(([value, label]) => (
                <div key={value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`terrain-${value}`}
                    checked={terrainTypes.includes(value)}
                    onCheckedChange={(checked) => handleTerrainChange(value as TerrainType, !!checked)}
                  />
                  <Label htmlFor={`terrain-${value}`} className="cursor-pointer font-normal">
                    {label}
                  </Label>
                  {terrainTypes.includes(value) && (
                    <ConditionImpactBadge
                      category="terrain"
                      conditionKey={value}
                      currentValue={getMultiplier(getTerrainMultiplierId(value)).value}
                      currentSource={getMultiplier(getTerrainMultiplierId(value)).source}
                      onChange={(val, source) => handleMultiplierChange(getTerrainMultiplierId(value), val, source)}
                    />
                  )}
                </div>
              ))}
            </div>
            {errors.terrainTypes && (
              <p className="text-sm text-destructive">{errors.terrainTypes.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section D - Economic Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('scenarios.sections.economic', 'Section D - Données économiques')}</CardTitle>
          </div>
          <CardDescription>{t('scenarios.sections.economicDesc', 'Coûts et paramètres financiers')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data source selector removed - now only at top of form */}

          {/* Current vehicle price (reference/baseline) */}
          <div className="space-y-2">
            <Label htmlFor="currentVehiclePrice">{t('forms.scenario.currentVehiclePrice', 'Prix d\'achat véhicule actuel ($)')}</Label>
            <Input
              id="currentVehiclePrice"
              type="number"
              min={0}
              {...register('currentVehiclePrice')}
            />
          </div>

          {/* Per-powertrain vehicle prices - show for each selected powertrain */}
          {selectedPowertrains.length > 0 && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <Label className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                {t('forms.scenario.vehiclePricesPerType', 'Prix d\'achat par motorisation cible')}
                <InfoTooltip content={t('tooltips.vehiclePricesPerType', 'Définissez le prix d\'achat pour chaque type de véhicule sélectionné')} />
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedPowertrains.map((powertrain) => (
                  <div key={powertrain} className="space-y-2">
                    <Label htmlFor={`vehiclePrice-${powertrain}`} className="text-sm">
                      {TARGET_POWERTRAIN_LABELS[powertrain]}
                    </Label>
                    <Input
                      id={`vehiclePrice-${powertrain}`}
                      type="number"
                      min={0}
                      value={vehiclePrices[powertrain] || ''}
                      onChange={(e) => {
                        const newPrices = {
                          ...vehiclePrices,
                          [powertrain]: parseFloat(e.target.value) || 0,
                        };
                        setValue('vehiclePrices', newPrices, { shouldValidate: true, shouldDirty: true });
                      }}
                      placeholder={t('forms.scenario.enterPrice', 'Entrez le prix ($)')}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legacy alternative vehicle price (hidden if using per-powertrain prices) */}
          <input type="hidden" {...register('alternativeVehiclePrice')} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentConsumption">{t('forms.scenario.currentConsumption', 'Consommation actuelle (L/100km)')}</Label>
              <Input
                id="currentConsumption"
                type="number"
                step="0.1"
                min={0}
                {...register('currentConsumption')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annualMaintenanceCost">{t('forms.scenario.annualMaintenanceCost', 'Coût maintenance annuel ($/an)')}</Label>
              <Input
                id="annualMaintenanceCost"
                type="number"
                min={0}
                {...register('annualMaintenanceCost')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subsidies">{t('forms.scenario.subsidies', 'Subventions disponibles ($)')}</Label>
              <Input
                id="subsidies"
                type="number"
                min={0}
                placeholder="Optionnel"
                {...register('subsidies')}
              />
            </div>
          </div>

          {/* Vehicle Life and Residual Value */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <Label className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {t('forms.scenario.vehicleLifeSection', 'Durée de vie et valeur résiduelle')}
              <InfoTooltip content={t('tooltips.vehicleLife', 'Personnalisez la durée de vie du véhicule et sa valeur résiduelle en fin d\'analyse')} />
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleLifeYears">{t('forms.scenario.vehicleLifeYears', 'Durée de vie véhicule (années)')}</Label>
                <Input
                  id="vehicleLifeYears"
                  type="number"
                  min={5}
                  max={25}
                  placeholder="Ex: 12"
                  {...register('vehicleLifeYears')}
                />
                <p className="text-xs text-muted-foreground">{t('forms.scenario.vehicleLifeYearsHint', 'Défaut: 12 ans pour poids lourds')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="residualValuePercent">{t('forms.scenario.residualValuePercent', 'Valeur résiduelle (% du prix)')}</Label>
                <Input
                  id="residualValuePercent"
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  placeholder="Ex: 15"
                  {...register('residualValuePercent')}
                />
                <p className="text-xs text-muted-foreground">{t('forms.scenario.residualValueHint', 'Défaut: calcul basé sur dépréciation')}</p>
              </div>
            </div>
          </div>

          {/* Custom Consumption per Powertrain */}
          {(needsElectricity || needsHydrogen || selectedPowertrains.includes('biomethane')) && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <Label className="font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                {t('forms.scenario.customConsumption', 'Consommation personnalisée')}
                <InfoTooltip content={t('tooltips.customConsumption', 'Surcharger les consommations par défaut avec vos valeurs réelles')} />
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {needsElectricity && (
                  <div className="space-y-2">
                    <Label htmlFor="consumptionBev">{t('forms.scenario.consumptionBev', 'Consommation BEV (kWh/100km)')}</Label>
                    <Input
                      id="consumptionBev"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Ex: 120"
                      {...register('consumptionBev')}
                    />
                  </div>
                )}
                {needsHydrogen && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="consumptionH2">{t('forms.scenario.consumptionH2', 'Consommation H₂ (kg/100km)')}</Label>
                      <Badge 
                        variant={isH2ConsumptionCustom ? 'secondary' : 'outline'} 
                        className="text-xs gap-1"
                      >
                        {isH2ConsumptionCustom ? (
                          <>
                            <Edit3 className="h-3 w-3" />
                            {t('forms.scenario.consumptionH2Badge.custom', 'Personnalisé')}
                          </>
                        ) : (
                          <>
                            <BookOpen className="h-3 w-3" />
                            {t('forms.scenario.consumptionH2Badge.reference', 'Référence NACFE')}
                          </>
                        )}
                      </Badge>
                    </div>
                    <Input
                      id="consumptionH2"
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder={t('forms.scenario.consumptionH2Placeholder', 'Suggéré: {{value}} kg/100km ({{ptac}})', { value: defaultH2Consumption, ptac: ptac || '19T' })}
                      {...register('consumptionH2', {
                        onChange: () => setIsH2ConsumptionCustom(true),
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('forms.scenario.consumptionH2Hint', 'Valeur de référence basée sur NACFE Run on Less. Modifiez selon vos données constructeur.')}
                    </p>
                  </div>
                )}
                {selectedPowertrains.includes('phev') && (
                  <div className="space-y-2">
                    <Label htmlFor="consumptionPhev">{t('forms.scenario.consumptionPhev', 'Consommation PHEV thermique (L/100km)')}</Label>
                    <Input
                      id="consumptionPhev"
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="Ex: 25"
                      {...register('consumptionPhev')}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('forms.scenario.consumptionPhevHint', 'Consommation en mode thermique (40% du trajet). La partie électrique (60%) utilise la consommation BEV.')}
                    </p>
                  </div>
                )}
                {selectedPowertrains.includes('biomethane') && (
                  <div className="space-y-2">
                    <Label htmlFor="consumptionBiomethane">{t('forms.scenario.consumptionBiomethane', 'Consommation Biométhane (kg/100km)')}</Label>
                    <Input
                      id="consumptionBiomethane"
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="Ex: 28"
                      {...register('consumptionBiomethane')}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Infrastructure Cost */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label className="font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {t('forms.scenario.customInfra', 'Infrastructure personnalisée')}
                <InfoTooltip content={t('tooltips.customInfra', 'Remplacer le calcul automatique par un coût fixe par véhicule')} />
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="customInfraEnabled"
                  checked={watch('customInfraEnabled') || false}
                  onCheckedChange={(checked) => setValue('customInfraEnabled', checked)}
                />
                <Label htmlFor="customInfraEnabled" className="text-sm cursor-pointer">
                  {t('common.enabled', 'Activé')}
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('forms.scenario.customInfraDescription', 'Remplacez le calcul automatique des bornes/stations par un coût fixe que vous connaissez.')}
            </p>
            {watch('customInfraEnabled') && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="infrastructureCostPerVehicle">{t('forms.scenario.infraCostPerVehicle', 'Coût infrastructure ($/véhicule)')}</Label>
                <Input
                  id="infrastructureCostPerVehicle"
                  type="number"
                  min={0}
                  placeholder="Ex: 15000"
                  {...register('infrastructureCostPerVehicle')}
                />
                <p className="text-xs text-muted-foreground">{t('forms.scenario.infraCostHint', 'Si désactivé, le système calcule automatiquement les besoins en bornes/stations')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section E - Coûts opérationnels */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('scenarios.sections.operationalCosts', 'Section E - Coûts opérationnels')}</CardTitle>
          </div>
          <CardDescription>{t('scenarios.sections.operationalCostsDesc', 'Paramètres avancés d\'exploitation (optionnel)')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Immobilisation */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <Label className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              {t('forms.scenario.downtime', 'Immobilisation')}
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="downtimeHoursPerYear">{t('forms.scenario.downtimeHours', 'Heures d\'immobilisation/an')}</Label>
                <Input
                  id="downtimeHoursPerYear"
                  type="number"
                  min={0}
                  placeholder="Ex: 50"
                  {...register('downtimeHoursPerYear')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="downtimeCostPerHour">{t('forms.scenario.downtimeCost', 'Coût horaire ($/h)')}</Label>
                <Input
                  id="downtimeCostPerHour"
                  type="number"
                  min={0}
                  placeholder="Ex: 85"
                  {...register('downtimeCostPerHour')}
                />
              </div>
            </div>
          </div>

          {/* Assurance */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <Label className="font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              {t('forms.scenario.insurance', 'Assurance')}
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insuranceBaseline">{t('forms.scenario.insuranceBaseline', 'Prime diesel de référence ($/an)')}</Label>
                <Input
                  id="insuranceBaseline"
                  type="number"
                  min={0}
                  placeholder="Ex: 3000"
                  {...register('insuranceBaseline')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceEvPremiumPercent">{t('forms.scenario.insuranceEvPremium', 'Surprime EV (%)')}</Label>
                <Input
                  id="insuranceEvPremiumPercent"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Ex: 10"
                  {...register('insuranceEvPremiumPercent')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceH2PremiumPercent">{t('forms.scenario.insuranceH2Premium', 'Surprime H₂ (%)')}</Label>
                <Input
                  id="insuranceH2PremiumPercent"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Ex: 15"
                  {...register('insuranceH2PremiumPercent')}
                />
              </div>
            </div>
          </div>

          {/* Télématique */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <Label className="font-medium flex items-center gap-2">
              <Satellite className="h-4 w-4 text-green-500" />
              {t('forms.scenario.telematics', 'Télématique')}
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telematicsProvider">{t('forms.scenario.telematicsProvider', 'Fournisseur')}</Label>
                <Select
                  value={watch('telematicsProvider') || ''}
                  onValueChange={(v) => setValue('telematicsProvider', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geotab">Geotab</SelectItem>
                    <SelectItem value="samsara">Samsara</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                    <SelectItem value="none">Aucun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telematicsCostPerMonth">{t('forms.scenario.telematicsCost', 'Coût ($/véhicule/mois)')}</Label>
                <Input
                  id="telematicsCostPerMonth"
                  type="number"
                  min={0}
                  placeholder="Ex: 25"
                  {...register('telematicsCostPerMonth')}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section F - Paramètres énergétiques */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('scenarios.sections.energyParams', 'Section F - Paramètres énergétiques')}</CardTitle>
          </div>
          <CardDescription>{t('scenarios.sections.energyParamsDesc', 'Tarification électrique avancée (optionnel)')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Demand charges */}
          <div className="space-y-2">
            <Label htmlFor="gridDemandChargePerKw" className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              {t('forms.scenario.demandCharge', 'Frais de puissance ($/kW/mois)')}
            </Label>
            <Input
              id="gridDemandChargePerKw"
              type="number"
              min={0}
              step="0.01"
              placeholder="Ex: 15"
              {...register('gridDemandChargePerKw')}
            />
          </div>

          {/* TOU Rates */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                {t('forms.scenario.touRates', 'Tarifs Time-of-Use (TOU)')}
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="touEnabled"
                  checked={watch('touEnabled') || false}
                  onCheckedChange={(checked) => setValue('touEnabled', checked)}
                />
                <Label htmlFor="touEnabled" className="text-sm cursor-pointer">
                  {t('common.enabled', 'Activé')}
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('forms.scenario.touDescription', 'Optimisez vos coûts en chargeant en heures creuses. Active les champs prix pointe/hors-pointe.')}
            </p>
            {watch('touEnabled') && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="touOffPeakPrice">{t('forms.scenario.touOffPeak', 'Prix hors pointe ($/kWh)')}</Label>
                  <Input
                    id="touOffPeakPrice"
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Ex: 0.06"
                    {...register('touOffPeakPrice')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="touOnPeakPrice">{t('forms.scenario.touOnPeak', 'Prix pointe ($/kWh)')}</Label>
                  <Input
                    id="touOnPeakPrice"
                    type="number"
                    min={0}
                    step="0.001"
                    placeholder="Ex: 0.12"
                    {...register('touOnPeakPrice')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="touOffPeakPercent">{t('forms.scenario.touOffPeakPercent', '% charge hors pointe')}</Label>
                  <Input
                    id="touOffPeakPercent"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Ex: 70"
                    {...register('touOffPeakPercent')}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section G - Crédits carbone */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('scenarios.sections.carbonCreditsSection', 'Section G - Crédits carbone')}</CardTitle>
          </div>
          <CardDescription>{t('scenarios.sections.carbonCreditsDesc', 'Revenus potentiels des crédits carbone (optionnel)')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Carbon Credits */}
          <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label className="font-medium flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-500" />
                {t('forms.scenario.carbonCredits', 'Crédits carbone')}
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="carbonCreditsEnabled"
                  checked={watch('carbonCreditsEnabled') || false}
                  onCheckedChange={(checked) => setValue('carbonCreditsEnabled', checked)}
                />
                <Label htmlFor="carbonCreditsEnabled" className="text-sm cursor-pointer">
                  {t('common.enabled', 'Activé')}
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('forms.scenario.carbonCreditsDescription', 'Calculez les revenus potentiels des programmes comme LCFS ou ZEV selon vos réductions de CO₂.')}
            </p>
            {watch('carbonCreditsEnabled') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="carbonCreditsProgram">{t('forms.scenario.carbonProgram', 'Programme')}</Label>
                  <Select
                    value={watch('carbonCreditsProgram') || ''}
                    onValueChange={(v) => setValue('carbonCreditsProgram', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LCFS">LCFS (California)</SelectItem>
                      <SelectItem value="ZEV">ZEV Credits</SelectItem>
                      <SelectItem value="none">Aucun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carbonCreditsPrice">{t('forms.scenario.carbonPrice', 'Prix ($/tonne CO₂)')}</Label>
                  <Input
                    id="carbonCreditsPrice"
                    type="number"
                    min={0}
                    placeholder="Ex: 50"
                    {...register('carbonCreditsPrice')}
                  />
                </div>
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Section H - Paramètres Hydrogène (only if FCEV selected) */}
      {needsHydrogen && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Atom className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t('scenarios.sections.hydrogenParams', 'Section H - Paramètres Hydrogène')}</CardTitle>
            </div>
            <CardDescription>{t('scenarios.sections.hydrogenParamsDesc', 'Paramètres spécifiques aux véhicules FCEV (optionnel)')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* H2 Type is now in Section D (next to H2 price) for better UX grouping */}

            {/* FC Stack Replacement */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="font-medium flex items-center gap-2">
                  <Atom className="h-4 w-4 text-blue-500" />
                  {t('forms.scenario.fcStackReplacement', 'Remplacement pile à combustible')}
                  <InfoTooltip content={t('tooltips.fcStackReplacement', 'Coût de remplacement de la pile à combustible après un certain nombre d\'années')} />
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="fcStackReplacementEnabled"
                    checked={watch('fcStackReplacementEnabled') || false}
                    onCheckedChange={(checked) => setValue('fcStackReplacementEnabled', checked)}
                  />
                  <Label htmlFor="fcStackReplacementEnabled" className="text-sm cursor-pointer">
                    {t('common.enabled', 'Activé')}
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('forms.scenario.fcStackDescription', 'Prévoyez le coût de remplacement de la pile à combustible après ~8-10 ans d\'utilisation.')}
              </p>
              {watch('fcStackReplacementEnabled') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="fcStackReplacementCost">{t('forms.scenario.fcStackCost', 'Coût de remplacement ($)')}</Label>
                    <Input
                      id="fcStackReplacementCost"
                      type="number"
                      min={0}
                      placeholder="Ex: 50000"
                      {...register('fcStackReplacementCost')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fcStackLifespanYears">{t('forms.scenario.fcStackLifespan', 'Durée de vie pile (années)')}</Label>
                    <Input
                      id="fcStackLifespanYears"
                      type="number"
                      min={3}
                      max={15}
                      placeholder="Ex: 8"
                      {...register('fcStackLifespanYears')}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* H2 Inflation Rate */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  {t('forms.scenario.h2Inflation', 'Inflation prix H₂')}
                  <InfoTooltip content={t('tooltips.h2Inflation', 'Taux d\'évolution annuel du prix de l\'hydrogène (peut être négatif si baisse attendue)')} />
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="h2InflationEnabled"
                    checked={watch('h2InflationEnabled') || false}
                    onCheckedChange={(checked) => setValue('h2InflationEnabled', checked)}
                  />
                  <Label htmlFor="h2InflationEnabled" className="text-sm cursor-pointer">
                    {t('common.enabled', 'Activé')}
                  </Label>
                </div>
              </div>
              {watch('h2InflationEnabled') && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="h2InflationRate">{t('forms.scenario.h2InflationRate', 'Taux annuel (%)')}</Label>
                  <Input
                    id="h2InflationRate"
                    type="number"
                    min={-20}
                    max={20}
                    step={0.5}
                    placeholder="Ex: -5 (baisse) ou 3 (hausse)"
                    {...register('h2InflationRate')}
                  />
                  <p className="text-xs text-muted-foreground">{t('forms.scenario.h2InflationHint', 'Négatif = baisse attendue du prix H₂')}</p>
                </div>
              )}
            </div>

            {/* H2 Infrastructure Scale */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="font-medium flex items-center gap-2">
                  <Percent className="h-4 w-4 text-purple-500" />
                  {t('forms.scenario.h2InfraScale', 'Économies d\'échelle infrastructure')}
                  <InfoTooltip content={t('tooltips.h2InfraScale', 'Réduction du coût d\'infrastructure H₂ grâce aux économies d\'échelle')} />
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="h2InfraScaleEnabled"
                    checked={watch('h2InfraScaleEnabled') || false}
                    onCheckedChange={(checked) => setValue('h2InfraScaleEnabled', checked)}
                  />
                  <Label htmlFor="h2InfraScaleEnabled" className="text-sm cursor-pointer">
                    {t('common.enabled', 'Activé')}
                  </Label>
                </div>
              </div>
              {watch('h2InfraScaleEnabled') && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="h2InfraScaleFactor">{t('forms.scenario.h2InfraScaleFactor', 'Facteur de réduction (%)')}</Label>
                  <Input
                    id="h2InfraScaleFactor"
                    type="number"
                    min={0}
                    max={50}
                    placeholder="Ex: 20"
                    {...register('h2InfraScaleFactor')}
                  />
                  <p className="text-xs text-muted-foreground">{t('forms.scenario.h2InfraScaleHint', 'Réduction appliquée au coût des stations H₂')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel', 'Annuler')}
          </Button>
        )}
        <Button type="submit" disabled={isLoading || isOverLimit}>
          <Zap className="h-4 w-4 mr-2" />
          {isLoading ? t('common.calculating', 'Calcul en cours...') : t('common.calculateTco', 'Calculer le TCO')}
        </Button>
      </div>
    </form>
  );
}

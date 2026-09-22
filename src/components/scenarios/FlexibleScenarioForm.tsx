import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { VehicleTypeCard } from './VehicleTypeCard';
import { CO2EmissionFactorsSection } from './CO2EmissionFactorsSection';
import { InfrastructureCostsSection } from './InfrastructureCostsSection';
import { Plus, Calculator, ArrowLeft, AlertTriangle, Info, Sparkles, Gauge, Fuel, Wrench, TrendingUp, Factory, Clock, DollarSign, Building, Leaf } from 'lucide-react';
import {
  FlexibleScenarioVehicle,
  FlexibleFinancialParams,
  CreateFlexibleScenarioForm,
  DEFAULT_FINANCIAL_PARAMS,
  createEmptyVehicle,
  AdvancedCostsConfig,
  DEFAULT_ADVANCED_COSTS,
  TELEMATICS_PROVIDER_LABELS,
  CARBON_CREDIT_PROGRAM_LABELS,
} from '@/lib/calculations/flexibleTypes';
import { MultiplierOverride } from '@/lib/calculations/configurableMultipliers';
import { useMultiplierOverrides } from '@/hooks/useMultiplierOverrides';
import { Region, REGION_LABELS } from '@/lib/calculations/types';

interface FlexibleScenarioFormProps {
  projectId: string;
  onSubmit: (data: CreateFlexibleScenarioForm) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<CreateFlexibleScenarioForm>;
  isLoading?: boolean;
}

// Simple ID generator
function generateId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function FlexibleScenarioForm({
  projectId,
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
}: FlexibleScenarioFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Step 1: Scenario definition
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [region, setRegion] = useState<Region>(
    (initialData?.region as Region) || 'CA_QC'
  );

  // Step 2: Fleet composition
  const [vehicles, setVehicles] = useState<Partial<FlexibleScenarioVehicle>[]>(
    initialData?.vehicles?.length
      ? initialData.vehicles
      : [createEmptyVehicle(generateId())]
  );

  // Step 3: Financial parameters
  const [financialParams, setFinancialParams] = useState<FlexibleFinancialParams>(
    initialData?.financialParams || { ...DEFAULT_FINANCIAL_PARAMS }
  );

  // Step 4: Advanced costs (optional)
  const [advancedCosts, setAdvancedCosts] = useState<AdvancedCostsConfig>(
    initialData?.advancedCosts || {}
  );

  // Scenario-level multiplier overrides (CO2, Infrastructure)
  const {
    overrides: scenarioMultiplierOverrides,
    setMultiplier: setScenarioMultiplier,
    resetToSystem: resetScenarioMultiplier,
    overrideCount: scenarioOverrideCount,
  } = useMultiplierOverrides();

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Add a new vehicle type
  const handleAddVehicle = () => {
    setVehicles([...vehicles, createEmptyVehicle(generateId())]);
  };

  // Remove a vehicle type
  const handleRemoveVehicle = (index: number) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter((_, i) => i !== index));
    }
  };

  // Update a vehicle
  const handleVehicleChange = (
    index: number,
    updates: Partial<FlexibleScenarioVehicle>
  ) => {
    const updated = [...vehicles];
    updated[index] = { ...updated[index], ...updates };
    setVehicles(updated);
  };

  // Update financial params
  const handleFinancialParamChange = (
    field: keyof FlexibleFinancialParams,
    value: number
  ) => {
    setFinancialParams({ ...financialParams, [field]: value });
  };

  // Update advanced costs
  const handleAdvancedCostChange = <K extends keyof AdvancedCostsConfig>(
    field: K,
    value: AdvancedCostsConfig[K]
  ) => {
    setAdvancedCosts({ ...advancedCosts, [field]: value });
  };

  // Pre-fill advanced costs with defaults
  const handlePrefillAdvancedCosts = () => {
    setAdvancedCosts({ ...DEFAULT_ADVANCED_COSTS });
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('flexibleScenario.validation.nameRequired', 'Nom requis');
    }

    // Validate each vehicle
    vehicles.forEach((vehicle, index) => {
      if (!vehicle.purchasePrice || vehicle.purchasePrice <= 0) {
        newErrors[`vehicle_${index}_purchasePrice`] = t(
          'flexibleScenario.validation.purchasePriceRequired',
          'Prix d\'achat requis'
        );
      }
      if (!vehicle.consumption || vehicle.consumption <= 0) {
        newErrors[`vehicle_${index}_consumption`] = t(
          'flexibleScenario.validation.consumptionRequired',
          'Consommation requise'
        );
      }
      if (!vehicle.energyPrice || vehicle.energyPrice <= 0) {
        newErrors[`vehicle_${index}_energyPrice`] = t(
          'flexibleScenario.validation.energyPriceRequired',
          'Prix énergie requis'
        );
      }
      if (!vehicle.annualKm || vehicle.annualKm < 1000) {
        newErrors[`vehicle_${index}_annualKm`] = t(
          'flexibleScenario.validation.annualKmRequired',
          'Kilométrage annuel requis (min 1000)'
        );
      }
      if (!vehicle.annualMaintenanceCost || vehicle.annualMaintenanceCost <= 0) {
        newErrors[`vehicle_${index}_annualMaintenanceCost`] = t(
          'flexibleScenario.validation.maintenanceRequired',
          'Coût maintenance requis'
        );
      }
      if (!vehicle.vehicleCount || vehicle.vehicleCount < 1) {
        newErrors[`vehicle_${index}_vehicleCount`] = t(
          'flexibleScenario.validation.vehicleCountRequired',
          'Nombre de véhicules requis'
        );
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if form is complete (for enabling submit button)
  const isFormComplete = useMemo(() => {
    if (!name.trim()) return false;

    return vehicles.every(
      (v) =>
        v.purchasePrice &&
        v.purchasePrice > 0 &&
        v.consumption &&
        v.consumption > 0 &&
        v.energyPrice &&
        v.energyPrice > 0 &&
        v.annualKm &&
        v.annualKm >= 1000 &&
        v.annualMaintenanceCost &&
        v.annualMaintenanceCost > 0 &&
        v.vehicleCount &&
        v.vehicleCount >= 1
    );
  }, [name, vehicles]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    const formData: CreateFlexibleScenarioForm = {
      name,
      description: description || undefined,
      region,
      vehicles: vehicles as FlexibleScenarioVehicle[],
      financialParams,
      advancedCosts: Object.keys(advancedCosts).length > 0 ? advancedCosts : undefined,
      scenarioMultiplierOverrides: Object.keys(scenarioMultiplierOverrides).length > 0 
        ? scenarioMultiplierOverrides 
        : undefined,
    };

    await onSubmit(formData);
  };

  // Get errors for a specific vehicle
  const getVehicleErrors = (index: number) => {
    const vehicleErrors: Record<string, string> = {};
    Object.entries(errors).forEach(([key, value]) => {
      if (key.startsWith(`vehicle_${index}_`)) {
        const field = key.replace(`vehicle_${index}_`, '');
        vehicleErrors[field] = value;
      }
    });
    return vehicleErrors;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onCancel || (() => navigate(-1))}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Retour')}
        </Button>
      </div>

      {/* Important Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t(
            'flexibleScenario.notice',
            'Ce calculateur n\'impose aucun workflow. Définissez librement la composition de votre flotte pour obtenir un TCO précis. Tous les champs marqués (*) sont obligatoires.'
          )}
        </AlertDescription>
      </Alert>

      {/* Step 1: Define Scenario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </span>
            {t('flexibleScenario.step1.title', 'Définir le scénario')}
          </CardTitle>
          <CardDescription>
            {t(
              'flexibleScenario.step1.description',
              'Donnez un nom et une description à votre scénario'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-name">
                {t('flexibleScenario.name', 'Nom du scénario')} *
              </Label>
              <Input
                id="scenario-name"
                placeholder={t(
                  'flexibleScenario.namePlaceholder',
                  'Ex: Flotte 100% diesel baseline, Mix H2/BEV 2026...'
                )}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="scenario-region">
                {t('flexibleScenario.region', 'Région')}
              </Label>
              <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                <SelectTrigger id="scenario-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REGION_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenario-description">
              {t('flexibleScenario.description', 'Description (optionnel)')}
            </Label>
            <Textarea
              id="scenario-description"
              placeholder={t(
                'flexibleScenario.descriptionPlaceholder',
                'Décrivez l\'objectif de ce scénario...'
              )}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Compose Fleet */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </span>
            {t('flexibleScenario.step2.title', 'Composer la flotte')}
          </CardTitle>
          <CardDescription>
            {t(
              'flexibleScenario.step2.description',
              'Ajoutez les différents types de véhicules qui composent ce scénario'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reminder about data sources */}
          <Alert variant="default" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {t(
                'flexibleScenario.dataReminder',
                'Entrez VOS données réelles (devis, contrats, télématique). Consultez la page Données de référence si vous avez besoin de benchmarks.'
              )}
            </AlertDescription>
          </Alert>

          {/* Vehicle Cards */}
          <div className="space-y-6">
            {vehicles.map((vehicle, index) => (
              <VehicleTypeCard
                key={vehicle.id || index}
                vehicle={vehicle}
                index={index}
                onChange={handleVehicleChange}
                onRemove={handleRemoveVehicle}
                canRemove={vehicles.length > 1}
                errors={getVehicleErrors(index)}
              />
            ))}
          </div>

          {/* Add Vehicle Button */}
          <Button
            variant="outline"
            onClick={handleAddVehicle}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('flexibleScenario.addVehicleType', 'Ajouter un autre type de véhicule')}
          </Button>
        </CardContent>
      </Card>

      {/* Step 3: Financial Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              3
            </span>
            {t('flexibleScenario.step3.title', 'Paramètres financiers')}
          </CardTitle>
          <CardDescription>
            {t(
              'flexibleScenario.step3.description',
              'Définissez les paramètres d\'analyse financière'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('flexibleScenario.discountRate', 'Taux d\'actualisation (%)')}</Label>
                <InfoTooltip content={t('tooltips.discountRate')} />
              </div>
              <Input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={financialParams.discountRate}
                onChange={(e) =>
                  handleFinancialParamChange('discountRate', parseFloat(e.target.value) || 0)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('flexibleScenario.analysisHorizon', 'Horizon d\'analyse (années)')}</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={financialParams.analysisHorizonYears}
                onChange={(e) =>
                  handleFinancialParamChange(
                    'analysisHorizonYears',
                    parseInt(e.target.value) || 10
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('flexibleScenario.energyInflation', 'Inflation énergie (%/an)')}</Label>
              <Input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={financialParams.energyInflationRate}
                onChange={(e) =>
                  handleFinancialParamChange(
                    'energyInflationRate',
                    parseFloat(e.target.value) || 0
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                {t('flexibleScenario.maintenanceInflation', 'Inflation maintenance (%/an)')}
              </Label>
              <Input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={financialParams.maintenanceInflationRate}
                onChange={(e) =>
                  handleFinancialParamChange(
                    'maintenanceInflationRate',
                    parseFloat(e.target.value) || 0
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Operational Costs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-sm font-bold">
                  4
                </span>
                {t('flexibleScenario.step4.title', 'Coûts opérationnels')}
                <span className="text-xs font-normal text-muted-foreground ml-2">(optionnel)</span>
              </CardTitle>
              <CardDescription className="mt-1.5">
                {t(
                  'flexibleScenario.step4.description',
                  'Coûts récurrents liés à l\'exploitation de la flotte'
                )}
              </CardDescription>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handlePrefillAdvancedCosts}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {t('flexibleScenario.prefillDefaults', 'Pré-remplir')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Downtime Costs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              ⏱️ {t('flexibleScenario.advanced.downtime', 'Immobilisation')}
              <InfoTooltip content={t('tooltips.downtime', 'Coûts liés aux temps d\'arrêt non planifiés (maintenance, pannes)')} />
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.downtimeHours', 'Heures d\'immobilisation/an')}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="50"
                  value={advancedCosts.downtimeHoursPerYear || ''}
                  onChange={(e) => handleAdvancedCostChange('downtimeHoursPerYear', parseFloat(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.downtimeCost', 'Coût horaire ($/h)')}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="85"
                  value={advancedCosts.downtimeCostPerHour || ''}
                  onChange={(e) => handleAdvancedCostChange('downtimeCostPerHour', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              🛡️ {t('flexibleScenario.advanced.insurance', 'Assurance')}
              <InfoTooltip content={t('tooltips.insurance', 'Primes d\'assurance et surprimes pour véhicules ZEV')} />
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.insuranceBaseline', 'Prime diesel ($/an)')}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="3000"
                  value={advancedCosts.insuranceBaseline || ''}
                  onChange={(e) => handleAdvancedCostChange('insuranceBaseline', parseFloat(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.insuranceEvPremium', 'Surprime EV (%)')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="10"
                  value={advancedCosts.insuranceEvPremiumPercent || ''}
                  onChange={(e) => handleAdvancedCostChange('insuranceEvPremiumPercent', parseFloat(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.insuranceH2Premium', 'Surprime H₂ (%)')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="15"
                  value={advancedCosts.insuranceH2PremiumPercent || ''}
                  onChange={(e) => handleAdvancedCostChange('insuranceH2PremiumPercent', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>
          </div>

          {/* Telematics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              📡 {t('flexibleScenario.advanced.telematics', 'Télématique')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.telematicsProvider', 'Fournisseur')}</Label>
                <Select 
                  value={advancedCosts.telematicsProvider || 'none'} 
                  onValueChange={(v) => handleAdvancedCostChange('telematicsProvider', v as AdvancedCostsConfig['telematicsProvider'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TELEMATICS_PROVIDER_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.telematicsCost', 'Coût ($/véh./mois)')}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="25"
                  value={advancedCosts.telematicsCostPerVehiclePerMonth || ''}
                  onChange={(e) => handleAdvancedCostChange('telematicsCostPerVehiclePerMonth', parseFloat(e.target.value) || undefined)}
                  disabled={advancedCosts.telematicsProvider === 'none'}
                />
              </div>
            </div>
          </div>

          {/* Consumption Overrides by Technology */}
          <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              {t('flexibleScenario.advanced.consumptionOverrides', 'Consommation par motorisation cible')}
              <InfoTooltip content={t('tooltips.consumptionOverrides', 'Surcharge la consommation par défaut pour les véhicules BEV et FCEV')} />
            </h4>
            
            {/* BEV Consumption */}
            {vehicles.some(v => v.technology === 'bev') && (
              <div className="space-y-2">
                <Label htmlFor="consumption-bev" className="text-sm text-slate-600 dark:text-slate-400">
                  BEV - {t('flexibleScenario.advanced.consumptionBev', 'Consommation (kWh/100km)')}
                </Label>
                <Input
                  id="consumption-bev"
                  type="number"
                  step={0.1}
                  min={0}
                  placeholder="120"
                  value={advancedCosts.consumptionBev || ''}
                  onChange={(e) => handleAdvancedCostChange('consumptionBev', parseFloat(e.target.value) || undefined)}
                />
              </div>
            )}
            
            {/* FCEV Consumption */}
            {vehicles.some(v => v.technology === 'fcev') && (
              <div className="space-y-2">
                <Label htmlFor="consumption-h2" className="text-sm text-slate-600 dark:text-slate-400">
                  FCEV - {t('flexibleScenario.advanced.consumptionH2', 'Consommation H₂ (kg/100km)')}
                </Label>
                <Input
                  id="consumption-h2"
                  type="number"
                  step={0.1}
                  min={0}
                  placeholder="8"
                  value={advancedCosts.consumptionH2 || ''}
                  onChange={(e) => handleAdvancedCostChange('consumptionH2', parseFloat(e.target.value) || undefined)}
                />
              </div>
            )}
            
            {/* Biomethane Consumption */}
            {vehicles.some(v => v.technology === 'biomethane') && (
              <div className="space-y-2">
                <Label htmlFor="consumption-biomethane" className="text-sm text-slate-600 dark:text-slate-400">
                  Biométhane - {t('flexibleScenario.advanced.consumptionBiomethane', 'Consommation (kg/100km)')}
                </Label>
                <Input
                  id="consumption-biomethane"
                  type="number"
                  step={0.1}
                  min={0}
                  placeholder="28"
                  value={advancedCosts.consumptionBiomethane || ''}
                  onChange={(e) => handleAdvancedCostChange('consumptionBiomethane', parseFloat(e.target.value) || undefined)}
                />
              </div>
            )}
            
            {!vehicles.some(v => v.technology === 'bev' || v.technology === 'fcev' || v.technology === 'biomethane') && (
              <p className="text-sm text-muted-foreground italic">
                {t('flexibleScenario.advanced.noZevVehicles', 'Ajoutez des véhicules BEV, FCEV ou Biométhane pour configurer leur consommation')}
              </p>
            )}
          </div>

          {/* Custom Infrastructure Cost */}
          <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <Label htmlFor="customInfraEnabled" className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4" />
                {t('flexibleScenario.advanced.customInfra', 'Coût infrastructure personnalisé')}
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  id="customInfraEnabled"
                  checked={advancedCosts.customInfraEnabled || false}
                  onCheckedChange={(checked) => handleAdvancedCostChange('customInfraEnabled', checked)}
                />
                <span className="text-xs text-muted-foreground">
                  {advancedCosts.customInfraEnabled ? t('common.enabled', 'Activé') : t('common.disabled', 'Désactivé')}
                </span>
              </div>
            </div>
            
            {advancedCosts.customInfraEnabled && (
              <div className="space-y-2 pl-4 border-l-2 border-slate-300 dark:border-slate-600">
                <Label htmlFor="infrastructureCostPerVehicle" className="text-sm text-slate-600 dark:text-slate-400">
                  {t('flexibleScenario.advanced.infraCostPerVehicle', 'Coût infrastructure ($/véhicule)')}
                </Label>
                <Input
                  id="infrastructureCostPerVehicle"
                  type="number"
                  step={1000}
                  min={0}
                  placeholder="0"
                  value={advancedCosts.infrastructureCostPerVehicle || ''}
                  onChange={(e) => handleAdvancedCostChange('infrastructureCostPerVehicle', parseFloat(e.target.value) || undefined)}
                />
                <p className="text-xs text-muted-foreground">
                  💡 {t('flexibleScenario.advanced.infraHint', 'Si vide, le système calculera automatiquement selon le type de flotte')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Energy Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-sm font-bold">
              5
            </span>
            {t('flexibleScenario.step5.title', 'Paramètres énergétiques')}
            <span className="text-xs font-normal text-muted-foreground ml-2">(optionnel)</span>
          </CardTitle>
          <CardDescription>
            {t(
              'flexibleScenario.step5.description',
              'Configuration des coûts d\'approvisionnement électrique pour véhicules EV'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Grid Demand Charges */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              ⚡ {t('flexibleScenario.advanced.gridCharges', 'Frais de puissance')}
              <InfoTooltip content={t('tooltips.gridCharges', 'Frais d\'appel de puissance facturés par le distributeur électrique')} />
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('flexibleScenario.advanced.demandCharge', 'Frais appel puissance ($/kW/mois)')}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="15"
                  value={advancedCosts.gridDemandCharge || ''}
                  onChange={(e) => handleAdvancedCostChange('gridDemandCharge', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>
          </div>

          {/* TOU Rates */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              🕐 {t('flexibleScenario.advanced.touRates', 'Tarification TOU')}
            </h4>
            <div className="flex items-center gap-3 mb-2">
              <Switch
                checked={advancedCosts.touEnabled || false}
                onCheckedChange={(checked) => handleAdvancedCostChange('touEnabled', checked)}
              />
              <Label>{t('flexibleScenario.advanced.touEnabled', 'Activer les tarifs Time-of-Use')}</Label>
            </div>
            {advancedCosts.touEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.advanced.touOffPeak', 'Tarif hors-pointe ($/kWh)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.06"
                    value={advancedCosts.touOffPeakRate || ''}
                    onChange={(e) => handleAdvancedCostChange('touOffPeakRate', parseFloat(e.target.value) || undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.advanced.touPeak', 'Tarif pointe ($/kWh)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.12"
                    value={advancedCosts.touPeakRate || ''}
                    onChange={(e) => handleAdvancedCostChange('touPeakRate', parseFloat(e.target.value) || undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.advanced.touOffPeakPercent', '% charge hors-pointe')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="70"
                    value={advancedCosts.touOffPeakPercent || ''}
                    onChange={(e) => handleAdvancedCostChange('touOffPeakPercent', parseFloat(e.target.value) || undefined)}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 6: Environmental Impact & Expert Multipliers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-sm font-bold">
              6
            </span>
            <Leaf className="h-5 w-5 text-green-500" />
            {t('flexibleScenario.step6.title', 'Impact environnemental')}
            <span className="text-xs font-normal text-muted-foreground ml-2">(optionnel)</span>
          </CardTitle>
          <CardDescription>
            {t(
              'flexibleScenario.step6.description',
              'Facteurs climatiques et revenus carbone'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CO2 Emission Factors Section - Expert Override */}
          <CO2EmissionFactorsSection
            overrides={scenarioMultiplierOverrides}
            onChange={(id, value, source) => {
              if (source === 'expert') {
                setScenarioMultiplier(id, value);
              } else {
                resetScenarioMultiplier(id);
              }
            }}
          />
          {/* Carbon Credits */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              🌱 {t('flexibleScenario.advanced.carbonCredits', 'Crédits carbone')}
              <InfoTooltip content={t('tooltips.carbonCredits', 'Revenus potentiels issus des programmes de crédits carbone (LCFS, ZEV)')} />
            </h4>
            <div className="flex items-center gap-3 mb-2">
              <Switch
                checked={advancedCosts.carbonCreditsEnabled || false}
                onCheckedChange={(checked) => handleAdvancedCostChange('carbonCreditsEnabled', checked)}
              />
              <Label>{t('flexibleScenario.advanced.enableCarbonCredits', 'Activer les crédits carbone')}</Label>
            </div>
            {advancedCosts.carbonCreditsEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.advanced.carbonProgram', 'Programme')}</Label>
                  <Select 
                    value={advancedCosts.carbonCreditProgram || 'lcfs'} 
                    onValueChange={(v) => handleAdvancedCostChange('carbonCreditProgram', v as AdvancedCostsConfig['carbonCreditProgram'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CARBON_CREDIT_PROGRAM_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.advanced.carbonPrice', 'Prix du crédit ($/tonne CO₂)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="50"
                    value={advancedCosts.carbonCreditPricePerTonne || ''}
                    onChange={(e) => handleAdvancedCostChange('carbonCreditPricePerTonne', parseFloat(e.target.value) || undefined)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cold Weather Impact */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              ❄️ {t('flexibleScenario.advanced.coldWeather', 'Impact météo froide')}
              <InfoTooltip content={t('tooltips.coldWeather', 'Perte d\'autonomie des véhicules électriques en conditions hivernales')} />
            </h4>
            <div className="flex items-center gap-3 mb-2">
              <Switch
                checked={advancedCosts.coldWeatherEnabled || false}
                onCheckedChange={(checked) => handleAdvancedCostChange('coldWeatherEnabled', checked)}
              />
              <Label>{t('flexibleScenario.advanced.enableColdWeather', 'Activer l\'impact météo froide')}</Label>
            </div>
            {advancedCosts.coldWeatherEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.advanced.coldDerating', 'Perte autonomie moyenne (%)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    placeholder="20"
                    value={advancedCosts.coldWeatherDeratingPercent || ''}
                    onChange={(e) => handleAdvancedCostChange('coldWeatherDeratingPercent', parseFloat(e.target.value) || undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.advanced.coldMonths', 'Nombre de mois d\'hiver')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    placeholder="4"
                    value={advancedCosts.coldWeatherMonths || ''}
                    onChange={(e) => handleAdvancedCostChange('coldWeatherMonths', parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Infrastructure Costs Section - Expert Override */}
          <InfrastructureCostsSection
            multiplierOverrides={scenarioMultiplierOverrides}
            onMultiplierChange={setScenarioMultiplier}
            onMultiplierReset={resetScenarioMultiplier}
          />
        </CardContent>
      </Card>

      {/* Step 7: Hydrogen Parameters (FCEV only) */}
      {vehicles.some(v => v.technology === 'fcev') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-blue-500" />
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm font-bold">
                7
              </span>
              {t('flexibleScenario.step7.title', 'Paramètres Hydrogène')}
              <span className="text-xs font-normal text-muted-foreground ml-2">(optionnel)</span>
            </CardTitle>
            <CardDescription>
              {t(
                'flexibleScenario.step7.description',
                'Coûts spécifiques FCEV et projections H₂'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Fuel Cell Stack Replacement */}
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <Label htmlFor="fcStackReplacementEnabled" className="text-sm font-medium flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  {t('flexibleScenario.h2.fcStackReplacement', 'Remplacement pile à combustible')}
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="fcStackReplacementEnabled"
                    checked={advancedCosts.fcStackReplacementEnabled || false}
                    onCheckedChange={(checked) => handleAdvancedCostChange('fcStackReplacementEnabled', checked)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {advancedCosts.fcStackReplacementEnabled ? t('common.enabled', 'Activé') : t('common.disabled', 'Désactivé')}
                  </span>
                </div>
              </div>
              
              {advancedCosts.fcStackReplacementEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                  <div className="space-y-2">
                    <Label htmlFor="fcStackReplacementCost" className="text-sm text-slate-600 dark:text-slate-400">
                      {t('flexibleScenario.h2.fcStackCost', 'Coût de remplacement ($)')}
                    </Label>
                    <Input
                      id="fcStackReplacementCost"
                      type="number"
                      step={1000}
                      min={0}
                      placeholder="50000"
                      value={advancedCosts.fcStackReplacementCost || ''}
                      onChange={(e) => handleAdvancedCostChange('fcStackReplacementCost', parseFloat(e.target.value) || undefined)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="fcStackLifespanYears" className="text-sm text-slate-600 dark:text-slate-400">
                      {t('flexibleScenario.h2.fcStackLifespan', 'Durée de vie pile (années)')}
                    </Label>
                    <Input
                      id="fcStackLifespanYears"
                      type="number"
                      step={1}
                      min={3}
                      max={15}
                      placeholder="8"
                      value={advancedCosts.fcStackLifespanYears || ''}
                      onChange={(e) => handleAdvancedCostChange('fcStackLifespanYears', parseInt(e.target.value) || undefined)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* H2 Price Inflation */}
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <Label htmlFor="h2InflationEnabled" className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {t('flexibleScenario.h2.inflation', 'Inflation prix H₂')}
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="h2InflationEnabled"
                    checked={advancedCosts.h2InflationEnabled || false}
                    onCheckedChange={(checked) => handleAdvancedCostChange('h2InflationEnabled', checked)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {advancedCosts.h2InflationEnabled ? t('common.enabled', 'Activé') : t('common.disabled', 'Désactivé')}
                  </span>
                </div>
              </div>
              
              {advancedCosts.h2InflationEnabled && (
                <div className="pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                  <div className="space-y-2">
                    <Label htmlFor="h2InflationRate" className="text-sm text-slate-600 dark:text-slate-400">
                      {t('flexibleScenario.h2.inflationRate', 'Taux d\'inflation H₂ (%/an)')}
                    </Label>
                    <Input
                      id="h2InflationRate"
                      type="number"
                      step={0.1}
                      min={-10}
                      max={20}
                      placeholder="-2"
                      value={advancedCosts.h2InflationRate || ''}
                      onChange={(e) => handleAdvancedCostChange('h2InflationRate', parseFloat(e.target.value) || undefined)}
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 {t('flexibleScenario.h2.inflationHint', 'Valeur négative = baisse attendue avec économies d\'échelle')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* H2 Infrastructure Scale Economies */}
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <Label htmlFor="h2InfraScaleEnabled" className="text-sm font-medium flex items-center gap-2">
                  <Factory className="h-4 w-4" />
                  {t('flexibleScenario.h2.infraScale', 'Économies d\'échelle infrastructure H₂')}
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="h2InfraScaleEnabled"
                    checked={advancedCosts.h2InfraScaleEnabled || false}
                    onCheckedChange={(checked) => handleAdvancedCostChange('h2InfraScaleEnabled', checked)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {advancedCosts.h2InfraScaleEnabled ? t('common.enabled', 'Activé') : t('common.disabled', 'Désactivé')}
                  </span>
                </div>
              </div>
              
              {advancedCosts.h2InfraScaleEnabled && (
                <div className="pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                  <div className="space-y-2">
                    <Label htmlFor="h2InfraScaleFactor" className="text-sm text-slate-600 dark:text-slate-400">
                      {t('flexibleScenario.h2.scaleFactor', 'Facteur de réduction (%)')}
                    </Label>
                    <Input
                      id="h2InfraScaleFactor"
                      type="number"
                      step={1}
                      min={0}
                      max={50}
                      placeholder="15"
                      value={advancedCosts.h2InfraScaleFactor || ''}
                      onChange={(e) => handleAdvancedCostChange('h2InfraScaleFactor', parseFloat(e.target.value) || undefined)}
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 {t('flexibleScenario.h2.scaleHint', 'Réduction coût infrastructure si flotte > 20 véhicules H₂')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Section */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center p-4 bg-muted/50 rounded-lg">
        <div className="text-sm text-muted-foreground">
          {!isFormComplete && (
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t(
                'flexibleScenario.incompleteForm',
                'Remplissez tous les champs obligatoires (*) pour calculer le TCO'
              )}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel || (() => navigate(-1))}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormComplete || isLoading}
            className="min-w-[200px]"
          >
            <Calculator className="h-4 w-4 mr-2" />
            {isLoading
              ? t('common.calculating', 'Calcul en cours...')
              : t('flexibleScenario.calculateTCO', 'Calculer le TCO')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default FlexibleScenarioForm;

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { SourceDropdown } from './SourceDropdown';
import { OperationalConditionsSection } from './OperationalConditionsSection';
import { 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Truck,
  DollarSign,
  Fuel,
  Wrench,
  Building2,
  Clock,
  FileText,
  BookOpen,
  Edit3
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  TechnologyType,
  VehicleClass,
  DataSourceType,
  FlexibleScenarioVehicle,
  TECHNOLOGY_LABELS,
  TECHNOLOGY_LABELS_EN,
  VEHICLE_CLASS_LABELS,
  VEHICLE_CLASS_LABELS_EN,
  getConsumptionUnitForTechnology,
  getEnergyPriceUnitForTechnology,
} from '@/lib/calculations/flexibleTypes';
import { getDefaultH2ConsumptionByClass } from '@/lib/calculations/h2Defaults';

interface VehicleTypeCardProps {
  vehicle: Partial<FlexibleScenarioVehicle>;
  index: number;
  onChange: (index: number, updates: Partial<FlexibleScenarioVehicle>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  errors?: Record<string, string>;
}

export function VehicleTypeCard({
  vehicle,
  index,
  onChange,
  onRemove,
  canRemove,
  errors = {},
}: VehicleTypeCardProps) {
  const { t, i18n } = useTranslation();
  const [showInfrastructure, setShowInfrastructure] = useState(vehicle.hasInfrastructure ?? false);
  const [showEndOfLife, setShowEndOfLife] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const techLabels = i18n.language === 'fr' ? TECHNOLOGY_LABELS : TECHNOLOGY_LABELS_EN;
  const classLabels = i18n.language === 'fr' ? VEHICLE_CLASS_LABELS : VEHICLE_CLASS_LABELS_EN;

  const consumptionUnit = getConsumptionUnitForTechnology(vehicle.technology || 'diesel');
  const energyPriceUnit = getEnergyPriceUnitForTechnology(vehicle.technology || 'diesel');

  const handleChange = (field: keyof FlexibleScenarioVehicle, value: unknown) => {
    onChange(index, { [field]: value });
  };

  const handleTechnologyChange = (tech: TechnologyType) => {
    const newConsumptionUnit = getConsumptionUnitForTechnology(tech);
    const newEnergyPriceUnit = getEnergyPriceUnitForTechnology(tech);
    
    const updates: Partial<FlexibleScenarioVehicle> = {
      technology: tech,
      consumptionUnit: newConsumptionUnit,
      energyPriceUnit: newEnergyPriceUnit,
    };
    
    // Pre-fill H2 consumption with smart default based on vehicle class
    if (tech === 'fcev' && !vehicle.consumption) {
      updates.consumption = getDefaultH2ConsumptionByClass(vehicle.vehicleClass);
      updates.consumptionSource = 'reference';
    }
    
    onChange(index, updates);
  };
  
  // Check if consumption is a smart default (for FCEV)
  const isH2SmartDefault = vehicle.technology === 'fcev' && 
    vehicle.consumptionSource === 'reference' &&
    vehicle.consumption === getDefaultH2ConsumptionByClass(vehicle.vehicleClass);
    
  // Get smart default value for placeholder
  const h2SmartDefault = getDefaultH2ConsumptionByClass(vehicle.vehicleClass);

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5 text-primary" />
            {t('flexibleScenario.vehicleType', 'Type de véhicule')} #{index + 1}
            {vehicle.technology && (
              <span className="text-sm font-normal text-muted-foreground">
                – {techLabels[vehicle.technology]}
              </span>
            )}
          </CardTitle>
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Technology & Classification */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t('flexibleScenario.technology', 'Technologie')} *</Label>
            <Select
              value={vehicle.technology}
              onValueChange={(v) => handleTechnologyChange(v as TechnologyType)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('flexibleScenario.selectTechnology', 'Sélectionner...')} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(techLabels) as TechnologyType[]).map((tech) => (
                  <SelectItem key={tech} value={tech}>
                    {techLabels[tech]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('flexibleScenario.vehicleClass', 'Classe véhicule')} *</Label>
            <Select
              value={vehicle.vehicleClass}
              onValueChange={(v) => handleChange('vehicleClass', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('flexibleScenario.selectClass', 'Sélectionner...')} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(classLabels) as VehicleClass[]).map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {classLabels[cls]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('flexibleScenario.vehicleCount', 'Nombre de véhicules')} *</Label>
            <Input
              type="number"
              min={1}
              value={vehicle.vehicleCount || ''}
              onChange={(e) => handleChange('vehicleCount', parseInt(e.target.value) || 0)}
              className={errors.vehicleCount ? 'border-destructive' : ''}
            />
          </div>
        </div>

        {/* CAPEX Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4 text-green-600" />
            {t('flexibleScenario.capex', 'CAPEX – Coût d\'acquisition')}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('flexibleScenario.purchasePrice', 'Prix d\'achat unitaire ($)')} *</Label>
                <InfoTooltip content={t('flexibleScenario.purchasePriceTooltip', 'Entrez le prix selon votre situation: devis constructeur, contrat négocié, prix marché occasion...')} />
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder={t('flexibleScenario.enterPrice', 'Entrez le prix...')}
                  value={vehicle.purchasePrice || ''}
                  onChange={(e) => handleChange('purchasePrice', parseFloat(e.target.value) || 0)}
                  className={`flex-1 ${errors.purchasePrice ? 'border-destructive' : ''}`}
                />
                <SourceDropdown
                  value={vehicle.purchasePriceSource}
                  onChange={(v) => handleChange('purchasePriceSource', v)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('flexibleScenario.subsidies', 'Subventions par véhicule ($)')}</Label>
                <InfoTooltip content={t('flexibleScenario.subsidiesTooltip', 'Cumulez toutes subventions applicables: iMHZEV fédéral, programmes provinciaux, municipaux...')} />
              </div>
              <Input
                type="number"
                min={0}
                value={vehicle.subsidiesPerVehicle ?? 0}
                onChange={(e) => handleChange('subsidiesPerVehicle', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* OPEX Energy Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Fuel className="h-4 w-4 text-amber-600" />
            {t('flexibleScenario.opexEnergy', 'OPEX – Carburant / Énergie')}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{t('flexibleScenario.consumption', 'Consommation')} ({consumptionUnit}) *</Label>
                  <InfoTooltip content={t('flexibleScenario.consumptionTooltip', 'Sources: données télématique, specs constructeur, tests pilotes, références industrielles...')} />
                </div>
                {vehicle.technology === 'fcev' && (
                  <Badge 
                    variant={isH2SmartDefault ? 'outline' : 'secondary'} 
                    className="text-xs gap-1"
                  >
                    {isH2SmartDefault ? (
                      <>
                        <BookOpen className="h-3 w-3" />
                        {t('forms.scenario.consumptionH2Badge.reference', 'Référence NACFE')}
                      </>
                    ) : (
                      <>
                        <Edit3 className="h-3 w-3" />
                        {t('forms.scenario.consumptionH2Badge.custom', 'Personnalisé')}
                      </>
                    )}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  placeholder={vehicle.technology === 'fcev' 
                    ? t('forms.scenario.consumptionH2Placeholder', 'Suggéré: {{value}} kg/100km', { value: h2SmartDefault, ptac: classLabels[vehicle.vehicleClass as VehicleClass] || '' })
                    : t('flexibleScenario.enterConsumption', 'Entrez...')
                  }
                  value={vehicle.consumption || ''}
                  onChange={(e) => {
                    handleChange('consumption', parseFloat(e.target.value) || 0);
                    // Mark as custom when user edits
                    if (vehicle.consumptionSource === 'reference') {
                      handleChange('consumptionSource', 'user_input');
                    }
                  }}
                  className={`flex-1 ${errors.consumption ? 'border-destructive' : ''}`}
                />
                <SourceDropdown
                  value={vehicle.consumptionSource}
                  onChange={(v) => handleChange('consumptionSource', v)}
                />
              </div>
              {vehicle.technology === 'fcev' && (
                <p className="text-xs text-muted-foreground">
                  {t('forms.scenario.consumptionH2Hint', 'Valeur de référence basée sur NACFE Run on Less. Modifiez selon vos données constructeur.')}
                </p>
              )}
              
              {/* H2 Type Selector - only for FCEV */}
              {vehicle.technology === 'fcev' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      {t('forms.scenario.h2Type', 'Source d\'hydrogène')}
                      <InfoTooltip content={t('tooltips.h2Type', 'Le type d\'hydrogène impacte fortement les émissions CO₂. L\'hydrogène vert émet 20x moins que le gris.')} />
                    </Label>
                    <Badge variant="outline" className="text-xs gap-1">
                      <BookOpen className="h-3 w-3" />
                      {t('forms.scenario.h2TypeBadge.reference', 'Réf. IEA 2023')}
                    </Badge>
                  </div>
                  <Select
                    value={vehicle.h2Type || 'blue'}
                    onValueChange={(v) => handleChange('h2Type', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-green-500" />
                          {t('forms.scenario.h2TypeGreen', 'H₂ Vert')}
                          <Badge variant="secondary" className="text-green-600 text-xs">-95% CO₂</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="blue">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500" />
                          {t('forms.scenario.h2TypeBlue', 'H₂ Bleu')}
                          <Badge variant="secondary" className="text-blue-600 text-xs">-70% CO₂</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="grey">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-gray-400" />
                          {t('forms.scenario.h2TypeGrey', 'H₂ Gris')}
                          <Badge variant="outline" className="text-gray-500 text-xs">Baseline</Badge>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t('forms.scenario.h2TypeHint', 'Facteurs: Vert = 0.5 | Bleu = 3.0 | Gris = 10.0 kg CO₂/kg H₂')}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('flexibleScenario.energyPrice', 'Prix énergie')} ({energyPriceUnit}) *</Label>
                <InfoTooltip content={t('flexibleScenario.energyPriceTooltip', 'Utilisez votre prix réel: contrat fournisseur, prix actuel payé, devis...')} />
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder={t('flexibleScenario.enterPrice', 'Entrez...')}
                  value={vehicle.energyPrice || ''}
                  onChange={(e) => handleChange('energyPrice', parseFloat(e.target.value) || 0)}
                  className={`flex-1 ${errors.energyPrice ? 'border-destructive' : ''}`}
                />
                <SourceDropdown
                  value={vehicle.energyPriceSource}
                  onChange={(v) => handleChange('energyPriceSource', v)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('flexibleScenario.annualKm', 'Kilométrage annuel')} *</Label>
              <Input
                type="number"
                min={1000}
                placeholder="80000"
                value={vehicle.annualKm || ''}
                onChange={(e) => handleChange('annualKm', parseInt(e.target.value) || 0)}
                className={errors.annualKm ? 'border-destructive' : ''}
              />
            </div>
          </div>
        </div>

        {/* OPEX Maintenance Section */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4 text-blue-600" />
            {t('flexibleScenario.opexMaintenance', 'OPEX – Maintenance')}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>{t('flexibleScenario.maintenanceCost', 'Coût maintenance annuel par véhicule ($)')} *</Label>
                <InfoTooltip content={t('flexibleScenario.maintenanceTooltip', 'Sources: historique factures, contrat entretien, garantie constructeur...')} />
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder={t('flexibleScenario.enterCost', 'Entrez...')}
                  value={vehicle.annualMaintenanceCost || ''}
                  onChange={(e) => handleChange('annualMaintenanceCost', parseFloat(e.target.value) || 0)}
                  className={`flex-1 ${errors.annualMaintenanceCost ? 'border-destructive' : ''}`}
                />
                <SourceDropdown
                  value={vehicle.maintenanceSource}
                  onChange={(v) => handleChange('maintenanceSource', v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Operational Conditions Section */}
        <OperationalConditionsSection
          vehicle={vehicle}
          index={index}
          onChange={onChange}
        />

        {/* Infrastructure Section (Collapsible) */}
        <Collapsible open={showInfrastructure} onOpenChange={setShowInfrastructure}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">
                  {t('flexibleScenario.infrastructure', 'Infrastructure (optionnel)')}
                </span>
              </div>
              {showInfrastructure ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 bg-muted/30 rounded-b-lg -mt-2 pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`has-infra-${index}`}
                checked={vehicle.hasInfrastructure ?? false}
                onCheckedChange={(checked) => handleChange('hasInfrastructure', checked)}
              />
              <Label htmlFor={`has-infra-${index}`}>
                {t('flexibleScenario.hasInfrastructure', 'Ce scénario nécessite une infrastructure spécifique')}
              </Label>
            </div>
            
            {vehicle.hasInfrastructure && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.infrastructureCost', 'Coût infrastructure total ($)')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={vehicle.infrastructureCost || ''}
                    onChange={(e) => handleChange('infrastructureCost', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('flexibleScenario.amortizationYears', 'Durée amortissement (années)')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={vehicle.infrastructureAmortizationYears || 10}
                    onChange={(e) => handleChange('infrastructureAmortizationYears', parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id={`infra-shared-${index}`}
                    checked={vehicle.infrastructureShared ?? false}
                    onCheckedChange={(checked) => handleChange('infrastructureShared', checked)}
                  />
                  <Label htmlFor={`infra-shared-${index}`}>
                    {t('flexibleScenario.infrastructureShared', 'Infrastructure partagée')}
                  </Label>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* End of Life Section (Collapsible) */}
        <Collapsible open={showEndOfLife} onOpenChange={setShowEndOfLife}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium">
                  {t('flexibleScenario.endOfLife', 'Fin de vie')}
                </span>
              </div>
              {showEndOfLife ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 bg-muted/30 rounded-b-lg -mt-2 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('flexibleScenario.residualValue', 'Valeur résiduelle (% du prix d\'achat)')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={vehicle.residualValuePercent ?? 20}
                  onChange={(e) => handleChange('residualValuePercent', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('flexibleScenario.lifeYears', 'Durée de vie prévue (années)')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={vehicle.lifeYears ?? 10}
                  onChange={(e) => handleChange('lifeYears', parseInt(e.target.value) || 10)}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Notes Section (Collapsible) */}
        <Collapsible open={showNotes} onOpenChange={setShowNotes}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">
                  {t('flexibleScenario.documentation', 'Documentation & Notes')}
                </span>
              </div>
              {showNotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-4 bg-muted/30 rounded-b-lg -mt-2 pt-4">
            <div className="space-y-2">
              <Label>{t('flexibleScenario.notes', 'Notes et hypothèses')}</Label>
              <Textarea
                placeholder={t('flexibleScenario.notesPlaceholder', 'Documentez vos hypothèses et sources de données...')}
                value={vehicle.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default VehicleTypeCard;

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BookOpen, Edit3, FolderOpen, RotateCcw, ChevronDown, CheckCircle2, Loader2, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { EV_CHARGER_COSTS, H2_STATION_COSTS, type ChargingSpeed, type H2StationCapacity } from '@/lib/calculations/infrastructure';

export type PricingSourceType = 'reference' | 'custom' | 'project';

// Default reference pricing (CAD)
const DEFAULT_REFERENCE_PRICING = {
  h2StationCost: 3350000,      // Per 200kg/day station
  h2LandPermits: 350000,
  evChargerSlow: EV_CHARGER_COSTS.slow.unit + EV_CHARGER_COSTS.slow.install,
  evChargerFast: EV_CHARGER_COSTS.fast.unit + EV_CHARGER_COSTS.fast.install,
  evChargerUltra: EV_CHARGER_COSTS.ultra.unit + EV_CHARGER_COSTS.ultra.install,
  gridConnectionCost: 10000,
};

export interface InfrastructurePricing {
  h2StationCost: number;
  h2LandPermits: number;
  evChargerSlow: number;
  evChargerFast: number;
  evChargerUltra: number;
  gridConnectionCost: number;
  source: PricingSourceType;
  projectId?: string;
}

interface InfrastructurePricingSelectorProps {
  selectedSource: PricingSourceType;
  onSourceChange: (source: PricingSourceType) => void;
  onPricingChange: (pricing: InfrastructurePricing) => void;
  currentPricing: InfrastructurePricing;
  className?: string;
}

interface ProjectOption {
  id: string;
  name: string;
  hasPricing: boolean;
}

export function InfrastructurePricingSelector({
  selectedSource,
  onSourceChange,
  onPricingChange,
  currentPricing,
  className,
}: InfrastructurePricingSelectorProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customPricing, setCustomPricing] = useState<InfrastructurePricing>({
    ...DEFAULT_REFERENCE_PRICING,
    source: 'custom',
  });
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  // Fetch projects with custom pricing
  useEffect(() => {
    const fetchProjects = async () => {
      if (!user?.id) return;

      try {
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, name')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (projectsData) {
          // Check which projects have custom infrastructure pricing
          const { data: customData } = await supabase
            .from('custom_reference_data')
            .select('id, name')
            .eq('user_id', user.id)
            .eq('category', 'infrastructure_pricing');

          const projectsWithPricing = projectsData.map(p => ({
            id: p.id,
            name: p.name,
            hasPricing: customData?.some(c => c.name.includes(p.id)) || false,
          }));

          setProjects(projectsWithPricing);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };

    fetchProjects();
  }, [user?.id]);

  // Load saved custom pricing
  useEffect(() => {
    const loadCustomPricing = async () => {
      if (!user?.id) return;

      try {
        const { data } = await supabase
          .from('custom_reference_data')
          .select('data')
          .eq('user_id', user.id)
          .eq('category', 'infrastructure_pricing')
          .eq('name', 'user_custom_pricing')
          .single();

        if (data?.data) {
          const savedPricing = data.data as Record<string, number>;
          setCustomPricing({
            h2StationCost: savedPricing.h2StationCost || DEFAULT_REFERENCE_PRICING.h2StationCost,
            h2LandPermits: savedPricing.h2LandPermits || DEFAULT_REFERENCE_PRICING.h2LandPermits,
            evChargerSlow: savedPricing.evChargerSlow || DEFAULT_REFERENCE_PRICING.evChargerSlow,
            evChargerFast: savedPricing.evChargerFast || DEFAULT_REFERENCE_PRICING.evChargerFast,
            evChargerUltra: savedPricing.evChargerUltra || DEFAULT_REFERENCE_PRICING.evChargerUltra,
            gridConnectionCost: savedPricing.gridConnectionCost || DEFAULT_REFERENCE_PRICING.gridConnectionCost,
            source: 'custom',
          });
        }
      } catch {
        // No saved pricing, use defaults
      }
    };

    loadCustomPricing();
  }, [user?.id]);

  const handleSourceChange = async (source: PricingSourceType) => {
    onSourceChange(source);

    if (source === 'reference') {
      onPricingChange({
        ...DEFAULT_REFERENCE_PRICING,
        source: 'reference',
      });
    } else if (source === 'custom') {
      setIsCustomOpen(true);
      onPricingChange({
        ...customPricing,
        source: 'custom',
      });
    }
  };

  const handleCustomPricingChange = (field: keyof InfrastructurePricing, value: number) => {
    const newPricing = {
      ...customPricing,
      [field]: value,
      source: 'custom' as PricingSourceType,
    };
    setCustomPricing(newPricing);
    onPricingChange(newPricing);
  };

  const handleSaveCustomPricing = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('custom_reference_data')
        .upsert({
          user_id: user.id,
          category: 'infrastructure_pricing',
          name: 'user_custom_pricing',
          data: {
            h2StationCost: customPricing.h2StationCost,
            h2LandPermits: customPricing.h2LandPermits,
            evChargerSlow: customPricing.evChargerSlow,
            evChargerFast: customPricing.evChargerFast,
            evChargerUltra: customPricing.evChargerUltra,
            gridConnectionCost: customPricing.gridConnectionCost,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,category,name',
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving custom pricing:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefaults = () => {
    const defaultPricing = {
      ...DEFAULT_REFERENCE_PRICING,
      source: 'reference' as PricingSourceType,
    };
    setCustomPricing(defaultPricing);
    onPricingChange(defaultPricing);
    onSourceChange('reference');
  };

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('custom_reference_data')
        .select('data')
        .eq('user_id', user.id)
        .eq('category', 'infrastructure_pricing')
        .ilike('name', `%${projectId}%`)
        .single();

      if (data?.data) {
        const projectPricing = data.data as Record<string, number>;
        const newPricing: InfrastructurePricing = {
          h2StationCost: projectPricing.h2StationCost || DEFAULT_REFERENCE_PRICING.h2StationCost,
          h2LandPermits: projectPricing.h2LandPermits || DEFAULT_REFERENCE_PRICING.h2LandPermits,
          evChargerSlow: projectPricing.evChargerSlow || DEFAULT_REFERENCE_PRICING.evChargerSlow,
          evChargerFast: projectPricing.evChargerFast || DEFAULT_REFERENCE_PRICING.evChargerFast,
          evChargerUltra: projectPricing.evChargerUltra || DEFAULT_REFERENCE_PRICING.evChargerUltra,
          gridConnectionCost: projectPricing.gridConnectionCost || DEFAULT_REFERENCE_PRICING.gridConnectionCost,
          source: 'project',
          projectId,
        };
        onPricingChange(newPricing);
      }
    } catch {
      // Project has no custom pricing
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          {t('infrastructure.pricing.title', 'Source des coûts')}
        </CardTitle>
        <CardDescription>
          {t('infrastructure.pricing.description', 'Choisissez l\'origine des coûts unitaires pour le calcul')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={selectedSource}
          onValueChange={(value) => handleSourceChange(value as PricingSourceType)}
          className="space-y-3"
        >
          {/* Reference Data Option */}
          <div
            className={cn(
              'flex items-start space-x-3 p-4 rounded-lg border transition-colors',
              selectedSource === 'reference'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <RadioGroupItem value="reference" id="pricing-reference" />
            <Label htmlFor="pricing-reference" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="h-4 w-4 text-orange-500" />
                <span className="font-medium">
                  {t('infrastructure.pricing.reference', 'Données de référence')}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {t('infrastructure.pricing.default', 'Par défaut')}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {t('infrastructure.pricing.h2Station', 'Station H₂:')} {formatCurrency(DEFAULT_REFERENCE_PRICING.h2StationCost)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {t('infrastructure.pricing.evChargerFast', 'Chargeur rapide:')} {formatCurrency(DEFAULT_REFERENCE_PRICING.evChargerFast)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {t('infrastructure.pricing.gridConnection', 'Connexion réseau:')} {formatCurrency(DEFAULT_REFERENCE_PRICING.gridConnectionCost)}
                  </Badge>
                </div>
              </div>
            </Label>
          </div>

          {/* Custom Pricing Option */}
          <Collapsible open={selectedSource === 'custom' && isCustomOpen} onOpenChange={setIsCustomOpen}>
            <div
              className={cn(
                'flex items-start space-x-3 p-4 rounded-lg border transition-colors',
                selectedSource === 'custom'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <RadioGroupItem value="custom" id="pricing-custom" />
              <Label htmlFor="pricing-custom" className="flex-1 cursor-pointer">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 mb-1">
                      <Edit3 className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">
                        {t('infrastructure.pricing.custom', 'Coûts personnalisés')}
                      </span>
                    </div>
                    {selectedSource === 'custom' && (
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isCustomOpen && 'rotate-180')} />
                    )}
                  </div>
                </CollapsibleTrigger>
                <p className="text-sm text-muted-foreground">
                  {t('infrastructure.pricing.customDesc', 'Entrez vos propres coûts unitaires')}
                </p>
              </Label>
            </div>

            <CollapsibleContent className="mt-2 ml-7 space-y-4 p-4 bg-muted/30 rounded-lg border">
              {/* H2 Station Costs */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span className="text-blue-600">H₂</span>
                  {t('infrastructure.pricing.h2Costs', 'Coûts stations hydrogène')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('infrastructure.pricing.stationCost', 'Coût station ($/unité)')}</Label>
                    <Input
                      type="number"
                      value={customPricing.h2StationCost}
                      onChange={(e) => handleCustomPricingChange('h2StationCost', parseInt(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('infrastructure.pricing.landPermits', 'Terrain & permis ($/unité)')}</Label>
                    <Input
                      type="number"
                      value={customPricing.h2LandPermits}
                      onChange={(e) => handleCustomPricingChange('h2LandPermits', parseInt(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              {/* EV Charger Costs */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <span className="text-green-600">EV</span>
                  {t('infrastructure.pricing.evCosts', 'Coûts chargeurs électriques')}
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('infrastructure.pricing.chargerSlow', 'Lent 7kW')}</Label>
                    <Input
                      type="number"
                      value={customPricing.evChargerSlow}
                      onChange={(e) => handleCustomPricingChange('evChargerSlow', parseInt(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('infrastructure.pricing.chargerFast', 'Rapide 50kW')}</Label>
                    <Input
                      type="number"
                      value={customPricing.evChargerFast}
                      onChange={(e) => handleCustomPricingChange('evChargerFast', parseInt(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('infrastructure.pricing.chargerUltra', 'Ultra 150kW')}</Label>
                    <Input
                      type="number"
                      value={customPricing.evChargerUltra}
                      onChange={(e) => handleCustomPricingChange('evChargerUltra', parseInt(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>

              {/* Grid Connection */}
              <div className="space-y-1">
                <Label className="text-xs">{t('infrastructure.pricing.gridConnectionCost', 'Connexion réseau ($/unité)')}</Label>
                <Input
                  type="number"
                  value={customPricing.gridConnectionCost}
                  onChange={(e) => handleCustomPricingChange('gridConnectionCost', parseInt(e.target.value) || 0)}
                  className="h-8 max-w-[200px]"
                />
              </div>

              {/* Save & Reset buttons */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSaveCustomPricing} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  {t('infrastructure.pricing.save', 'Sauvegarder')}
                </Button>
                <Button size="sm" variant="outline" onClick={handleResetToDefaults}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('infrastructure.pricing.reset', 'Réinitialiser')}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Import from Project Option */}
          <div
            className={cn(
              'flex items-start space-x-3 p-4 rounded-lg border transition-colors',
              selectedSource === 'project'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <RadioGroupItem value="project" id="pricing-project" />
            <Label htmlFor="pricing-project" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className="h-4 w-4 text-purple-500" />
                <span className="font-medium">
                  {t('infrastructure.pricing.project', 'Importer d\'un projet')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('infrastructure.pricing.projectDesc', 'Récupérer les coûts d\'un projet existant')}
              </p>
              
              {selectedSource === 'project' && (
                <div className="mt-3">
                  <Select value={selectedProjectId} onValueChange={handleProjectSelect}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t('infrastructure.pricing.selectProject', 'Sélectionner un projet')} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length > 0 ? (
                        projects.map(project => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                            {project.hasPricing && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {t('infrastructure.pricing.hasPricing', 'Coûts personnalisés')}
                              </Badge>
                            )}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="_none" disabled>
                          {t('infrastructure.pricing.noProjects', 'Aucun projet disponible')}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Label>
          </div>
        </RadioGroup>

        {/* Info Alert */}
        {selectedSource === 'custom' && (
          <Alert className="mt-4 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
            <Edit3 className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              {t('infrastructure.pricing.customApplied', 'Les coûts personnalisés seront utilisés pour tous les calculs. N\'oubliez pas de sauvegarder.')}
            </AlertDescription>
          </Alert>
        )}

        {selectedSource === 'reference' && (
          <Alert className="mt-4 bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
            <BookOpen className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700 dark:text-orange-400">
              {t('infrastructure.pricing.referenceApplied', 'Les coûts de référence 2024-2025 (moyenne canadienne) sont appliqués.')}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default InfrastructurePricingSelector;

// Export default pricing for use in calculations
export { DEFAULT_REFERENCE_PRICING };

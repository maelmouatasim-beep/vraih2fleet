import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  useIncentives, 
  CANADIAN_PROVINCES, 
  VEHICLE_CLASSES, 
  FUEL_TYPES,
  IncentiveProgram 
} from '@/hooks/useIncentives';
import { 
  DollarSign, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Truck,
  Zap,
  Info,
  Building2,
  Users,
  Calculator
} from 'lucide-react';
import { toast } from 'sonner';


interface SubsidiesCalculatorProps {
  defaultProvince?: string;
  defaultVehicleClass?: string;
  defaultFuelType?: string;
  showExport?: boolean;
  compact?: boolean;
}

const ORGANIZATION_TYPES = [
  { value: 'business', labelEn: 'Business', labelFr: 'Entreprise' },
  { value: 'municipality', labelEn: 'Municipality', labelFr: 'Municipalité' },
  { value: 'school', labelEn: 'School/Transit', labelFr: 'École/Transport' },
  { value: 'nonprofit', labelEn: 'Non-profit', labelFr: 'OBNL' },
];

export function SubsidiesCalculator({
  defaultProvince,
  defaultVehicleClass,
  defaultFuelType,
  showExport = true,
  compact = false,
}: SubsidiesCalculatorProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const [province, setProvince] = useState(defaultProvince || '');
  const [vehicleClass, setVehicleClass] = useState(defaultVehicleClass || 'Class 8');
  const [fuelType, setFuelType] = useState(defaultFuelType || 'BEV');
  const [vehicleCount, setVehicleCount] = useState(10);
  const [organizationType, setOrganizationType] = useState('business');
  const [includeInfrastructure, setIncludeInfrastructure] = useState(true);
  const [chargersCount, setChargersCount] = useState(5);

  const { 
    programs, 
    loading, 
    error, 
    calculateTotal, 
    calculatePerVehicle,
    isDeadlineApproaching,
    getDaysSinceVerification 
  } = useIncentives({
    province,
    vehicleClass,
    fuelType,
  });

  const perVehicle = useMemo(() => calculatePerVehicle(), [programs]);
  const totalVehicleIncentives = useMemo(() => calculateTotal(vehicleCount), [programs, vehicleCount]);
  
  // Calculate infrastructure incentives
  const infrastructureIncentives = useMemo(() => {
    if (!includeInfrastructure) return 0;
    const infraPrograms = programs.filter(p => 
      p.vehicle_classes.includes('Infrastructure')
    );
    return infraPrograms.reduce((sum, p) => sum + (p.amount_cad * chargersCount), 0);
  }, [programs, includeInfrastructure, chargersCount]);

  const totalIncentives = totalVehicleIncentives + infrastructureIncentives;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isEnglish ? 'en-CA' : 'fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getLevelBadgeVariant = (level: string) => {
    switch (level) {
      case 'federal': return 'default';
      case 'provincial': return 'secondary';
      case 'municipal': return 'outline';
      default: return 'outline';
    }
  };

  // PDF export is now handled by SubsidiesPDFDownloadButton component

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              {t('subsidies.calculatorTitle')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('subsidies.calculatorDescription')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Filters */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <Label>{t('subsidies.province')}</Label>
            </div>
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger>
                <SelectValue placeholder={t('subsidies.selectProvince')} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {CANADIAN_PROVINCES.map(prov => (
                  <SelectItem key={prov.code} value={prov.code}>
                    {isEnglish ? prov.name_en : prov.name_fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <Label>{t('subsidies.organizationType')}</Label>
            </div>
            <Select value={organizationType} onValueChange={setOrganizationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {ORGANIZATION_TYPES.map(org => (
                  <SelectItem key={org.value} value={org.value}>
                    {isEnglish ? org.labelEn : org.labelFr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <Label>{t('subsidies.vehicleClass')}</Label>
            </div>
            <Select value={vehicleClass} onValueChange={setVehicleClass}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {VEHICLE_CLASSES.map(vc => (
                  <SelectItem key={vc} value={vc}>{vc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <Label>{t('subsidies.fuelType')}</Label>
            </div>
            <Select value={fuelType} onValueChange={setFuelType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {FUEL_TYPES.map(ft => (
                  <SelectItem key={ft.code} value={ft.code}>
                    {isEnglish ? ft.name_en : ft.name_fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              <Label>{t('subsidies.vehicleCount')}</Label>
            </div>
            <Input
              type="number"
              min={1}
              max={1000}
              value={vehicleCount}
              onChange={(e) => setVehicleCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              <Label>{t('subsidies.chargersCount')}</Label>
            </div>
            <Input
              type="number"
              min={0}
              max={100}
              value={chargersCount}
              onChange={(e) => setChargersCount(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
        </div>

        <Separator />

        {/* Loading state */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('subsidies.noPrograms')}</p>
            <p className="text-sm mt-1">{t('subsidies.tryDifferentFilters')}</p>
          </div>
        ) : (
          <>
            {/* Total Summary */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-6 border border-green-200 dark:border-green-800">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">{t('subsidies.vehicleIncentives')}</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(totalVehicleIncentives)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(perVehicle.total)} × {vehicleCount} {t('subsidies.vehicles')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('subsidies.infrastructureIncentives')}</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(infrastructureIncentives)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {chargersCount} {t('subsidies.chargersStations')}
                  </p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">{t('subsidies.totalEstimated')}</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(totalIncentives)}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="default" className="bg-blue-600">{t('subsidies.federal')}: {formatCurrency(perVehicle.federal * vehicleCount)}</Badge>
                    <Badge variant="secondary">{t('subsidies.provincial')}: {formatCurrency(perVehicle.provincial * vehicleCount)}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Programs List */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {t('subsidies.applicablePrograms')} ({programs.length})
              </h4>
              
              {programs.slice(0, 5).map(program => (
                <div key={program.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-medium">
                          {isEnglish ? program.program_name_en : program.program_name_fr}
                        </h5>
                        <Badge variant={getLevelBadgeVariant(program.level)}>
                          {program.level === 'federal' ? t('subsidies.federal') : t('subsidies.provincial')}
                        </Badge>
                        {program.province && (
                          <Badge variant="outline">{program.province}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {isEnglish ? program.description_en : program.description_fr}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(program.amount_cad)}
                      </p>
                      <Button variant="ghost" size="sm" className="mt-1" asChild>
                        <a href={program.application_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {t('subsidies.applyNow')}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stacking Note */}
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p>{t('subsidies.stackingNote')}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

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
  FileDown,
  Truck,
  Zap,
  Info
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface IncentivesCalculatorProps {
  defaultProvince?: string;
  defaultVehicleClass?: string;
  defaultFuelType?: string;
  showExport?: boolean;
  compact?: boolean;
}

export function IncentivesCalculator({
  defaultProvince,
  defaultVehicleClass,
  defaultFuelType,
  showExport = true,
  compact = false,
}: IncentivesCalculatorProps) {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const [province, setProvince] = useState(defaultProvince || '');
  const [vehicleClass, setVehicleClass] = useState(defaultVehicleClass || 'Class 8');
  const [fuelType, setFuelType] = useState(defaultFuelType || 'BEV');
  const [vehicleCount, setVehicleCount] = useState(1);

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
  const totalIncentives = useMemo(() => calculateTotal(vehicleCount), [programs, vehicleCount]);

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

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'federal': return t('incentives.federal');
      case 'provincial': return t('incentives.provincial');
      case 'municipal': return t('incentives.municipal');
      default: return level;
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(isEnglish ? 'Government Incentives Report' : 'Rapport des Subventions Gouvernementales', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Subtitle with filters
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const provinceName = CANADIAN_PROVINCES.find(p => p.code === province);
      const filterText = [
        provinceName ? (isEnglish ? provinceName.name_en : provinceName.name_fr) : (isEnglish ? 'All Provinces' : 'Toutes les provinces'),
        vehicleClass,
        FUEL_TYPES.find(f => f.code === fuelType)?.[isEnglish ? 'name_en' : 'name_fr'] || fuelType,
      ].join(' | ');
      doc.text(filterText, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Date
      doc.setFontSize(10);
      doc.text(`${isEnglish ? 'Generated' : 'Généré le'}: ${new Date().toLocaleDateString(isEnglish ? 'en-CA' : 'fr-CA')}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Summary box
      doc.setFillColor(240, 249, 255);
      doc.rect(15, yPosition, pageWidth - 30, 35, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(isEnglish ? 'Summary' : 'Résumé', 20, yPosition + 10);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`${isEnglish ? 'Number of vehicles' : 'Nombre de véhicules'}: ${vehicleCount}`, 20, yPosition + 20);
      doc.text(`${isEnglish ? 'Per vehicle' : 'Par véhicule'}: ${formatCurrency(perVehicle.total)}`, 20, yPosition + 28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`${isEnglish ? 'TOTAL' : 'TOTAL'}: ${formatCurrency(totalIncentives)}`, pageWidth - 20, yPosition + 24, { align: 'right' });
      yPosition += 45;

      // Breakdown
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(isEnglish ? 'Breakdown:' : 'Répartition:', 20, yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.text(`${isEnglish ? 'Federal' : 'Fédéral'}: ${formatCurrency(perVehicle.federal)} × ${vehicleCount} = ${formatCurrency(perVehicle.federal * vehicleCount)}`, 25, yPosition);
      yPosition += 6;
      doc.text(`${isEnglish ? 'Provincial' : 'Provincial'}: ${formatCurrency(perVehicle.provincial)} × ${vehicleCount} = ${formatCurrency(perVehicle.provincial * vehicleCount)}`, 25, yPosition);
      yPosition += 15;

      // Programs list
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(isEnglish ? 'Applicable Programs' : 'Programmes Applicables', 20, yPosition);
      yPosition += 10;

      programs.forEach((program, index) => {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFillColor(index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 250 : 255);
        doc.rect(15, yPosition - 5, pageWidth - 30, 25, 'F');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const programName = isEnglish ? program.program_name_en : program.program_name_fr;
        doc.text(programName.substring(0, 70), 20, yPosition);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const levelText = `[${getLevelLabel(program.level).toUpperCase()}]`;
        doc.text(levelText, pageWidth - 20, yPosition, { align: 'right' });
        
        yPosition += 7;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 100, 0);
        doc.text(formatCurrency(program.amount_cad), 20, yPosition);
        doc.setTextColor(0, 0, 0);
        
        yPosition += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(program.application_url.substring(0, 80), 20, yPosition);
        
        yPosition += 15;
      });

      // Footer
      yPosition = doc.internal.pageSize.getHeight() - 20;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(isEnglish 
        ? 'This report is for informational purposes only. Please verify eligibility with official program sources.'
        : 'Ce rapport est à titre informatif seulement. Veuillez vérifier l\'éligibilité auprès des sources officielles.',
        pageWidth / 2, yPosition, { align: 'center' }
      );

      doc.save(`incentives-report-${province || 'canada'}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(isEnglish ? 'PDF exported successfully' : 'PDF exporté avec succès');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error(isEnglish ? 'Failed to export PDF' : 'Erreur lors de l\'export PDF');
    }
  };

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
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {t('incentives.title')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('incentives.subtitle')}
            </CardDescription>
          </div>
          {showExport && programs.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              {t('incentives.exportPdf')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Filters */}
        <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-4'}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 min-h-[20px]">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <Label>{t('incentives.province')}</Label>
            </div>
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger>
                <SelectValue placeholder={t('incentives.selectProvince')} />
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
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <Label>{t('incentives.vehicleClass')}</Label>
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
              <Label>{t('incentives.fuelType')}</Label>
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
              <Label>{t('incentives.vehicleCount')}</Label>
            </div>
            <Input
              type="number"
              min={1}
              max={1000}
              value={vehicleCount}
              onChange={(e) => setVehicleCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
        </div>

        <Separator />

        {/* Loading state */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('incentives.noPrograms')}</p>
            <p className="text-sm mt-1">{t('incentives.tryDifferentFilters')}</p>
          </div>
        ) : (
          <>
            {/* Total Summary */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('incentives.totalAvailable')}</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(totalIncentives)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatCurrency(perVehicle.total)} × {vehicleCount} {t('incentives.vehicles')}
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="default" className="bg-blue-600">{t('incentives.federal')}</Badge>
                    <span className="font-medium">{formatCurrency(perVehicle.federal)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">{t('incentives.provincial')}</Badge>
                    <span className="font-medium">{formatCurrency(perVehicle.provincial)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Programs List */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {t('incentives.applicablePrograms')} ({programs.length})
              </h4>
              
              {programs.map(program => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  isEnglish={isEnglish}
                  formatCurrency={formatCurrency}
                  getLevelBadgeVariant={getLevelBadgeVariant}
                  getLevelLabel={getLevelLabel}
                  isDeadlineApproaching={isDeadlineApproaching}
                  getDaysSinceVerification={getDaysSinceVerification}
                  t={t}
                />
              ))}
            </div>

            {/* How to Apply */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-3">{t('incentives.howToApply')}</h4>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                  {t('incentives.step1')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                  {t('incentives.step2')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                  {t('incentives.step3')}
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">4</span>
                  {t('incentives.step4')}
                </li>
              </ol>
            </div>

            {/* Stacking Note */}
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p>{t('incentives.stackingNote')}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Program Card Component
interface ProgramCardProps {
  program: IncentiveProgram;
  isEnglish: boolean;
  formatCurrency: (amount: number) => string;
  getLevelBadgeVariant: (level: string) => "default" | "secondary" | "outline";
  getLevelLabel: (level: string) => string;
  isDeadlineApproaching: (deadline: string | null) => boolean;
  getDaysSinceVerification: (lastVerified: string) => number;
  t: (key: string) => string;
}

function ProgramCard({
  program,
  isEnglish,
  formatCurrency,
  getLevelBadgeVariant,
  getLevelLabel,
  isDeadlineApproaching,
  getDaysSinceVerification,
  t,
}: ProgramCardProps) {
  const daysSinceVerified = getDaysSinceVerification(program.last_verified_date);
  const deadlineApproaching = isDeadlineApproaching(program.deadline);

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="font-medium truncate">
              {isEnglish ? program.program_name_en : program.program_name_fr}
            </h5>
            <Badge variant={getLevelBadgeVariant(program.level)}>
              {getLevelLabel(program.level)}
            </Badge>
            {program.province && (
              <Badge variant="outline">{program.province}</Badge>
            )}
          </div>
          
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
            {formatCurrency(program.amount_cad)}
          </p>
          
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {isEnglish ? program.description_en : program.description_fr}
          </p>

          {/* Eligibility */}
          <details className="mt-3">
            <summary className="text-sm font-medium cursor-pointer text-primary hover:underline">
              {t('incentives.eligibility')}
            </summary>
            <p className="text-sm text-muted-foreground mt-1 pl-4 border-l-2 border-muted">
              {isEnglish ? program.eligibility_criteria_en : program.eligibility_criteria_fr}
            </p>
          </details>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <Button size="sm" asChild>
            <a href={program.application_url} target="_blank" rel="noopener noreferrer">
              {t('incentives.applyNow')}
              <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </a>
          </Button>

          {/* Deadline warning */}
          {program.deadline && (
            <div className={`flex items-center gap-1 text-xs ${deadlineApproaching ? 'text-amber-600' : 'text-muted-foreground'}`}>
              <Calendar className="h-3 w-3" />
              {deadlineApproaching && <AlertTriangle className="h-3 w-3" />}
              {t('incentives.expiresIn')}: {new Date(program.deadline).toLocaleDateString(isEnglish ? 'en-CA' : 'fr-CA')}
            </div>
          )}

          {/* Verification status */}
          <div className={`text-xs ${daysSinceVerified > 30 ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {daysSinceVerified > 30 && <AlertTriangle className="h-3 w-3 inline mr-1" />}
            {t('incentives.lastVerified')}: {daysSinceVerified} {t('incentives.days')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IncentivesCalculator;

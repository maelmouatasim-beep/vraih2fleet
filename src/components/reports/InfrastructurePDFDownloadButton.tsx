import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { InfrastructureReportPDF, InfrastructureReportTranslations } from './InfrastructureReportPDF';

interface InfrastructureData {
  evVehicleCount: number;
  h2VehicleCount: number;
  chargersNeeded: number;
  chargersSlow: number;
  chargersFast: number;
  chargersUltra: number;
  evCapex: number;
  evOpex: number;
  evGridUpgrade: number;
  h2StationsNeeded: number;
  h2Capex: number;
  h2Opex: number;
  totalCapex: number;
  totalOpex10y: number;
  chargingSpeed: string;
  h2StationCapacity: string;
  evDailyKwh: number;
  h2DailyKg: number;
  evChargingHours: number;
  h2OperatingHours: number;
}

interface InfrastructurePDFDownloadButtonProps {
  data: InfrastructureData;
  scenarioName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function InfrastructurePDFDownloadButton({
  data,
  scenarioName,
  variant = 'outline',
  size = 'sm',
}: InfrastructurePDFDownloadButtonProps) {
  const { t, i18n } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const isEnglish = i18n.language === 'en';
  const locale = isEnglish ? 'en-CA' : 'fr-CA';

  const translations: InfrastructureReportTranslations = {
    title: isEnglish ? 'Infrastructure Requirements' : 'Besoins en Infrastructure',
    subtitle: isEnglish ? 'Planning Report' : 'Rapport de Planification',
    evChargers: isEnglish ? 'EV Chargers' : 'Bornes VÉ',
    h2Stations: isEnglish ? 'H₂ Stations' : 'Stations H₂',
    totalCapex: isEnglish ? 'Total CAPEX' : 'CAPEX Total',
    annualOpex: isEnglish ? 'OPEX' : 'OPEX',
    gridCapacity: isEnglish ? 'Grid Capacity' : 'Capacité Réseau',
    evInfrastructure: isEnglish ? 'EV Infrastructure' : 'Infrastructure VÉ',
    h2Infrastructure: isEnglish ? 'H₂ Infrastructure' : 'Infrastructure H₂',
    chargerType: isEnglish ? 'Charger Type' : 'Type de Borne',
    quantity: isEnglish ? 'Quantity' : 'Quantité',
    unitCost: isEnglish ? 'Unit Cost' : 'Coût Unitaire',
    totalCost: isEnglish ? 'Total Cost' : 'Coût Total',
    stationType: isEnglish ? 'Station Type' : 'Type de Station',
    capacity: isEnglish ? 'Capacity' : 'Capacité',
    dailyDemand: isEnglish ? 'Daily Demand' : 'Demande Quotidienne',
    recommendations: isEnglish ? 'Recommendations' : 'Recommandations',
    phasingPlan: isEnglish ? 'Phasing Plan' : 'Plan de Déploiement',
    disclaimer: isEnglish 
      ? 'Infrastructure estimates are for planning purposes. Verify with suppliers and utilities.' 
      : 'Les estimations sont à titre indicatif. Vérifiez auprès des fournisseurs et services publics.',
    methodology: isEnglish ? 'Methodology' : 'Méthodologie',
    dataSources: isEnglish ? 'Data Sources' : 'Sources de Données',
    chargingProfile: isEnglish ? 'Charging Profile' : 'Profil de Recharge',
    operatingHours: isEnglish ? 'Operating Hours' : 'Heures d\'Opération',
    vehicles: isEnglish ? 'Vehicles' : 'Véhicules',
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const blob = await pdf(
        <InfrastructureReportPDF
          data={data}
          scenarioName={scenarioName}
          translations={translations}
          locale={locale}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `H2Fleet_Infrastructure_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(isEnglish ? 'PDF generated successfully' : 'PDF généré avec succès');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(isEnglish ? 'Failed to generate PDF' : 'Erreur lors de la génération du PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleDownload} disabled={isGenerating}>
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {t('reports.pdf.generating')}
        </>
      ) : (
        <>
          <FileDown className="h-4 w-4 mr-2" />
          {t('reports.pdf.exportPdf')}
        </>
      )}
    </Button>
  );
}

export default InfrastructurePDFDownloadButton;

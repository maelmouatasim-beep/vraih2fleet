import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { SubsidiesReportPDF, SubsidiesReportTranslations } from './SubsidiesReportPDF';

interface SubsidyProgram {
  id: string;
  program_name_en: string;
  program_name_fr: string;
  level: 'federal' | 'provincial' | 'municipal';
  amount_cad: number;
  amount_max_cad?: number | null;
  deadline?: string | null;
  province?: string | null;
  application_url: string;
  status: string;
}

interface SubsidiesPDFDownloadButtonProps {
  programs: SubsidyProgram[];
  totalVehicleIncentives: number;
  infrastructureIncentives: number;
  perVehicle: { total: number; federal: number; provincial: number };
  vehicleCount: number;
  province?: string;
  vehicleClass?: string;
  fuelType?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function SubsidiesPDFDownloadButton({
  programs,
  totalVehicleIncentives,
  infrastructureIncentives,
  perVehicle,
  vehicleCount,
  province,
  vehicleClass,
  fuelType,
  variant = 'outline',
  size = 'sm',
}: SubsidiesPDFDownloadButtonProps) {
  const { t, i18n } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const isEnglish = i18n.language === 'en';
  const locale = isEnglish ? 'en-CA' : 'fr-CA';

  const translations: SubsidiesReportTranslations = {
    title: isEnglish ? 'Government Subsidies Report' : 'Rapport des Subventions Gouvernementales',
    subtitle: isEnglish ? 'Eligibility Analysis' : 'Analyse d\'éligibilité',
    reportDate: isEnglish ? 'Report Date' : 'Date du rapport',
    totalEligible: isEnglish ? 'Total Eligible' : 'Total Éligible',
    federalPrograms: isEnglish ? 'Federal Programs' : 'Programmes Fédéraux',
    provincialPrograms: isEnglish ? 'Provincial Programs' : 'Programmes Provinciaux',
    perVehicle: isEnglish ? 'Per Vehicle' : 'Par Véhicule',
    vehicles: isEnglish ? 'Vehicles' : 'Véhicules',
    programsAvailable: isEnglish ? 'Programs Available' : 'Programmes Disponibles',
    programName: isEnglish ? 'Program Name' : 'Nom du Programme',
    level: isEnglish ? 'Level' : 'Niveau',
    amount: isEnglish ? 'Amount' : 'Montant',
    deadline: isEnglish ? 'Deadline' : 'Date Limite',
    status: isEnglish ? 'Status' : 'Statut',
    federal: isEnglish ? 'Federal' : 'Fédéral',
    provincial: isEnglish ? 'Provincial' : 'Provincial',
    municipal: isEnglish ? 'Municipal' : 'Municipal',
    noDeadline: isEnglish ? 'Ongoing' : 'En cours',
    active: isEnglish ? 'Active' : 'Actif',
    howToApply: isEnglish ? 'How to Apply' : 'Comment Postuler',
    step1: isEnglish ? 'Verify Eligibility' : 'Vérifier l\'Éligibilité',
    step2: isEnglish ? 'Prepare Documents' : 'Préparer les Documents',
    step3: isEnglish ? 'Submit Application' : 'Soumettre la Demande',
    step4: isEnglish ? 'Complete Purchase' : 'Finaliser l\'Achat',
    documentsRequired: isEnglish ? 'Documents Required' : 'Documents Requis',
    disclaimer: isEnglish 
      ? 'This report is for informational purposes only. Verify eligibility with official program sources before applying.' 
      : 'Ce rapport est à titre informatif. Vérifiez l\'éligibilité auprès des sources officielles avant de postuler.',
    keyInsights: isEnglish ? 'Key Insights' : 'Points Clés',
    recommendations: isEnglish ? 'Recommendations' : 'Recommandations',
    nextSteps: isEnglish ? 'Next Steps' : 'Prochaines Étapes',
    methodology: isEnglish ? 'Methodology' : 'Méthodologie',
    dataSources: isEnglish ? 'Data Sources' : 'Sources de Données',
    infrastructureIncentives: isEnglish ? 'Infrastructure' : 'Infrastructure',
  };

  const handleDownload = async () => {
    if (programs.length === 0) {
      toast.error(isEnglish ? 'No programs to export' : 'Aucun programme à exporter');
      return;
    }

    setIsGenerating(true);
    try {
      const blob = await pdf(
        <SubsidiesReportPDF
          programs={programs}
          totalVehicleIncentives={totalVehicleIncentives}
          infrastructureIncentives={infrastructureIncentives}
          perVehicle={perVehicle}
          vehicleCount={vehicleCount}
          province={province}
          vehicleClass={vehicleClass}
          fuelType={fuelType}
          translations={translations}
          locale={locale}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `H2Fleet_Subsidies_Report_${province || 'Canada'}_${new Date().toISOString().split('T')[0]}.pdf`;
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
    <Button variant={variant} size={size} onClick={handleDownload} disabled={isGenerating || programs.length === 0}>
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

export default SubsidiesPDFDownloadButton;

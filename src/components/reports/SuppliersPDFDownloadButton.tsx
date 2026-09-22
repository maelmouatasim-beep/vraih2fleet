import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { SuppliersReportPDF, SuppliersReportTranslations } from './SuppliersReportPDF';

interface Supplier {
  id: string;
  company_name: string;
  supplier_type: string;
  country: string;
  province_state?: string | null;
  city?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  products_services: string[];
  certifications?: string[] | null;
  is_verified: boolean;
}

interface SuppliersPDFDownloadButtonProps {
  suppliers: Supplier[];
  filters?: {
    supplierType?: string;
    country?: string;
    certification?: string;
  };
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function SuppliersPDFDownloadButton({
  suppliers,
  filters,
  variant = 'outline',
  size = 'sm',
}: SuppliersPDFDownloadButtonProps) {
  const { t, i18n } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const isEnglish = i18n.language === 'en';
  const locale = isEnglish ? 'en-CA' : 'fr-CA';

  const translations: SuppliersReportTranslations = {
    title: isEnglish ? 'Suppliers Directory' : 'Annuaire des Fournisseurs',
    subtitle: isEnglish ? 'Hydrogen & EV Partners' : 'Partenaires Hydrogène & VÉ',
    totalSuppliers: isEnglish ? 'Total Suppliers' : 'Total Fournisseurs',
    h2Suppliers: isEnglish ? 'H₂ Suppliers' : 'Fournisseurs H₂',
    evSuppliers: isEnglish ? 'EV Suppliers' : 'Fournisseurs VÉ',
    regionsServed: isEnglish ? 'Regions' : 'Régions',
    supplierType: isEnglish ? 'Type' : 'Type',
    companyName: isEnglish ? 'Company' : 'Entreprise',
    location: isEnglish ? 'Location' : 'Emplacement',
    contact: isEnglish ? 'Contact' : 'Contact',
    services: isEnglish ? 'Services' : 'Services',
    verified: isEnglish ? 'Verified' : 'Vérifié',
    notVerified: isEnglish ? 'Not Verified' : 'Non Vérifié',
    disclaimer: isEnglish 
      ? 'This directory is for informational purposes only. Verify supplier credentials independently.' 
      : 'Cet annuaire est à titre informatif. Vérifiez les informations auprès des fournisseurs.',
    dataSources: isEnglish ? 'Data Sources' : 'Sources de Données',
    lastUpdated: isEnglish ? 'Last Updated' : 'Dernière mise à jour',
    filterApplied: isEnglish ? 'Filters' : 'Filtres',
    typeBreakdown: isEnglish ? 'By Type' : 'Par Type',
    regionBreakdown: isEnglish ? 'By Region' : 'Par Région',
  };

  const handleDownload = async () => {
    if (suppliers.length === 0) {
      toast.error(isEnglish ? 'No suppliers to export' : 'Aucun fournisseur à exporter');
      return;
    }

    setIsGenerating(true);
    try {
      const blob = await pdf(
        <SuppliersReportPDF
          suppliers={suppliers}
          filters={filters}
          translations={translations}
          locale={locale}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `H2Fleet_Suppliers_Directory_${new Date().toISOString().split('T')[0]}.pdf`;
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
    <Button variant={variant} size={size} onClick={handleDownload} disabled={isGenerating || suppliers.length === 0}>
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

export default SuppliersPDFDownloadButton;

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileDown, 
  CheckSquare, 
  Building2, 
  DollarSign,
  Leaf,
  FileText,
  Printer,
  AlertCircle
} from 'lucide-react';
import { useIncentives, IncentiveProgram } from '@/hooks/useIncentives';
import { supabase } from '@/integrations/supabase/client';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface ProjectData {
  name: string;
  vehicleCount: number;
  estimatedCost: number;
  co2Savings: number;
}

export function SubsidiesAssistant() {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  
  const { programs } = useIncentives({ status: 'active' });
  const [selectedPrograms, setSelectedPrograms] = useState<Set<string>>(new Set());
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form fields for application
  const [organizationName, setOrganizationName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  // Load project data from user's scenarios
  useEffect(() => {
    async function loadProjectData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's projects and scenarios
        const { data: projects } = await supabase
          .from('projects')
          .select('*, scenarios(*)')
          .eq('user_id', user.id)
          .limit(1);

        if (projects && projects.length > 0) {
          const project = projects[0];
          
          // Get TCO results for scenarios
          const scenarioIds = project.scenarios?.map((s: any) => s.id) || [];
          if (scenarioIds.length > 0) {
            const { data: tcoResults } = await supabase
              .from('tco_results')
              .select('*')
              .in('scenario_id', scenarioIds)
              .eq('is_current', true)
              .limit(1);

            if (tcoResults && tcoResults.length > 0) {
              const result = tcoResults[0];
              setProjectData({
                name: project.name,
                vehicleCount: 10, // Would need fleet composition parsing
                estimatedCost: result.capex || 0,
                co2Savings: result.co2_savings || 0,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading project data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProjectData();
  }, []);

  const toggleProgram = (id: string) => {
    setSelectedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedProgramsList = programs.filter(p => selectedPrograms.has(p.id));
  const totalEstimated = selectedProgramsList.reduce((sum, p) => sum + p.amount_cad, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isEnglish ? 'en-CA' : 'fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportApplication = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(isEnglish ? 'Subsidy Application Package' : 'Dossier de demande de subvention', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Organization info
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(isEnglish ? 'Organization Information' : 'Information sur l\'organisation', 20, yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.text(`${isEnglish ? 'Organization' : 'Organisation'}: ${organizationName || 'N/A'}`, 20, yPosition);
      yPosition += 6;
      doc.text(`${isEnglish ? 'Contact' : 'Contact'}: ${contactName || 'N/A'}`, 20, yPosition);
      yPosition += 6;
      doc.text(`${isEnglish ? 'Email' : 'Courriel'}: ${contactEmail || 'N/A'}`, 20, yPosition);
      yPosition += 15;

      // Project details
      if (projectData) {
        doc.setFont('helvetica', 'bold');
        doc.text(isEnglish ? 'Project Details' : 'Détails du projet', 20, yPosition);
        yPosition += 8;
        doc.setFont('helvetica', 'normal');
        doc.text(`${isEnglish ? 'Project Name' : 'Nom du projet'}: ${projectData.name}`, 20, yPosition);
        yPosition += 6;
        doc.text(`${isEnglish ? 'Number of Vehicles' : 'Nombre de véhicules'}: ${projectData.vehicleCount}`, 20, yPosition);
        yPosition += 6;
        doc.text(`${isEnglish ? 'Estimated Investment' : 'Investissement estimé'}: ${formatCurrency(projectData.estimatedCost)}`, 20, yPosition);
        yPosition += 6;
        doc.text(`${isEnglish ? 'Estimated CO₂ Savings' : 'Économies CO₂ estimées'}: ${projectData.co2Savings.toFixed(0)} tonnes`, 20, yPosition);
        yPosition += 15;
      }

      // Project description
      if (projectDescription) {
        doc.setFont('helvetica', 'bold');
        doc.text(isEnglish ? 'Project Description' : 'Description du projet', 20, yPosition);
        yPosition += 8;
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(projectDescription, pageWidth - 40);
        doc.text(lines, 20, yPosition);
        yPosition += lines.length * 6 + 10;
      }

      // Selected programs
      doc.setFont('helvetica', 'bold');
      doc.text(isEnglish ? 'Selected Programs' : 'Programmes sélectionnés', 20, yPosition);
      yPosition += 10;

      selectedProgramsList.forEach((program, index) => {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ${isEnglish ? program.program_name_en : program.program_name_fr}`, 20, yPosition);
        yPosition += 6;
        doc.setFont('helvetica', 'normal');
        doc.text(`${isEnglish ? 'Amount' : 'Montant'}: ${formatCurrency(program.amount_cad)}`, 25, yPosition);
        yPosition += 6;
        doc.text(`${isEnglish ? 'Apply at' : 'Demander à'}: ${program.application_url}`, 25, yPosition);
        yPosition += 10;
      });

      // Total
      yPosition += 5;
      doc.setFont('helvetica', 'bold');
      doc.text(`${isEnglish ? 'TOTAL ESTIMATED SUBSIDIES' : 'TOTAL SUBVENTIONS ESTIMÉES'}: ${formatCurrency(totalEstimated)}`, 20, yPosition);

      // Checklist
      yPosition += 20;
      doc.setFontSize(14);
      doc.text(isEnglish ? 'Required Documents Checklist' : 'Liste des documents requis', 20, yPosition);
      yPosition += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const checklist = isEnglish ? [
        '☐ Proof of organization registration (articles of incorporation)',
        '☐ Certificate of good standing / NEQ number',
        '☐ Vehicle purchase quote(s) from authorized dealer',
        '☐ Proof of vehicle delivery address in Canada',
        '☐ Fleet transition plan / business case',
        '☐ Financial statements (last 2 years)',
        '☐ Environmental impact assessment (if applicable)',
        '☐ Infrastructure installation quotes (if applicable)',
      ] : [
        '☐ Preuve d\'enregistrement de l\'organisation (statuts constitutifs)',
        '☐ Certificat de conformité / numéro NEQ',
        '☐ Soumission(s) d\'achat de véhicules d\'un concessionnaire autorisé',
        '☐ Preuve d\'adresse de livraison au Canada',
        '☐ Plan de transition de flotte / analyse de rentabilité',
        '☐ États financiers (2 dernières années)',
        '☐ Évaluation d\'impact environnemental (si applicable)',
        '☐ Soumissions d\'installation d\'infrastructure (si applicable)',
      ];

      checklist.forEach(item => {
        doc.text(item, 20, yPosition);
        yPosition += 6;
      });

      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(
        isEnglish 
          ? `Generated by H2Fleet Planner on ${new Date().toLocaleDateString('en-CA')}`
          : `Généré par H2Fleet Planner le ${new Date().toLocaleDateString('fr-CA')}`,
        pageWidth / 2, footerY, { align: 'center' }
      );

      doc.save(`subsidy-application-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success(isEnglish ? 'Application package exported' : 'Dossier de demande exporté');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(isEnglish ? 'Export failed' : 'Échec de l\'export');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Program Selection */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {t('subsidies.selectPrograms')}
          </CardTitle>
          <CardDescription>
            {t('subsidies.selectProgramsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {programs.filter(p => p.status === 'active').map(program => (
            <div
              key={program.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedPrograms.has(program.id) 
                  ? 'border-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => toggleProgram(program.id)}
            >
              <Checkbox
                checked={selectedPrograms.has(program.id)}
                onCheckedChange={() => toggleProgram(program.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {isEnglish ? program.program_name_en : program.program_name_fr}
                  </span>
                  <Badge variant={program.level === 'federal' ? 'default' : 'secondary'} className="text-xs">
                    {program.level === 'federal' ? t('subsidies.federal') : t('subsidies.provincial')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {isEnglish ? program.description_en : program.description_fr}
                </p>
              </div>
              <span className="font-bold text-green-600 shrink-0">
                {formatCurrency(program.amount_cad)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Application Form */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('subsidies.organizationInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('subsidies.organizationName')}</Label>
              <Input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder={isEnglish ? 'Your organization name' : 'Nom de votre organisation'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('subsidies.contactName')}</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={isEnglish ? 'Contact person' : 'Personne-ressource'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('subsidies.contactEmail')}</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('subsidies.projectDescription')}</Label>
              <Textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder={isEnglish ? 'Describe your fleet transition project...' : 'Décrivez votre projet de transition de flotte...'}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Project Data from H2Fleet */}
        {projectData && (
          <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('subsidies.prefillFromProject')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('subsidies.project')}:</span>
                <span className="font-medium">{projectData.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('subsidies.vehicles')}:</span>
                <span className="font-medium">{projectData.vehicleCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('subsidies.investment')}:</span>
                <span className="font-medium">{formatCurrency(projectData.estimatedCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CO₂:</span>
                <span className="font-medium text-green-600">-{projectData.co2Savings.toFixed(0)}t</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary & Export */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {t('subsidies.applicationSummary')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('subsidies.programsSelected')}</p>
              <p className="text-2xl font-bold">{selectedPrograms.size}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('subsidies.totalEstimated')}</p>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totalEstimated)}</p>
            </div>
            <Separator />
            <Button 
              className="w-full" 
              onClick={handleExportApplication}
              disabled={selectedPrograms.size === 0}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {t('subsidies.exportApplication')}
            </Button>
            {selectedPrograms.size === 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('subsidies.selectAtLeastOne')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

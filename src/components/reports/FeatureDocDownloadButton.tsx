import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pdf } from '@react-pdf/renderer';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FeatureDocumentationPDF, FeatureDocTranslations } from './FeatureDocumentationPDF';

// Helper function to get translations for the PDF
function getFeatureDocTranslations(t: (key: string, fallback: string) => string): FeatureDocTranslations {
  return {
    title: t('featureDoc.title', 'Platform Feature Documentation'),
    subtitle: t('featureDoc.subtitle', 'Comprehensive guide to H2Fleet Planner modules'),
    version: t('featureDoc.version', 'Version'),
    generatedOn: t('featureDoc.generatedOn', 'Generated on'),
    tableOfContents: t('featureDoc.tableOfContents', 'Table of Contents'),
    keyFeatures: t('featureDoc.keyFeatures', 'Key Features'),
    typicalUseCases: t('featureDoc.typicalUseCases', 'Typical Use Cases'),
    appendix: t('featureDoc.appendix', 'Appendix'),
    technicalStack: t('featureDoc.technicalStack', 'Technical Stack'),
    contactSupport: t('featureDoc.contactSupport', 'Contact & Support'),
    // Introduction page translations
    projectPresentation: t('featureDoc.projectPresentation', 'Project Presentation'),
    theChallenge: t('featureDoc.theChallenge', 'The Challenge'),
    challengeText: t('featureDoc.challengeText', 'The transition to zero-emission heavy-duty fleets is complex: fluctuating energy costs, evolving regulations, diverse technology options, and significant infrastructure investments. Fleet managers need reliable tools to make informed decisions based on solid financial and operational data.'),
    ourSolution: t('featureDoc.ourSolution', 'Our Solution'),
    solutionText: t('featureDoc.solutionText', 'H2Fleet Planner is a B2B SaaS platform that enables fleet managers to simulate diesel-to-EV/H2 transitions, compare scenarios using Total Cost of Ownership (TCO) analysis, and plan phased deployment roadmaps over 10-15 year horizons. Our platform combines regional reference data, infrastructure planning tools, and subsidies databases to provide comprehensive decision support.'),
    targetAudience: t('featureDoc.targetAudience', 'Who Is H2Fleet For?'),
    audienceList: [
      t('featureDoc.audienceList.0', 'Fleet managers in transportation and logistics'),
      t('featureDoc.audienceList.1', 'Project developers and infrastructure planners'),
      t('featureDoc.audienceList.2', 'Energy transition consultants'),
      t('featureDoc.audienceList.3', 'Municipalities and government agencies'),
    ],
    valueProposition: t('featureDoc.valueProposition', 'Key Benefits'),
    valueList: [
      t('featureDoc.valueList.0', 'Data-driven decision making with TCO, CAPEX/OPEX analysis'),
      t('featureDoc.valueList.1', 'Multi-scenario comparison (Diesel, BEV, FCEV, Hybrid)'),
      t('featureDoc.valueList.2', 'Access to subsidies database and supplier directory'),
      t('featureDoc.valueList.3', 'Phased deployment planning with Gantt roadmap'),
      t('featureDoc.valueList.4', 'Bilingual platform (English/French) for Canadian market'),
    ],
    modules: {
      dashboard: {
        title: t('featureDoc.modules.dashboard.title', 'Dashboard'),
        description: t('featureDoc.modules.dashboard.description', 'The Dashboard serves as your central command center, providing a real-time overview of your fleet transition progress. It displays key performance indicators, project summaries, and quick access to all major platform features. The dashboard is designed to give fleet managers an immediate understanding of their zero-emission transition status.'),
        features: [
          t('featureDoc.modules.dashboard.features.0', 'Real-time fleet composition overview with vehicle counts by fuel type'),
          t('featureDoc.modules.dashboard.features.1', 'TCO summary cards showing total cost of ownership across all scenarios'),
          t('featureDoc.modules.dashboard.features.2', 'Recent projects list with quick navigation'),
          t('featureDoc.modules.dashboard.features.3', 'Data quality indicators and reference data status'),
          t('featureDoc.modules.dashboard.features.4', 'One-click CSV export for fleet data'),
        ],
        useCases: [
          t('featureDoc.modules.dashboard.useCases.0', 'Morning check on fleet transition progress'),
          t('featureDoc.modules.dashboard.useCases.1', 'Executive reporting and status updates'),
          t('featureDoc.modules.dashboard.useCases.2', 'Quick navigation to active projects'),
        ],
        screenshotCaption: t('featureDoc.modules.dashboard.screenshotCaption', 'Figure 1: Dashboard overview showing KPIs and recent projects'),
      },
      scenarios: {
        title: t('featureDoc.modules.scenarios.title', 'TCO Scenarios'),
        description: t('featureDoc.modules.scenarios.description', 'The Scenarios module is the core analytical engine of H2Fleet Planner. It enables you to create, compare, and analyze multiple fleet transition scenarios including diesel baseline, battery-electric (BEV), hydrogen fuel cell (FCEV), and mixed fleet configurations. Each scenario calculates comprehensive Total Cost of Ownership over your chosen analysis horizon.'),
        features: [
          t('featureDoc.modules.scenarios.features.0', 'Multi-scenario comparison with side-by-side TCO analysis'),
          t('featureDoc.modules.scenarios.features.1', 'Flexible fleet composition with multiple vehicle categories'),
          t('featureDoc.modules.scenarios.features.2', 'Configurable analysis horizon (5-20 years) and discount rates'),
          t('featureDoc.modules.scenarios.features.3', 'Automatic baseline diesel comparison'),
          t('featureDoc.modules.scenarios.features.4', 'CO2 emissions calculation and reduction tracking'),
          t('featureDoc.modules.scenarios.features.5', 'PDF export of detailed scenario results'),
        ],
        useCases: [
          t('featureDoc.modules.scenarios.useCases.0', 'Comparing BEV vs FCEV for long-haul trucking'),
          t('featureDoc.modules.scenarios.useCases.1', 'Building a business case for fleet electrification'),
          t('featureDoc.modules.scenarios.useCases.2', 'Sensitivity analysis on fuel price variations'),
        ],
        screenshotCaption: t('featureDoc.modules.scenarios.screenshotCaption', 'Figure 2: Scenario creation form with fleet composition'),
      },
      analytics: {
        title: t('featureDoc.modules.analytics.title', 'Advanced Analytics'),
        description: t('featureDoc.modules.analytics.description', 'The Analytics module provides deep insights into your fleet transition data through interactive visualizations, What-If analyses, and ESG tracking. It enables data-driven decision making by allowing you to explore different parameters and understand their impact on TCO and emissions.'),
        features: [
          t('featureDoc.modules.analytics.features.0', 'What-If analysis with real-time parameter adjustments'),
          t('featureDoc.modules.analytics.features.1', 'Sensitivity analysis charts for key cost drivers'),
          t('featureDoc.modules.analytics.features.2', 'ESG objectives tracker with target setting'),
          t('featureDoc.modules.analytics.features.3', 'Fleet comparison visualizations across scenarios'),
          t('featureDoc.modules.analytics.features.4', 'Cost projections and investment breakdown charts'),
          t('featureDoc.modules.analytics.features.5', 'ROI calculations and payback period analysis'),
        ],
        useCases: [
          t('featureDoc.modules.analytics.useCases.0', 'Understanding impact of electricity price changes on BEV TCO'),
          t('featureDoc.modules.analytics.useCases.1', 'Tracking progress toward corporate sustainability goals'),
          t('featureDoc.modules.analytics.useCases.2', 'Presenting investment analysis to stakeholders'),
        ],
        screenshotCaption: t('featureDoc.modules.analytics.screenshotCaption', 'Figure 3: Analytics dashboard with What-If analysis'),
      },
      infrastructure: {
        title: t('featureDoc.modules.infrastructure.title', 'Infrastructure Planning'),
        description: t('featureDoc.modules.infrastructure.description', 'The Infrastructure module helps you plan and size the charging and refueling infrastructure needed for your zero-emission fleet. It calculates station requirements based on fleet size, daily energy demand, and operational patterns, while providing cost estimates and feasibility alerts.'),
        features: [
          t('featureDoc.modules.infrastructure.features.0', 'Automatic charging station sizing based on fleet needs'),
          t('featureDoc.modules.infrastructure.features.1', 'Hydrogen station capacity planning'),
          t('featureDoc.modules.infrastructure.features.2', 'Grid capacity analysis and upgrade requirements'),
          t('featureDoc.modules.infrastructure.features.3', 'Interactive infrastructure map with depot locations'),
          t('featureDoc.modules.infrastructure.features.4', 'Feasibility alerts for power grid constraints'),
          t('featureDoc.modules.infrastructure.features.5', 'Infrastructure CAPEX and OPEX calculations'),
        ],
        useCases: [
          t('featureDoc.modules.infrastructure.useCases.0', 'Planning charging infrastructure for a new BEV fleet'),
          t('featureDoc.modules.infrastructure.useCases.1', 'Evaluating hydrogen station investment for regional operations'),
          t('featureDoc.modules.infrastructure.useCases.2', 'Identifying grid upgrade requirements before fleet deployment'),
        ],
        screenshotCaption: t('featureDoc.modules.infrastructure.screenshotCaption', 'Figure 4: Infrastructure planning with station requirements'),
      },
      roadmap: {
        title: t('featureDoc.modules.roadmap.title', 'Roadmap Builder'),
        description: t('featureDoc.modules.roadmap.description', 'The Roadmap Builder enables you to create detailed deployment timelines for your fleet transition. It breaks down your transition into phases and milestones, helping you visualize the implementation schedule, track progress, and manage dependencies between different workstreams.'),
        features: [
          t('featureDoc.modules.roadmap.features.0', 'Gantt chart visualization of transition phases'),
          t('featureDoc.modules.roadmap.features.1', 'Milestone tracking with due dates and assignments'),
          t('featureDoc.modules.roadmap.features.2', 'Phase management with budget allocation'),
          t('featureDoc.modules.roadmap.features.3', 'Progress tracking with completion percentages'),
          t('featureDoc.modules.roadmap.features.4', 'Alert system for upcoming deadlines'),
          t('featureDoc.modules.roadmap.features.5', 'Integration with scenario results'),
        ],
        useCases: [
          t('featureDoc.modules.roadmap.useCases.0', 'Planning a 5-year fleet electrification roadmap'),
          t('featureDoc.modules.roadmap.useCases.1', 'Coordinating vehicle procurement with infrastructure deployment'),
          t('featureDoc.modules.roadmap.useCases.2', 'Tracking progress against regulatory compliance deadlines'),
        ],
        screenshotCaption: t('featureDoc.modules.roadmap.screenshotCaption', 'Figure 5: Roadmap builder with Gantt chart view'),
      },
      telematics: {
        title: t('featureDoc.modules.telematics.title', 'Telematics Integration'),
        description: t('featureDoc.modules.telematics.description', 'The Telematics module enables you to import real operational data from your fleet management systems. By analyzing actual vehicle usage patterns, daily mileage, and fuel consumption, the platform can generate more accurate scenarios and recommendations tailored to your specific operations.'),
        features: [
          t('featureDoc.modules.telematics.features.0', 'Import fleet data via CSV or API integration'),
          t('featureDoc.modules.telematics.features.1', 'Vehicle grouping based on operational patterns'),
          t('featureDoc.modules.telematics.features.2', 'Automatic technology recommendations per vehicle group'),
          t('featureDoc.modules.telematics.features.3', 'Auto-generated scenarios based on real data'),
          t('featureDoc.modules.telematics.features.4', 'Fleet analytics dashboard with usage insights'),
          t('featureDoc.modules.telematics.features.5', 'Integration with major telematics providers'),
        ],
        useCases: [
          t('featureDoc.modules.telematics.useCases.0', 'Importing Geotab data to identify electrification candidates'),
          t('featureDoc.modules.telematics.useCases.1', 'Analyzing daily mileage to determine range requirements'),
          t('featureDoc.modules.telematics.useCases.2', 'Creating data-driven scenarios from actual fleet operations'),
        ],
        screenshotCaption: t('featureDoc.modules.telematics.screenshotCaption', 'Figure 6: Telematics import and vehicle grouping'),
      },
      referenceData: {
        title: t('featureDoc.modules.referenceData.title', 'Reference Data'),
        description: t('featureDoc.modules.referenceData.description', 'The Reference Data module provides access to curated market data including vehicle prices, energy costs, emission factors, and more. All data is region-specific and regularly updated. Users can view, filter, and in some cases customize these values to match their specific context.'),
        features: [
          t('featureDoc.modules.referenceData.features.0', 'Regional energy prices (electricity, hydrogen, diesel)'),
          t('featureDoc.modules.referenceData.features.1', 'Vehicle specifications and pricing by category'),
          t('featureDoc.modules.referenceData.features.2', 'CO2 emission factors by energy source'),
          t('featureDoc.modules.referenceData.features.3', 'Data freshness indicators and source citations'),
          t('featureDoc.modules.referenceData.features.4', 'Import/export functionality for data management'),
          t('featureDoc.modules.referenceData.features.5', 'Custom data creation for proprietary information'),
        ],
        useCases: [
          t('featureDoc.modules.referenceData.useCases.0', 'Checking current hydrogen prices in your region'),
          t('featureDoc.modules.referenceData.useCases.1', 'Customizing vehicle prices based on negotiated quotes'),
          t('featureDoc.modules.referenceData.useCases.2', 'Reviewing emission factors for carbon credit calculations'),
        ],
        screenshotCaption: t('featureDoc.modules.referenceData.screenshotCaption', 'Figure 7: Reference data table with energy prices'),
      },
      suppliers: {
        title: t('featureDoc.modules.suppliers.title', 'Suppliers Directory'),
        description: t('featureDoc.modules.suppliers.description', 'The Suppliers Directory is a curated database of vehicle manufacturers, infrastructure providers, fuel suppliers, and service providers in the zero-emission transportation ecosystem. It helps fleet managers identify and connect with potential partners for their transition projects.'),
        features: [
          t('featureDoc.modules.suppliers.features.0', 'Searchable supplier database with filters'),
          t('featureDoc.modules.suppliers.features.1', 'Interactive map showing supplier locations'),
          t('featureDoc.modules.suppliers.features.2', 'Supplier profiles with products and services'),
          t('featureDoc.modules.suppliers.features.3', 'Favorites system for shortlisting suppliers'),
          t('featureDoc.modules.suppliers.features.4', 'Contact information and verification status'),
          t('featureDoc.modules.suppliers.features.5', 'Filter by supplier type, region, and certifications'),
        ],
        useCases: [
          t('featureDoc.modules.suppliers.useCases.0', 'Finding hydrogen fuel cell truck manufacturers'),
          t('featureDoc.modules.suppliers.useCases.1', 'Identifying charging infrastructure installers in your region'),
          t('featureDoc.modules.suppliers.useCases.2', 'Building a shortlist of potential partners for RFP'),
        ],
        screenshotCaption: t('featureDoc.modules.suppliers.screenshotCaption', 'Figure 8: Suppliers directory with map view'),
      },
      subsidies: {
        title: t('featureDoc.modules.subsidies.title', 'Subsidies & Funding'),
        description: t('featureDoc.modules.subsidies.description', 'The Subsidies module provides a comprehensive database of government incentives, grants, and funding programs available for zero-emission fleet transition. It includes federal, provincial, and municipal programs with eligibility criteria, application deadlines, and direct links to program portals.'),
        features: [
          t('featureDoc.modules.subsidies.features.0', 'Federal and provincial incentive programs database'),
          t('featureDoc.modules.subsidies.features.1', 'Eligibility calculator based on fleet and vehicle type'),
          t('featureDoc.modules.subsidies.features.2', 'Calendar view with application deadlines'),
          t('featureDoc.modules.subsidies.features.3', 'AI-powered subsidies assistant for guidance'),
          t('featureDoc.modules.subsidies.features.4', 'Direct links to application portals'),
          t('featureDoc.modules.subsidies.features.5', 'Status tracking (active, expired, coming soon)'),
        ],
        useCases: [
          t('featureDoc.modules.subsidies.useCases.0', 'Finding available incentives for Class 8 electric trucks'),
          t('featureDoc.modules.subsidies.useCases.1', 'Planning applications around upcoming program deadlines'),
          t('featureDoc.modules.subsidies.useCases.2', 'Calculating total incentive value for a fleet purchase'),
        ],
        screenshotCaption: t('featureDoc.modules.subsidies.screenshotCaption', 'Figure 9: Subsidies calculator with eligible programs'),
      },
      helpAssistant: {
        title: t('featureDoc.modules.helpAssistant.title', 'Help & AI Assistant'),
        description: t('featureDoc.modules.helpAssistant.description', 'The Help & AI Assistant module provides comprehensive support resources including documentation, video tutorials, FAQ, and an AI-powered assistant. The AI assistant can answer questions about the platform, provide guidance on fleet transition best practices, and help interpret your analysis results.'),
        features: [
          t('featureDoc.modules.helpAssistant.features.0', 'AI-powered assistant for contextual help'),
          t('featureDoc.modules.helpAssistant.features.1', 'Platform documentation and user guides'),
          t('featureDoc.modules.helpAssistant.features.2', 'Video tutorials for key workflows'),
          t('featureDoc.modules.helpAssistant.features.3', 'Frequently asked questions database'),
          t('featureDoc.modules.helpAssistant.features.4', 'Proactive suggestions based on user context'),
          t('featureDoc.modules.helpAssistant.features.5', 'Multi-language support (EN/FR)'),
        ],
        useCases: [
          t('featureDoc.modules.helpAssistant.useCases.0', 'Getting quick answers about TCO calculation methodology'),
          t('featureDoc.modules.helpAssistant.useCases.1', 'Learning how to create your first scenario'),
          t('featureDoc.modules.helpAssistant.useCases.2', 'Understanding infrastructure sizing recommendations'),
        ],
        screenshotCaption: t('featureDoc.modules.helpAssistant.screenshotCaption', 'Figure 10: AI Assistant providing contextual guidance'),
      },
    },
  };
}

interface FeatureDocDownloadButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function FeatureDocDownloadButton({ 
  variant = 'default', 
  size = 'default',
  className 
}: FeatureDocDownloadButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const translations = getFeatureDocTranslations((key, fallback) => t(key, fallback));
      
      const blob = await pdf(
        <FeatureDocumentationPDF 
          translations={translations} 
          locale={i18n.language} 
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `H2Fleet-Feature-Documentation-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: t('settings.downloadSuccess', 'Download Complete'),
        description: t('settings.pdfGenerated', 'Your PDF has been generated and downloaded.'),
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: t('common.error', 'Error'),
        description: t('settings.pdfError', 'Failed to generate PDF. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isGenerating}
      className={className}
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('common.generating', 'Generating...')}
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          {t('settings.downloadFeatureDoc', 'Download Feature Documentation')}
        </>
      )}
    </Button>
  );
}

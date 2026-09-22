import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// TODO: Re-enable screenshot imports when images are available
// import moduleDashboard from '@/assets/module-dashboard.png';
// import moduleScenarios from '@/assets/module-scenarios.png';
// import moduleAnalytics from '@/assets/module-analytics.png';
// import moduleRoadmap from '@/assets/module-roadmap.png';
// import moduleTelematics from '@/assets/module-telematics.png';
// import moduleReferenceData from '@/assets/module-reference-data.png';
// import moduleSuppliers from '@/assets/module-suppliers.png';
// import moduleSubsidies from '@/assets/module-subsidies.png';
// import moduleHelpAssistant from '@/assets/module-help-assistant.png';

// Temporarily use empty map - placeholders will be shown instead
const moduleScreenshots: Record<string, string> = {
  // dashboard: moduleDashboard,
  // scenarios: moduleScenarios,
  // analytics: moduleAnalytics,
  // infrastructure: moduleAnalytics,
  // roadmap: moduleRoadmap,
  // telematics: moduleTelematics,
  // referenceData: moduleReferenceData,
  // suppliers: moduleSuppliers,
  // subsidies: moduleSubsidies,
  // helpAssistant: moduleHelpAssistant,
};

// Styles for the PDF
const styles = StyleSheet.create({
  // Cover page
  coverPage: {
    backgroundColor: '#10b981',
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  coverTitle: {
    fontSize: 42,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 40,
  },
  coverMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 60,
  },
  coverTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },

  // Introduction page
  introPage: {
    padding: 50,
    backgroundColor: '#ffffff',
  },
  introTitle: {
    fontSize: 28,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 25,
    borderBottomWidth: 3,
    borderBottomColor: '#10b981',
    paddingBottom: 10,
  },
  introSection: {
    marginBottom: 22,
  },
  introSectionTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  introText: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 1.7,
    textAlign: 'justify',
  },
  introHighlight: {
    backgroundColor: '#ecfdf5',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
  },
  introList: {
    marginLeft: 10,
    marginTop: 8,
  },
  introListItem: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  introBullet: {
    width: 18,
    fontSize: 10,
    color: '#10b981',
  },
  introListText: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },

  // Table of contents
  tocContainer: {
    padding: 50,
  },
  tocTitle: {
    fontSize: 28,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
    paddingBottom: 10,
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tocNumber: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: 'bold',
    width: 25,
  },
  tocText: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  tocPageNumber: {
    fontSize: 12,
    color: '#6b7280',
    width: 30,
    textAlign: 'right',
  },

  // Section pages
  sectionPage: {
    padding: 50,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#10b981',
    paddingBottom: 15,
  },
  sectionNumber: {
    fontSize: 36,
    color: '#10b981',
    fontWeight: 'bold',
    marginRight: 15,
  },
  sectionTitle: {
    fontSize: 26,
    color: '#111827',
    fontWeight: 'bold',
  },
  sectionDescription: {
    fontSize: 12,
    lineHeight: 1.7,
    color: '#4b5563',
    marginBottom: 25,
    textAlign: 'justify',
  },

  // Feature list
  featuresTitle: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 10,
  },
  featureList: {
    marginLeft: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  featureBullet: {
    width: 20,
    fontSize: 10,
    color: '#10b981',
  },
  featureText: {
    flex: 1,
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.5,
  },

  // Screenshot container
  screenshotContainer: {
    marginVertical: 15,
    alignItems: 'center',
  },
  screenshotImage: {
    width: '100%',
    maxHeight: 180,
    objectFit: 'contain',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  screenshotPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  screenshotText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  screenshotSubtext: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 5,
  },
  screenshotCaption: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Use cases
  useCasesTitle: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 15,
  },
  useCaseItem: {
    flexDirection: 'row',
    marginBottom: 6,
    marginLeft: 10,
  },
  useCaseNumber: {
    width: 20,
    fontSize: 10,
    color: '#10b981',
    fontWeight: 'bold',
  },
  useCaseText: {
    flex: 1,
    fontSize: 10,
    color: '#4b5563',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    color: '#9ca3af',
  },
  pageNumber: {
    fontSize: 9,
    color: '#6b7280',
  },

  // Appendix
  appendixTitle: {
    fontSize: 20,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  techStackSection: {
    marginBottom: 20,
  },
  techStackTitle: {
    fontSize: 14,
    color: '#374151',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  techStackItem: {
    flexDirection: 'row',
    marginBottom: 5,
    marginLeft: 10,
  },
  techLabel: {
    width: 120,
    fontSize: 10,
    color: '#6b7280',
  },
  techValue: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
  },

  // Contact page
  contactTitle: {
    fontSize: 20,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  contactSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  contactLabel: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.6,
  },
});

// Screenshot component - uses real image if available, placeholder otherwise
const ModuleScreenshot = ({ 
  moduleKey, 
  caption 
}: { 
  moduleKey: string; 
  caption: string;
}) => {
  const screenshotSrc = moduleScreenshots[moduleKey];
  
  return (
    <View style={styles.screenshotContainer}>
      {screenshotSrc ? (
        <Image src={screenshotSrc} style={styles.screenshotImage} />
      ) : (
        <View style={styles.screenshotPlaceholder}>
          <Text style={styles.screenshotText}>📷 {moduleKey}</Text>
          <Text style={styles.screenshotSubtext}>Module screenshot</Text>
        </View>
      )}
      <Text style={styles.screenshotCaption}>{caption}</Text>
    </View>
  );
};

// Page footer component
const PageFooter = ({ pageNumber }: { pageNumber: number }) => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>H2Fleet Planner - Feature Documentation</Text>
    <Text style={styles.pageNumber}>Page {pageNumber}</Text>
  </View>
);

export interface FeatureDocTranslations {
  title: string;
  subtitle: string;
  version: string;
  generatedOn: string;
  tableOfContents: string;
  keyFeatures: string;
  typicalUseCases: string;
  appendix: string;
  technicalStack: string;
  contactSupport: string;
  // Introduction page
  projectPresentation: string;
  theChallenge: string;
  challengeText: string;
  ourSolution: string;
  solutionText: string;
  targetAudience: string;
  audienceList: string[];
  valueProposition: string;
  valueList: string[];
  modules: {
    [key: string]: {
      title: string;
      description: string;
      features: string[];
      useCases: string[];
      screenshotCaption: string;
    };
  };
}

interface FeatureDocumentationPDFProps {
  translations: FeatureDocTranslations;
  locale: string;
}

// Introduction page component
const IntroductionPage = ({ 
  translations, 
  locale 
}: { 
  translations: FeatureDocTranslations; 
  locale: string;
}) => (
  <Page size="A4" style={styles.introPage}>
    <Text style={styles.introTitle}>{translations.projectPresentation}</Text>
    
    <View style={styles.introSection}>
      <Text style={styles.introSectionTitle}>{translations.theChallenge}</Text>
      <Text style={styles.introText}>{translations.challengeText}</Text>
    </View>
    
    <View style={styles.introSection}>
      <Text style={styles.introSectionTitle}>{translations.ourSolution}</Text>
      <Text style={styles.introText}>{translations.solutionText}</Text>
    </View>
    
    <View style={styles.introSection}>
      <Text style={styles.introSectionTitle}>{translations.targetAudience}</Text>
      <View style={styles.introList}>
        {translations.audienceList.map((item, idx) => (
          <View key={idx} style={styles.introListItem}>
            <Text style={styles.introBullet}>•</Text>
            <Text style={styles.introListText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
    
    <View style={styles.introHighlight}>
      <Text style={styles.introSectionTitle}>{translations.valueProposition}</Text>
      <View style={styles.introList}>
        {translations.valueList.map((item, idx) => (
          <View key={idx} style={styles.introListItem}>
            <Text style={styles.introBullet}>✓</Text>
            <Text style={styles.introListText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
    
    <PageFooter pageNumber={2} />
  </Page>
);

// Module section component
const ModuleSection = ({ 
  number, 
  moduleKey, 
  translations,
  pageNumber 
}: { 
  number: number; 
  moduleKey: string; 
  translations: FeatureDocTranslations;
  pageNumber: number;
}) => {
  const module = translations.modules[moduleKey];
  if (!module) return null;

  return (
    <Page size="A4" style={styles.sectionPage}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionNumber}>{String(number).padStart(2, '0')}</Text>
        <Text style={styles.sectionTitle}>{module.title}</Text>
      </View>

      <Text style={styles.sectionDescription}>{module.description}</Text>

      <ModuleScreenshot 
        moduleKey={moduleKey} 
        caption={module.screenshotCaption} 
      />

      <Text style={styles.featuresTitle}>{translations.keyFeatures}</Text>
      <View style={styles.featureList}>
        {module.features.map((feature, idx) => (
          <View key={idx} style={styles.featureItem}>
            <Text style={styles.featureBullet}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.useCasesTitle}>{translations.typicalUseCases}</Text>
      {module.useCases.map((useCase, idx) => (
        <View key={idx} style={styles.useCaseItem}>
          <Text style={styles.useCaseNumber}>{idx + 1}.</Text>
          <Text style={styles.useCaseText}>{useCase}</Text>
        </View>
      ))}

      <PageFooter pageNumber={pageNumber} />
    </Page>
  );
};

export const FeatureDocumentationPDF = ({ translations, locale }: FeatureDocumentationPDFProps) => {
  const generationDate = new Date().toLocaleDateString(locale === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const moduleKeys = [
    'dashboard',
    'scenarios',
    'analytics',
    'infrastructure',
    'roadmap',
    'telematics',
    'referenceData',
    'suppliers',
    'subsidies',
    'helpAssistant',
  ];

  return (
    <Document>
      {/* Page 1: Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverTitle}>H2Fleet Planner</Text>
        <Text style={styles.coverSubtitle}>{translations.title}</Text>
        <Text style={styles.coverTagline}>
          {locale === 'fr' 
            ? 'La plateforme de planification de transition de flotte zéro-émission' 
            : 'The Zero-Emission Fleet Transition Planning Platform'}
        </Text>
        <Text style={styles.coverMeta}>
          {translations.version} 2.0{'\n'}
          {translations.generatedOn}: {generationDate}
        </Text>
      </Page>

      {/* Page 2: Project Presentation / Introduction */}
      <IntroductionPage translations={translations} locale={locale} />

      {/* Page 3: Table of Contents */}
      <Page size="A4" style={styles.sectionPage}>
        <Text style={styles.tocTitle}>{translations.tableOfContents}</Text>
        
        {/* Introduction entry */}
        <View style={styles.tocItem}>
          <Text style={styles.tocNumber}>—</Text>
          <Text style={styles.tocText}>{translations.projectPresentation}</Text>
          <Text style={styles.tocPageNumber}>2</Text>
        </View>
        
        {/* Module entries */}
        {moduleKeys.map((key, idx) => (
          <View key={key} style={styles.tocItem}>
            <Text style={styles.tocNumber}>{String(idx + 1).padStart(2, '0')}</Text>
            <Text style={styles.tocText}>{translations.modules[key]?.title || key}</Text>
            <Text style={styles.tocPageNumber}>{idx + 4}</Text>
          </View>
        ))}
        
        {/* Appendix entries */}
        <View style={styles.tocItem}>
          <Text style={styles.tocNumber}>A</Text>
          <Text style={styles.tocText}>{translations.appendix}: {translations.technicalStack}</Text>
          <Text style={styles.tocPageNumber}>14</Text>
        </View>
        <View style={styles.tocItem}>
          <Text style={styles.tocNumber}>B</Text>
          <Text style={styles.tocText}>{translations.contactSupport}</Text>
          <Text style={styles.tocPageNumber}>15</Text>
        </View>
        
        <PageFooter pageNumber={3} />
      </Page>

      {/* Pages 4-13: Module Sections */}
      {moduleKeys.map((key, idx) => (
        <ModuleSection
          key={key}
          number={idx + 1}
          moduleKey={key}
          translations={translations}
          pageNumber={idx + 4}
        />
      ))}

      {/* Page 14: Appendix - Technical Stack */}
      <Page size="A4" style={styles.sectionPage}>
        <Text style={styles.appendixTitle}>{translations.appendix} A: {translations.technicalStack}</Text>
        
        <View style={styles.techStackSection}>
          <Text style={styles.techStackTitle}>Frontend</Text>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Framework:</Text>
            <Text style={styles.techValue}>React 18 + TypeScript</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Build Tool:</Text>
            <Text style={styles.techValue}>Vite</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Styling:</Text>
            <Text style={styles.techValue}>Tailwind CSS + shadcn/ui</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Charts:</Text>
            <Text style={styles.techValue}>Recharts</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Maps:</Text>
            <Text style={styles.techValue}>Mapbox GL</Text>
          </View>
        </View>

        <View style={styles.techStackSection}>
          <Text style={styles.techStackTitle}>Backend</Text>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Platform:</Text>
            <Text style={styles.techValue}>Lovable Cloud (Supabase)</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Database:</Text>
            <Text style={styles.techValue}>PostgreSQL with Row-Level Security</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Authentication:</Text>
            <Text style={styles.techValue}>Supabase Auth</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>Edge Functions:</Text>
            <Text style={styles.techValue}>Deno Runtime</Text>
          </View>
        </View>

        <View style={styles.techStackSection}>
          <Text style={styles.techStackTitle}>Integrations</Text>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>AI Assistant:</Text>
            <Text style={styles.techValue}>OpenAI / Gemini (via Lovable AI)</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>PDF Export:</Text>
            <Text style={styles.techValue}>@react-pdf/renderer</Text>
          </View>
          <View style={styles.techStackItem}>
            <Text style={styles.techLabel}>i18n:</Text>
            <Text style={styles.techValue}>i18next (EN/FR)</Text>
          </View>
        </View>

        <PageFooter pageNumber={14} />
      </Page>

      {/* Page 15: Contact & Support */}
      <Page size="A4" style={styles.sectionPage}>
        <Text style={styles.contactTitle}>{translations.contactSupport}</Text>
        
        <View style={styles.contactSection}>
          <Text style={styles.contactLabel}>
            {locale === 'fr' ? 'Support Technique' : 'Technical Support'}
          </Text>
          <Text style={styles.contactText}>
            {locale === 'fr' 
              ? 'Notre équipe de support est disponible pour vous aider avec toutes questions techniques ou fonctionnelles.'
              : 'Our support team is available to help you with any technical or functional questions.'}
            {'\n\n'}
            Email: support@h2fleet.app{'\n'}
            {locale === 'fr' ? 'Horaires: Lun-Ven, 9h-17h EST' : 'Hours: Mon-Fri, 9am-5pm EST'}
          </Text>
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.contactLabel}>
            {locale === 'fr' ? 'Documentation en ligne' : 'Online Documentation'}
          </Text>
          <Text style={styles.contactText}>
            {locale === 'fr'
              ? 'Accédez à notre documentation complète, tutoriels vidéo et FAQ sur notre portail d\'aide.'
              : 'Access our complete documentation, video tutorials, and FAQ on our help portal.'}
            {'\n\n'}
            https://h2fleet.app/docs
          </Text>
        </View>

        <View style={styles.contactSection}>
          <Text style={styles.contactLabel}>
            {locale === 'fr' ? 'Demande de démonstration' : 'Request a Demo'}
          </Text>
          <Text style={styles.contactText}>
            {locale === 'fr'
              ? 'Contactez notre équipe commerciale pour une démonstration personnalisée de la plateforme.'
              : 'Contact our sales team for a personalized platform demonstration.'}
            {'\n\n'}
            https://h2fleet.app/demo
          </Text>
        </View>

        <PageFooter pageNumber={15} />
      </Page>
    </Document>
  );
};

import { Document, Page, Text, View, Svg, Circle, Path } from '@react-pdf/renderer';
import { professionalStyles as styles, pdfColors, PDF_BRAND, recommendationStyles, alertStyles, kpiGridStyles } from './styles/pdfStyles';
import { PDFDonutChart, PDFBarChart } from './charts';

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

export interface SubsidiesReportTranslations {
  title: string;
  subtitle: string;
  reportDate: string;
  totalEligible: string;
  federalPrograms: string;
  provincialPrograms: string;
  perVehicle: string;
  vehicles: string;
  programsAvailable: string;
  programName: string;
  level: string;
  amount: string;
  deadline: string;
  status: string;
  federal: string;
  provincial: string;
  municipal: string;
  noDeadline: string;
  active: string;
  howToApply: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  documentsRequired: string;
  disclaimer: string;
  keyInsights: string;
  recommendations: string;
  nextSteps: string;
  methodology: string;
  dataSources: string;
  infrastructureIncentives: string;
}

interface SubsidiesReportPDFProps {
  programs: SubsidyProgram[];
  totalVehicleIncentives: number;
  infrastructureIncentives: number;
  perVehicle: { total: number; federal: number; provincial: number };
  vehicleCount: number;
  province?: string;
  vehicleClass?: string;
  fuelType?: string;
  translations: SubsidiesReportTranslations;
  locale?: string;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

const Logo = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40">
    <Circle cx={20} cy={20} r={18} fill="rgba(255,255,255,0.15)" />
    <Path d="M12 28 L20 12 L28 28 L20 22 Z" fill="white" />
    <Circle cx={20} cy={18} r={4} fill="rgba(255,255,255,0.85)" />
  </Svg>
);

export const SubsidiesReportPDF = ({
  programs,
  totalVehicleIncentives,
  infrastructureIncentives,
  perVehicle,
  vehicleCount,
  province,
  vehicleClass,
  fuelType,
  translations: t,
  locale = 'en-CA',
}: SubsidiesReportPDFProps) => {
  const totalIncentives = totalVehicleIncentives + infrastructureIncentives;
  const federalPrograms = programs.filter(p => p.level === 'federal');
  const provincialPrograms = programs.filter(p => p.level === 'provincial');

  // Chart data
  const levelChartData = [
    { label: t.federal, value: perVehicle.federal * vehicleCount, color: pdfColors.primary },
    { label: t.provincial, value: perVehicle.provincial * vehicleCount, color: pdfColors.secondary },
    { label: t.infrastructureIncentives, value: infrastructureIncentives, color: pdfColors.accent },
  ].filter(d => d.value > 0);

  const programChartData = programs.slice(0, 5).map((p, i) => ({
    label: (locale === 'fr-CA' ? p.program_name_fr : p.program_name_en).substring(0, 15),
    value: p.amount_cad,
    color: [pdfColors.primary, pdfColors.secondary, pdfColors.accent, pdfColors.success, pdfColors.hydrogen][i % 5],
  }));

  // Approaching deadlines
  const upcomingDeadlines = programs
    .filter(p => p.deadline)
    .filter(p => {
      const deadline = new Date(p.deadline!);
      const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntil > 0 && daysUntil <= 90;
    })
    .slice(0, 3);

  return (
    <Document>
      {/* ==================== COVER PAGE ==================== */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverHeader}>
          <View style={styles.coverHeaderContent}>
            <View style={styles.coverLogo}>
              <Logo />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.coverLogoText}>{PDF_BRAND.name}</Text>
                <Text style={styles.coverLogoSubtext}>Fleet TCO Analysis Platform</Text>
              </View>
            </View>
            <View style={styles.coverReportType}>
              <Text style={styles.coverReportTypeText}>Subsidies Analysis</Text>
            </View>
          </View>

          <View style={styles.coverTitleSection}>
            <Text style={styles.coverTitle}>{t.title}</Text>
            <Text style={styles.coverSubtitle}>{t.subtitle}</Text>
            <View style={styles.coverDateBadge}>
              <Text style={styles.coverDateText}>
                {new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.coverBody}>
          {/* Hero Metrics */}
          <View style={styles.heroMetricsContainer}>
            <View style={styles.heroMetricCardHighlight}>
              <Text style={styles.heroMetricValueHighlight}>{formatCurrency(totalIncentives)}</Text>
              <Text style={styles.heroMetricLabel}>{t.totalEligible}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{formatCurrency(perVehicle.federal * vehicleCount)}</Text>
              <Text style={styles.heroMetricLabel}>{t.federalPrograms}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{formatCurrency(perVehicle.provincial * vehicleCount)}</Text>
              <Text style={styles.heroMetricLabel}>{t.provincialPrograms}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{formatCurrency(perVehicle.total)}</Text>
              <Text style={styles.heroMetricLabel}>{t.perVehicle}</Text>
            </View>
          </View>

          {/* Context Info */}
          <View style={styles.coverInfoGrid}>
            {province && (
              <View style={styles.coverInfoItem}>
                <Text style={styles.coverInfoLabel}>Province</Text>
                <Text style={styles.coverInfoValue}>{province}</Text>
              </View>
            )}
            <View style={styles.coverInfoItem}>
              <Text style={styles.coverInfoLabel}>{t.vehicles}</Text>
              <Text style={styles.coverInfoValue}>{vehicleCount}</Text>
            </View>
            {vehicleClass && (
              <View style={styles.coverInfoItem}>
                <Text style={styles.coverInfoLabel}>Vehicle Class</Text>
                <Text style={styles.coverInfoValue}>{vehicleClass}</Text>
              </View>
            )}
            {fuelType && (
              <View style={styles.coverInfoItem}>
                <Text style={styles.coverInfoLabel}>Fuel Type</Text>
                <Text style={styles.coverInfoValue}>{fuelType}</Text>
              </View>
            )}
            <View style={styles.coverInfoItem}>
              <Text style={styles.coverInfoLabel}>{t.programsAvailable}</Text>
              <Text style={styles.coverInfoValue}>{programs.length}</Text>
            </View>
          </View>

          {/* Charts Section */}
          <View style={styles.coverChartsSection}>
            <View style={styles.coverChartBox}>
              <Text style={styles.coverChartTitle}>Incentives Breakdown</Text>
              {levelChartData.length > 0 && (
                <PDFDonutChart
                  data={levelChartData}
                  size={130}
                  centerValue={formatCurrency(totalIncentives)}
                  centerLabel="Total"
                  showPercentages
                />
              )}
            </View>
            <View style={styles.coverChartBox}>
              <Text style={styles.coverChartTitle}>Top Programs</Text>
              {programChartData.length > 0 && (
                <PDFBarChart
                  data={programChartData}
                  width={200}
                  height={100}
                  formatValue={formatCurrency}
                />
              )}
            </View>
          </View>

          <View style={styles.coverFooter}>
            <Text style={styles.coverFooterText}>{t.disclaimer}</Text>
          </View>
        </View>
      </Page>

      {/* ==================== PAGE 2: PROGRAMS DETAIL ==================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>{t.programsAvailable}</Text>
            <Text style={styles.pageSubtitle}>{programs.length} programs identified</Text>
          </View>
          <View style={styles.pageHeaderRight}>
            <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
            <Text style={styles.pageDate}>{new Date().toLocaleDateString(locale)}</Text>
          </View>
        </View>

        {/* Deadline Warnings */}
        {upcomingDeadlines.length > 0 && (
          <View style={alertStyles.warning}>
            <Text style={alertStyles.warningTitle}>⚠️ Upcoming Deadlines</Text>
            {upcomingDeadlines.map((p, i) => (
              <Text key={i} style={alertStyles.warningText}>
                • {locale === 'fr-CA' ? p.program_name_fr : p.program_name_en}: {new Date(p.deadline!).toLocaleDateString(locale)}
              </Text>
            ))}
          </View>
        )}

        {/* Programs Table */}
        <View style={styles.section}>
          <View style={styles.comparisonTable}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCellFirst}>{t.programName}</Text>
              <Text style={styles.tableHeaderCell}>{t.level}</Text>
              <Text style={styles.tableHeaderCell}>{t.amount}</Text>
              <Text style={styles.tableHeaderCell}>{t.deadline}</Text>
            </View>
            {/* Rows */}
            {programs.slice(0, 10).map((program, index) => (
              <View key={program.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.tableCellFirst}>
                  {(locale === 'fr-CA' ? program.program_name_fr : program.program_name_en).substring(0, 35)}
                </Text>
                <Text style={styles.tableCell}>
                  {program.level === 'federal' ? t.federal : program.level === 'provincial' ? t.provincial : t.municipal}
                </Text>
                <Text style={styles.tableCellHighlight}>{formatCurrency(program.amount_cad)}</Text>
                <Text style={styles.tableCell}>
                  {program.deadline ? new Date(program.deadline).toLocaleDateString(locale, { month: 'short', year: 'numeric' }) : t.noDeadline}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footerTCO}</Text>
          <Text style={styles.pageNumber}>2</Text>
        </View>
      </Page>

      {/* ==================== PAGE 3: HOW TO APPLY & RECOMMENDATIONS ==================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>{t.recommendations}</Text>
            <Text style={styles.pageSubtitle}>{t.nextSteps}</Text>
          </View>
          <View style={styles.pageHeaderRight}>
            <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
            <Text style={styles.pageDate}>{new Date().toLocaleDateString(locale)}</Text>
          </View>
        </View>

        {/* How to Apply Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.howToApply}</Text>
          <View style={recommendationStyles.container}>
            <View style={recommendationStyles.item}>
              <View style={recommendationStyles.number}>
                <Text style={recommendationStyles.numberText}>1</Text>
              </View>
              <View style={recommendationStyles.content}>
                <Text style={recommendationStyles.title}>{t.step1}</Text>
                <Text style={recommendationStyles.text}>Review eligibility criteria for each program and verify your organization qualifies.</Text>
              </View>
            </View>
            <View style={recommendationStyles.item}>
              <View style={recommendationStyles.number}>
                <Text style={recommendationStyles.numberText}>2</Text>
              </View>
              <View style={recommendationStyles.content}>
                <Text style={recommendationStyles.title}>{t.step2}</Text>
                <Text style={recommendationStyles.text}>Prepare required documentation including business registration, fleet information, and project details.</Text>
              </View>
            </View>
            <View style={recommendationStyles.item}>
              <View style={recommendationStyles.number}>
                <Text style={recommendationStyles.numberText}>3</Text>
              </View>
              <View style={recommendationStyles.content}>
                <Text style={recommendationStyles.title}>{t.step3}</Text>
                <Text style={recommendationStyles.text}>Submit applications before deadlines. Track application status through official portals.</Text>
              </View>
            </View>
            <View style={recommendationStyles.item}>
              <View style={recommendationStyles.number}>
                <Text style={recommendationStyles.numberText}>4</Text>
              </View>
              <View style={recommendationStyles.content}>
                <Text style={recommendationStyles.title}>{t.step4}</Text>
                <Text style={recommendationStyles.text}>Once approved, complete purchase/installation and submit proof for reimbursement.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Documents Required */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.documentsRequired}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {[
              'Business registration certificate',
              'Fleet vehicle inventory',
              'Purchase quotes/invoices',
              'Proof of Canadian operation',
              'Environmental impact assessment',
              'Project timeline',
            ].map((doc, i) => (
              <View key={i} style={[styles.badge, { backgroundColor: pdfColors.background }]}>
                <Text style={[styles.badgeText, { color: pdfColors.text }]}>☐ {doc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Methodology */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.methodology}</Text>
          <View style={styles.insightsBox}>
            <Text style={styles.insightsTitle}>{t.dataSources}</Text>
            <View style={styles.insightItem}>
              <Text style={styles.insightBullet}>•</Text>
              <Text style={styles.insightText}>Federal: Natural Resources Canada (NRCan) iZEV Program</Text>
            </View>
            <View style={styles.insightItem}>
              <Text style={styles.insightBullet}>•</Text>
              <Text style={styles.insightText}>Provincial: Province-specific incentive programs</Text>
            </View>
            <View style={styles.insightItem}>
              <Text style={styles.insightBullet}>•</Text>
              <Text style={styles.insightText}>Data verified: {new Date().toLocaleDateString(locale)}</Text>
            </View>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t.disclaimer}</Text>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footerTCO}</Text>
          <Text style={styles.pageNumber}>3</Text>
        </View>
      </Page>
    </Document>
  );
};

export default SubsidiesReportPDF;

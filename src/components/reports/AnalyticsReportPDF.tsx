import { Document, Page, Text, View, Svg, Circle, Path, Rect, Line } from '@react-pdf/renderer';
import { StyleSheet } from '@react-pdf/renderer';
import { PDFBarChart, PDFDonutChart } from './charts';

// ==================== CONSTANTS ====================
export const PDF_BRAND = {
  name: 'H2Fleet Planner',
  subtitle: 'Fleet TCO Analysis Platform',
  shortName: 'H2Fleet',
  footerAnalytics: 'H2Fleet Planner - Analytics Report',
};

// Professional color palette (McKinsey/BCG style)
const colors = {
  primary: '#0f766e',        // Teal-700 - Professional
  primaryDark: '#134e4a',    // Teal-900
  primaryLight: '#14b8a6',   // Teal-500
  accent: '#10b981',         // Emerald-500 (clean energy)
  accentLight: '#d1fae5',    // Emerald-100
  
  // Status colors
  success: '#16a34a',
  warning: '#d97706', 
  danger: '#dc2626',
  
  // Vehicle type colors
  diesel: '#6b7280',
  ev: '#22c55e',
  hydrogen: '#3b82f6',
  
  // Neutrals
  white: '#ffffff',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
};

// ==================== STYLES ====================
const styles = StyleSheet.create({
  // Cover Page
  coverPage: {
    backgroundColor: colors.primary,
    padding: 0,
    position: 'relative',
  },
  coverGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: colors.primaryDark,
  },
  coverContent: {
    padding: 50,
    paddingTop: 60,
    height: '100%',
  },
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 80,
  },
  coverLogoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverLogoText: {
    marginLeft: 12,
  },
  coverBrandName: {
    fontSize: 22,
    color: colors.white,
    fontWeight: 'bold',
  },
  coverBrandSubtitle: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  coverBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  coverBadgeText: {
    fontSize: 8,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  coverTitleSection: {
    marginTop: 20,
  },
  coverTitle: {
    fontSize: 42,
    color: colors.white,
    fontWeight: 'bold',
    marginBottom: 12,
    lineHeight: 1.1,
  },
  coverSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 30,
  },
  coverMetaBadges: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 15,
  },
  coverMetaBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
  },
  coverMetaBadgeText: {
    fontSize: 10,
    color: colors.white,
  },
  coverDecoLine: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    right: 50,
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },

  // Executive Summary Page
  page: {
    padding: 40,
    paddingTop: 35,
    paddingBottom: 60,
    backgroundColor: colors.white,
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  pageHeader: {
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
  },
  pageHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  pageLogo: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
  },
  pageDate: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Hero Metrics Cards
  heroMetricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25,
  },
  heroMetricCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroMetricCardHighlight: {
    flex: 1,
    backgroundColor: colors.accentLight,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
  },
  heroMetricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  heroMetricValueGreen: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 4,
  },
  heroMetricLabel: {
    fontSize: 8,
    color: colors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section Styles
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    backgroundColor: colors.background,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  sectionTitleAlt: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Two column layout
  twoColumn: {
    flexDirection: 'row',
    gap: 25,
  },
  column: {
    flex: 1,
  },

  // Data Rows
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowAlt: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowHighlight: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.accentLight,
    borderRadius: 4,
    marginTop: 4,
  },
  rowLabel: {
    flex: 3,
    fontSize: 10,
    color: colors.textSecondary,
  },
  rowValue: {
    flex: 2,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
    color: colors.text,
  },
  rowValueGreen: {
    flex: 2,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
    color: colors.success,
  },

  // Cards
  card: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Insights Box
  insightsBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginTop: 15,
  },
  insightsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
  },
  insightItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  insightBullet: {
    fontSize: 10,
    color: colors.success,
    fontWeight: 'bold',
  },
  insightText: {
    fontSize: 9,
    color: colors.textSecondary,
    flex: 1,
  },

  // Charts section
  chartsSection: {
    flexDirection: 'row',
    gap: 25,
    marginBottom: 20,
  },
  chartBox: {
    flex: 1,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Table Styles
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    color: colors.white,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableHeaderCellFirst: {
    flex: 2,
    fontSize: 9,
    color: colors.white,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center',
    color: colors.text,
  },
  tableCellFirst: {
    flex: 2,
    fontSize: 9,
    textAlign: 'left',
    color: colors.textSecondary,
  },

  // Recommendations
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 12,
  },
  recommendationNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationNumberText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: 'bold',
  },
  recommendationContent: {
    flex: 1,
  },
  recommendationTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 9,
    color: colors.textSecondary,
    lineHeight: 1.4,
  },

  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  pageFooterText: {
    fontSize: 8,
    color: colors.textMuted,
  },
  pageNumber: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },

  // Disclaimer
  disclaimer: {
    fontSize: 8,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Headline Metric (Environmental page)
  headlineMetric: {
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    padding: 25,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  headlineValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 6,
  },
  headlineLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Sources section
  sourceItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    paddingVertical: 4,
  },
  sourceBullet: {
    fontSize: 8,
    color: colors.primary,
  },
  sourceText: {
    fontSize: 9,
    color: colors.textSecondary,
    flex: 1,
  },

  // Narrative text
  narrativeText: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 1.5,
    marginBottom: 15,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
});

// ==================== LOGO COMPONENT ====================
const Logo = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40">
    <Circle cx={20} cy={20} r={18} fill="rgba(255,255,255,0.15)" />
    <Path d="M12 30 L20 10 L28 30 L20 23 Z" fill="white" />
    <Circle cx={20} cy={17} r={4} fill="rgba(255,255,255,0.85)" />
  </Svg>
);

// Small logo for page headers
const SmallLogo = () => (
  <Svg width={24} height={24} viewBox="0 0 40 40">
    <Circle cx={20} cy={20} r={18} fill={colors.primary} />
    <Path d="M12 30 L20 10 L28 30 L20 23 Z" fill="white" />
    <Circle cx={20} cy={17} r={4} fill="rgba(255,255,255,0.85)" />
  </Svg>
);

// ==================== TYPES ====================
export interface AnalyticsPDFTranslations {
  platformSubtitle: string;
  reportTitle: string;
  portfolioOverview: string;
  projectOverview: string;
  basedOn: string;
  scenarios: string;
  projects: string;
  financialBreakdown: string;
  subsidyAnalysis: string;
  dataSources: string;
  fleetComposition: string;
  environmentalImpact: string;
  zevRate: string;
  tcoTotal: string;
  tcoSavings: string;
  co2Reduction: string;
  vehicles: string;
  paybackPeriod: string;
  years: string;
  capex: string;
  opex: string;
  npv: string;
  tcoPerKm: string;
  totalSubsidies: string;
  riskLevel: string;
  tcoDependency: string;
  bev: string;
  fcev: string;
  diesel: string;
  disclaimer: string;
  low: string;
  medium: string;
  high: string;
  critical: string;
  investmentBreakdown: string;
  fleetMix: string;
  reportGeneratedBy: string;
  vsBaseline: string;
  tonnes: string;
}

export interface AnalyticsKPIs {
  totalProjects: number;
  activeScenarios: number;
  totalVehicles: number;
  co2Reduction: number;
  co2ReductionPercent: number;
  totalTcoSum: number;
  totalTcoSavings: number;
  avgPaybackYears: number;
  bevCount: number;
  fcevCount: number;
  dieselCount: number;
  sourceScenarioCount: number;
  sourceScenarioNames: string[];
  tcoPerKm: number;
  totalFleetKm: number;
  subsidyRiskPercent: number;
  totalSubsidies: number;
  subsidyRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalCapex: number;
  totalOpex: number;
  totalNpv: number;
  aggregationMode: 'scenario' | 'project' | 'portfolio';
  aggregationLabel: string;
}

interface AnalyticsReportPDFProps {
  kpis: AnalyticsKPIs;
  translations: AnalyticsPDFTranslations;
  locale?: string;
  mode: 'portfolio' | 'project' | 'scenario';
  projectName?: string;
  scenarioName?: string;
  generatedBy?: string;
}

// ==================== HELPERS ====================
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number, decimals: number = 0): string {
  return value.toLocaleString('en-CA', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
}

// Risk Badge Component
const RiskBadge = ({ level, translations }: { level: string; translations: AnalyticsPDFTranslations }) => {
  const config: Record<string, { bg: string; text: string }> = {
    low: { bg: '#dcfce7', text: '#16a34a' },
    medium: { bg: '#fef3c7', text: '#d97706' },
    high: { bg: '#fed7aa', text: '#ea580c' },
    critical: { bg: '#fee2e2', text: '#dc2626' },
  };
  const labels: Record<string, string> = {
    low: translations.low,
    medium: translations.medium,
    high: translations.high,
    critical: translations.critical,
  };
  const style = config[level] || config.low;
  
  return (
    <View style={{ backgroundColor: style.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 9, color: style.text, fontWeight: 'bold' }}>{labels[level] || level}</Text>
    </View>
  );
};

// ==================== MAIN COMPONENT ====================
export const AnalyticsReportPDF = ({ 
  kpis, 
  translations: t, 
  locale = 'en-CA',
  mode,
  projectName,
  scenarioName,
  generatedBy 
}: AnalyticsReportPDFProps) => {
  const totalVehicles = kpis.totalVehicles || 0;
  const zevRate = totalVehicles > 0 
    ? ((kpis.bevCount + kpis.fcevCount) / totalVehicles * 100).toFixed(0)
    : '0';

  // Chart data
  const fleetChartData = [
    { label: t.diesel, value: kpis.dieselCount, color: colors.diesel },
    { label: t.bev, value: kpis.bevCount, color: colors.ev },
    { label: t.fcev, value: kpis.fcevCount, color: colors.hydrogen }
  ].filter(d => d.value > 0);

  const investmentData = [
    { label: t.capex, value: kpis.totalCapex, color: colors.primary },
    { label: t.opex, value: kpis.totalOpex, color: '#0ea5e9' },
    { label: t.totalSubsidies, value: kpis.totalSubsidies, color: colors.accent }
  ].filter(d => d.value > 0);

  // Report context
  const getSubtitle = () => {
    if (mode === 'scenario' && scenarioName) return scenarioName;
    if (mode === 'project' && projectName) return projectName;
    return t.portfolioOverview;
  };

  const contextSummary = mode === 'portfolio' 
    ? `${t.basedOn} ${kpis.sourceScenarioCount} ${t.scenarios} | ${kpis.totalProjects} ${t.projects}`
    : mode === 'project'
    ? `${t.basedOn} ${kpis.sourceScenarioCount} ${t.scenarios}`
    : scenarioName || '';

  const dateStr = new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Document>
      {/* ==================== PAGE 1: COVER PAGE ==================== */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverContent}>
          {/* Header with logo and badge */}
          <View style={styles.coverHeader}>
            <View style={styles.coverLogoSection}>
              <Logo />
              <View style={styles.coverLogoText}>
                <Text style={styles.coverBrandName}>{PDF_BRAND.name}</Text>
                <Text style={styles.coverBrandSubtitle}>{t.platformSubtitle}</Text>
              </View>
            </View>
            <View style={styles.coverBadge}>
              <Text style={styles.coverBadgeText}>
                {mode === 'portfolio' ? 'Portfolio Analytics' : mode === 'project' ? 'Project Analytics' : 'Scenario Analytics'}
              </Text>
            </View>
          </View>

          {/* Main Title */}
          <View style={styles.coverTitleSection}>
            <Text style={styles.coverTitle}>{t.reportTitle}</Text>
            <Text style={styles.coverSubtitle}>{getSubtitle()}</Text>
            
            {/* Meta badges */}
            <View style={styles.coverMetaBadges}>
              <View style={styles.coverMetaBadge}>
                <Text style={styles.coverMetaBadgeText}>{dateStr}</Text>
              </View>
              {generatedBy && (
                <View style={styles.coverMetaBadge}>
                  <Text style={styles.coverMetaBadgeText}>{generatedBy}</Text>
                </View>
              )}
              <View style={styles.coverMetaBadge}>
                <Text style={styles.coverMetaBadgeText}>{contextSummary}</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Decorative line */}
        <View style={styles.coverDecoLine} />
      </Page>

      {/* ==================== PAGE 2: EXECUTIVE SUMMARY ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>Résumé Exécutif</Text>
              <Text style={styles.pageSubtitle}>{getSubtitle()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Hero Metrics */}
        <View style={styles.heroMetricsRow}>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>{formatCurrency(kpis.totalTcoSum)}</Text>
            <Text style={styles.heroMetricLabel}>{t.tcoTotal}</Text>
          </View>
          <View style={kpis.totalTcoSavings > 0 ? styles.heroMetricCardHighlight : styles.heroMetricCard}>
            <Text style={kpis.totalTcoSavings > 0 ? styles.heroMetricValueGreen : styles.heroMetricValue}>
              {kpis.totalTcoSavings >= 0 ? '+' : ''}{formatCurrency(kpis.totalTcoSavings)}
            </Text>
            <Text style={styles.heroMetricLabel}>{t.tcoSavings}</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>{formatNumber(kpis.co2Reduction)}</Text>
            <Text style={styles.heroMetricLabel}>{t.co2Reduction} (T)</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>{kpis.avgPaybackYears > 0 ? `${kpis.avgPaybackYears.toFixed(1)}` : 'N/A'}</Text>
            <Text style={styles.heroMetricLabel}>{t.paybackPeriod} ({t.years})</Text>
          </View>
        </View>

        {/* Fleet Mix Donut + Key Insights */}
        <View style={styles.chartsSection}>
          <View style={styles.chartBox}>
            <Text style={styles.chartTitle}>{t.fleetMix}</Text>
            {fleetChartData.length > 0 ? (
              <PDFDonutChart 
                data={fleetChartData} 
                size={120}
                centerValue={totalVehicles.toString()}
                centerLabel={t.vehicles}
                showPercentages
              />
            ) : (
              <Text style={{ fontSize: 9, color: colors.textMuted }}>No data</Text>
            )}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>Insights Clés</Text>
            <View style={styles.insightsBox}>
              {kpis.co2ReductionPercent > 0 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    Réduction CO₂ de {kpis.co2ReductionPercent.toFixed(0)}% vs référence diesel
                  </Text>
                </View>
              )}
              {Number(zevRate) >= 50 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    Taux ZEV de {zevRate}% atteint
                  </Text>
                </View>
              )}
              {kpis.avgPaybackYears > 0 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    Période de retour sur investissement: {kpis.avgPaybackYears.toFixed(1)} ans
                  </Text>
                </View>
              )}
              {kpis.totalSubsidies > 0 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    {formatCurrency(kpis.totalSubsidies)} de subventions identifiées
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Narrative Text */}
        <View style={styles.narrativeText}>
          <Text>
            Cette analyse démontre qu'une stratégie {kpis.bevCount > 0 && kpis.fcevCount > 0 ? 'mixte BEV/FCEV' : kpis.bevCount > 0 ? 'électrique (BEV)' : 'hydrogène (FCEV)'} 
            {' '}offre un équilibre optimal entre coût et impact environnemental
            {kpis.avgPaybackYears > 0 ? `, avec un retour d'investissement estimé à ${kpis.avgPaybackYears.toFixed(1)} ans` : ''}.
          </Text>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t.disclaimer}</Text>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footerAnalytics}</Text>
          <Text style={styles.pageNumber}>Page 1/4</Text>
        </View>
      </Page>

      {/* ==================== PAGE 3: FINANCIAL ANALYSIS ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>Analyse Financière</Text>
              <Text style={styles.pageSubtitle}>{getSubtitle()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Investment Breakdown Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ventilation des Investissements</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCellFirst}>Catégorie</Text>
              <Text style={styles.tableHeaderCell}>Montant</Text>
              <Text style={styles.tableHeaderCell}>% du Total</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellFirst}>{t.capex} (Véhicules + Infrastructure)</Text>
              <Text style={styles.tableCell}>{formatCurrency(kpis.totalCapex)}</Text>
              <Text style={styles.tableCell}>{kpis.totalTcoSum > 0 ? ((kpis.totalCapex / kpis.totalTcoSum) * 100).toFixed(0) : 0}%</Text>
            </View>
            <View style={styles.tableRowAlt}>
              <Text style={styles.tableCellFirst}>{t.opex} (10 ans)</Text>
              <Text style={styles.tableCell}>{formatCurrency(kpis.totalOpex)}</Text>
              <Text style={styles.tableCell}>{kpis.totalTcoSum > 0 ? ((kpis.totalOpex / kpis.totalTcoSum) * 100).toFixed(0) : 0}%</Text>
            </View>
            {kpis.totalSubsidies > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.tableCellFirst}>Subventions (réduction)</Text>
                <Text style={{ ...styles.tableCell, color: colors.success }}>-{formatCurrency(kpis.totalSubsidies)}</Text>
                <Text style={styles.tableCell}>-{kpis.totalTcoSum > 0 ? ((kpis.totalSubsidies / kpis.totalTcoSum) * 100).toFixed(0) : 0}%</Text>
              </View>
            )}
            <View style={{ ...styles.tableRowAlt, backgroundColor: colors.primary }}>
              <Text style={{ ...styles.tableCellFirst, color: colors.white, fontWeight: 'bold' }}>{t.tcoTotal}</Text>
              <Text style={{ ...styles.tableCell, color: colors.white, fontWeight: 'bold' }}>{formatCurrency(kpis.totalTcoSum)}</Text>
              <Text style={{ ...styles.tableCell, color: colors.white, fontWeight: 'bold' }}>100%</Text>
            </View>
          </View>
        </View>

        {/* Investment Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.investmentBreakdown}</Text>
          {investmentData.length > 0 && (
            <PDFBarChart 
              data={investmentData} 
              width={480} 
              height={120}
              formatValue={formatCurrency}
            />
          )}
        </View>

        {/* Financial Metrics Grid */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Text style={styles.sectionTitleAlt}>Métriques Financières</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.tcoPerKm}</Text>
              <Text style={styles.rowValue}>${kpis.tcoPerKm > 0 ? kpis.tcoPerKm.toFixed(3) : '0.00'}/km</Text>
            </View>
            <View style={styles.rowAlt}>
              <Text style={styles.rowLabel}>{t.npv}</Text>
              <Text style={styles.rowValue}>{formatCurrency(kpis.totalNpv)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.paybackPeriod}</Text>
              <Text style={styles.rowValue}>{kpis.avgPaybackYears > 0 ? `${kpis.avgPaybackYears.toFixed(1)} ${t.years}` : 'N/A'}</Text>
            </View>
          </View>

          {kpis.totalSubsidies > 0 && (
            <View style={styles.column}>
              <Text style={styles.sectionTitleAlt}>{t.subsidyAnalysis}</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.totalSubsidies}</Text>
                <Text style={styles.rowValue}>{formatCurrency(kpis.totalSubsidies)}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>{t.riskLevel}</Text>
                <View style={{ flex: 2, alignItems: 'flex-end' }}>
                  <RiskBadge level={kpis.subsidyRiskLevel} translations={t} />
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.tcoDependency}</Text>
                <Text style={styles.rowValue}>{kpis.subsidyRiskPercent.toFixed(1)}%</Text>
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footerAnalytics}</Text>
          <Text style={styles.pageNumber}>Page 2/4</Text>
        </View>
      </Page>

      {/* ==================== PAGE 4: FLEET & ENVIRONMENT ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>Flotte & Environnement</Text>
              <Text style={styles.pageSubtitle}>{getSubtitle()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Headline Environmental Metric */}
        <View style={styles.headlineMetric}>
          <Text style={styles.headlineValue}>{kpis.co2ReductionPercent.toFixed(0)}%</Text>
          <Text style={styles.headlineLabel}>Réduction CO₂ | {formatNumber(kpis.co2Reduction)} tonnes évitées vs référence diesel</Text>
        </View>

        {/* Fleet Composition */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{t.fleetComposition}</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Véhicules</Text>
                <Text style={styles.rowValue}>{totalVehicles}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>{t.bev}</Text>
                <Text style={styles.rowValue}>{kpis.bevCount} ({totalVehicles > 0 ? ((kpis.bevCount / totalVehicles) * 100).toFixed(0) : 0}%)</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.fcev}</Text>
                <Text style={styles.rowValue}>{kpis.fcevCount} ({totalVehicles > 0 ? ((kpis.fcevCount / totalVehicles) * 100).toFixed(0) : 0}%)</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>{t.diesel}</Text>
                <Text style={styles.rowValue}>{kpis.dieselCount} ({totalVehicles > 0 ? ((kpis.dieselCount / totalVehicles) * 100).toFixed(0) : 0}%)</Text>
              </View>
              <View style={styles.rowHighlight}>
                <Text style={styles.rowLabel}>{t.zevRate}</Text>
                <Text style={styles.rowValueGreen}>{zevRate}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{t.environmentalImpact}</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Réduction CO₂ Annuelle</Text>
                <Text style={styles.rowValue}>{formatNumber(kpis.co2Reduction / 5)} T</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>Réduction CO₂ Totale (5 ans)</Text>
                <Text style={styles.rowValue}>{formatNumber(kpis.co2Reduction)} T</Text>
              </View>
              <View style={styles.rowHighlight}>
                <Text style={styles.rowLabel}>{t.vsBaseline}</Text>
                <Text style={styles.rowValueGreen}>-{kpis.co2ReductionPercent.toFixed(1)}%</Text>
              </View>
            </View>

            {/* Fleet description */}
            <View style={{ marginTop: 12, padding: 10, backgroundColor: colors.background, borderRadius: 6 }}>
              <Text style={{ fontSize: 8, color: colors.textSecondary, lineHeight: 1.4 }}>
                Le mix {kpis.bevCount > 0 && kpis.fcevCount > 0 ? 'BEV/FCEV optimisé offre les avantages de chaque technologie: BEV pour les coûts opérationnels minimaux, FCEV pour l\'autonomie accrue et le ravitaillement rapide' : kpis.bevCount > 0 ? 'électrique (BEV) offre des coûts opérationnels minimaux et une recharge flexible' : 'hydrogène (FCEV) offre une autonomie accrue et un ravitaillement rapide'}.
              </Text>
            </View>
          </View>
        </View>

        {/* Data Sources */}
        <View style={{ ...styles.section, marginTop: 25 }}>
          <Text style={styles.sectionTitle}>{t.dataSources}</Text>
          <View style={styles.card}>
            {kpis.sourceScenarioNames.length > 0 ? (
              kpis.sourceScenarioNames.slice(0, 6).map((name, index) => (
                <View key={index} style={styles.sourceItem}>
                  <Text style={styles.sourceBullet}>•</Text>
                  <Text style={styles.sourceText}>{name}</Text>
                </View>
              ))
            ) : (
              <Text style={{ fontSize: 9, color: colors.textMuted }}>Aucun scénario disponible</Text>
            )}
            {kpis.sourceScenarioNames.length > 6 && (
              <Text style={{ fontSize: 8, color: colors.textMuted, marginTop: 5 }}>
                + {kpis.sourceScenarioNames.length - 6} autres scénarios
              </Text>
            )}
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t.disclaimer}</Text>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footerAnalytics}</Text>
          <Text style={styles.pageNumber}>Page 3/4</Text>
        </View>
      </Page>

      {/* ==================== PAGE 5: RECOMMENDATIONS ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>Recommandations Stratégiques</Text>
              <Text style={styles.pageSubtitle}>{getSubtitle()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <View style={styles.recommendationItem}>
            <View style={styles.recommendationNumber}>
              <Text style={styles.recommendationNumberText}>1</Text>
            </View>
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationTitle}>
                {kpis.bevCount > 0 && kpis.fcevCount > 0 
                  ? 'DÉPLOYER LA STRATÉGIE BEV/FCEV MIXTE'
                  : kpis.bevCount > 0 
                    ? 'DÉPLOYER LA STRATÉGIE 100% ÉLECTRIQUE'
                    : 'DÉPLOYER LA STRATÉGIE HYDROGÈNE'}
              </Text>
              <Text style={styles.recommendationDescription}>
                {kpis.bevCount > 0 && kpis.fcevCount > 0 
                  ? `Commencer avec ${((kpis.bevCount / totalVehicles) * 100).toFixed(0)}% BEV et ${((kpis.fcevCount / totalVehicles) * 100).toFixed(0)}% FCEV. Ajuster selon les résultats opérationnels et les évolutions technologiques.`
                  : kpis.bevCount > 0
                    ? 'Déployer une flotte 100% électrique pour maximiser les économies opérationnelles et minimiser l\'empreinte carbone.'
                    : 'Déployer une flotte hydrogène pour les applications nécessitant une grande autonomie et un ravitaillement rapide.'}
              </Text>
            </View>
          </View>

          {kpis.totalSubsidies > 0 && (
            <View style={styles.recommendationItem}>
              <View style={styles.recommendationNumber}>
                <Text style={styles.recommendationNumberText}>2</Text>
              </View>
              <View style={styles.recommendationContent}>
                <Text style={styles.recommendationTitle}>SÉCURISER LES SUBVENTIONS DISPONIBLES</Text>
                <Text style={styles.recommendationDescription}>
                  {formatCurrency(kpis.totalSubsidies)} d'opportunités de subventions identifiées. 
                  Prioriser les demandes selon les délais et critères d'éligibilité.
                  {kpis.subsidyRiskLevel === 'high' || kpis.subsidyRiskLevel === 'critical' 
                    ? ' ATTENTION: Dépendance élevée aux subventions - prévoir des alternatives budgétaires.'
                    : ''}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.recommendationItem}>
            <View style={styles.recommendationNumber}>
              <Text style={styles.recommendationNumberText}>{kpis.totalSubsidies > 0 ? '3' : '2'}</Text>
            </View>
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationTitle}>PLANIFIER L'INFRASTRUCTURE</Text>
              <Text style={styles.recommendationDescription}>
                {kpis.bevCount > 0 && 'Installer les bornes de recharge nécessaires pour la flotte BEV. '}
                {kpis.fcevCount > 0 && 'Sécuriser l\'approvisionnement en hydrogène et les stations de ravitaillement. '}
                Considérer les phases de déploiement progressif pour optimiser les investissements.
              </Text>
            </View>
          </View>

          <View style={styles.recommendationItem}>
            <View style={styles.recommendationNumber}>
              <Text style={styles.recommendationNumberText}>{kpis.totalSubsidies > 0 ? '4' : '3'}</Text>
            </View>
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationTitle}>MONITORER ET OPTIMISER</Text>
              <Text style={styles.recommendationDescription}>
                Suivre les KPIs de performance (TCO/km, disponibilité, émissions) et ajuster la stratégie. 
                Utiliser les données télémétriques pour optimiser les opérations et anticiper les besoins de maintenance.
              </Text>
            </View>
          </View>
        </View>

        {/* Methodology Notes */}
        <View style={{ ...styles.section, marginTop: 30 }}>
          <Text style={styles.sectionTitle}>Notes Méthodologiques</Text>
          <View style={styles.card}>
            <View style={styles.sourceItem}>
              <Text style={styles.sourceBullet}>•</Text>
              <Text style={styles.sourceText}>Les estimations TCO incluent: achat véhicules, énergie, maintenance, assurance</Text>
            </View>
            <View style={styles.sourceItem}>
              <Text style={styles.sourceBullet}>•</Text>
              <Text style={styles.sourceText}>Durée d'analyse: 10 ans | Taux d'actualisation: 5%</Text>
            </View>
            <View style={styles.sourceItem}>
              <Text style={styles.sourceBullet}>•</Text>
              <Text style={styles.sourceText}>Sources: Données internes H2Fleet, prix marché canadien, programmes de subventions fédéraux/provinciaux</Text>
            </View>
          </View>
        </View>

        {/* Important Disclaimer */}
        <View style={{ marginTop: 20, padding: 15, backgroundColor: '#fef3c7', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: colors.warning }}>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#92400e', marginBottom: 4 }}>AVERTISSEMENT IMPORTANT</Text>
          <Text style={{ fontSize: 8, color: '#92400e', lineHeight: 1.4 }}>
            Les estimations TCO sont à des fins de planification uniquement. Les coûts réels peuvent varier selon les conditions locales, les prix d'énergie futurs, et les politiques de subventions. Pour toute décision financière critique, consulter un expert indépendant.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footerAnalytics}</Text>
          <Text style={styles.pageNumber}>Page 4/4</Text>
        </View>
      </Page>
    </Document>
  );
};

export default AnalyticsReportPDF;

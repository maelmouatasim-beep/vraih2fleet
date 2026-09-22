import { Document, Page, Text, View, Svg, Circle, Path } from '@react-pdf/renderer';
import { StyleSheet } from '@react-pdf/renderer';
import { TCOResult } from '@/lib/calculations/types';
import { PDFBarChart, PDFDonutChart, PDFAreaChart } from './charts';

// ==================== CONSTANTS ====================
export const PDF_BRAND = {
  name: 'H2Fleet Planner',
  subtitle: 'Fleet TCO Analysis Platform',
  shortName: 'H2Fleet',
  footer: 'H2Fleet Planner - TCO Analysis Report',
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

  // Page styles
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

  // Insights Box
  insightsBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginTop: 10,
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
  tableRowTotal: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
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
  tableCellTotal: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center',
    color: colors.white,
    fontWeight: 'bold',
  },
  tableCellTotalFirst: {
    flex: 2,
    fontSize: 9,
    textAlign: 'left',
    color: colors.white,
    fontWeight: 'bold',
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
});

// ==================== LOGO COMPONENT ====================
const Logo = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40">
    <Circle cx={20} cy={20} r={18} fill="rgba(255,255,255,0.15)" />
    <Path d="M12 30 L20 10 L28 30 L20 23 Z" fill="white" />
    <Circle cx={20} cy={17} r={4} fill="rgba(255,255,255,0.85)" />
  </Svg>
);

// ==================== TYPES ====================
export interface PDFTranslations {
  platformSubtitle: string;
  reportTitle: string;
  scenario: string;
  region: string;
  analysisHorizon: string;
  years: string;
  reportDate: string;
  generatedBy: string;
  tcoTotal: string;
  co2Reduction: string;
  vehicles: string;
  fleetComposition: string;
  costBreakdown: string;
  disclaimer: string;
  analysisDetails: string;
  executiveSummary: string;
  costPerKm: string;
  npv: string;
  co2ReductionVsDiesel: string;
  paybackPeriod: string;
  totalVehicles: string;
  diesel: string;
  electricBev: string;
  hydrogenFcev: string;
  annualKm: string;
  initialCapex: string;
  totalOpex: string;
  residualValue: string;
  netTco: string;
  chargingInfrastructure: string;
  evChargers: string;
  evChargersCost: string;
  h2Stations: string;
  h2StationsCost: string;
  totalInfraCost: string;
  environmentalImpact: string;
  totalCo2Emissions: string;
  tonnes: string;
  avoidedEmissions: string;
  emissionsReduction: string;
  assumptionsAndParams: string;
  discountRate: string;
  baselineTco: string;
  tcoSavingsVsBaseline: string;
  reportGeneratedBy: string;
  bevConsumption: string;
  h2Consumption: string;
  dieselConsumption: string;
}

interface FleetComposition {
  diesel?: { count: number; annualKm?: number };
  ev?: { count: number; annualKm?: number };
  hydrogen?: { count: number; annualKm?: number };
  [key: string]: { count: number; annualKm?: number } | undefined;
}

interface Scenario {
  id: string;
  name: string;
  region: string;
  analysis_years?: number;
  analysisYears?: number;
  fleet_composition?: FleetComposition;
  fleetComposition?: FleetComposition;
  discount_rate?: number;
  discountRate?: number;
  description?: string;
}

interface TCOReportPDFProps {
  scenario: Scenario;
  results: TCOResult;
  generatedBy?: string;
  translations: PDFTranslations;
  locale?: string;
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

// Verdict Badge Component
const VerdictBadge = ({ type, isEnglish }: { type: 'recommended' | 'optimize' | 'notViable'; isEnglish: boolean }) => {
  const config = {
    recommended: { bg: '#dcfce7', text: '#16a34a', icon: '✓', labelEn: 'Recommended', labelFr: 'Recommandé' },
    optimize: { bg: '#fef3c7', text: '#d97706', icon: '⚡', labelEn: 'To Optimize', labelFr: 'À optimiser' },
    notViable: { bg: '#fee2e2', text: '#dc2626', icon: '✗', labelEn: 'Not Viable', labelFr: 'Non viable' },
  };
  const style = config[type];
  
  return (
    <View style={{ backgroundColor: style.bg, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 14, color: style.text }}>{style.icon}</Text>
      <Text style={{ fontSize: 11, color: style.text, fontWeight: 'bold' }}>{isEnglish ? style.labelEn : style.labelFr}</Text>
    </View>
  );
};

// ==================== MAIN COMPONENT ====================
export const TCOReportPDF = ({ scenario, results, generatedBy, translations: t, locale = 'en-CA' }: TCOReportPDFProps) => {
  const isEnglish = locale.startsWith('en');
  const analysisYears = scenario.analysis_years || scenario.analysisYears || 10;
  const fleetComposition = scenario.fleet_composition || scenario.fleetComposition || {};
  const discountRate = scenario.discount_rate || scenario.discountRate || 0.05;
  
  const dieselCount = fleetComposition.diesel?.count || 0;
  const evCount = fleetComposition.ev?.count || 0;
  const h2Count = fleetComposition.hydrogen?.count || 0;
  const totalVehicles = dieselCount + evCount + h2Count;

  const dieselKm = fleetComposition.diesel?.annualKm || 0;
  const evKm = fleetComposition.ev?.annualKm || 0;
  const h2Km = fleetComposition.hydrogen?.annualKm || 0;
  const totalFleetKm = (dieselCount * dieselKm) + (evCount * evKm) + (h2Count * h2Km);

  // Calculate ZEV rate
  const zevRate = totalVehicles > 0 ? ((evCount + h2Count) / totalVehicles * 100).toFixed(0) : '0';

  // Determine verdict (only recommended or optimize - notViable removed)
  const getVerdict = (): 'recommended' | 'optimize' => {
    const savings = results.tcoSavings || 0;
    const payback = results.paybackPeriodYears || 999;
    if (savings > 0 && payback <= 7) return 'recommended';
    return 'optimize';
  };
  const verdict = getVerdict();

  // Prepare chart data
  const fleetChartData = [
    { label: 'Diesel', value: dieselCount, color: colors.diesel },
    { label: 'BEV', value: evCount, color: colors.ev },
    { label: 'H₂', value: h2Count, color: colors.hydrogen }
  ].filter(d => d.value > 0);

  const costChartData = [
    { label: 'CAPEX', value: results.capex, color: colors.primary },
    { label: 'OPEX', value: results.opexTotal, color: '#0ea5e9' },
    { label: 'Infra', value: results.totalInfrastructureCost || 0, color: colors.accent }
  ].filter(d => d.value > 0);

  // Prepare cumulative cost data for area chart
  const cumulativeData = results.yearlyBreakdown?.map((year: any, index: number) => ({
    year: index + 1,
    value: year.cumulativeTco || 0,
  })) || [];

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
              <Text style={styles.coverBadgeText}>TCO Analysis</Text>
            </View>
          </View>

          {/* Main Title */}
          <View style={styles.coverTitleSection}>
            <Text style={styles.coverTitle}>{t.reportTitle}</Text>
            <Text style={styles.coverSubtitle}>{scenario.name}</Text>
            
            {/* Verdict Badge */}
            <View style={{ marginTop: 20, marginBottom: 20 }}>
              <VerdictBadge type={verdict} isEnglish={isEnglish} />
            </View>
            
            {/* Meta badges */}
            <View style={styles.coverMetaBadges}>
              <View style={styles.coverMetaBadge}>
                <Text style={styles.coverMetaBadgeText}>{dateStr}</Text>
              </View>
              <View style={styles.coverMetaBadge}>
                <Text style={styles.coverMetaBadgeText}>{scenario.region}</Text>
              </View>
              <View style={styles.coverMetaBadge}>
                <Text style={styles.coverMetaBadgeText}>{analysisYears} {t.years}</Text>
              </View>
              {generatedBy && (
                <View style={styles.coverMetaBadge}>
                  <Text style={styles.coverMetaBadgeText}>{generatedBy}</Text>
                </View>
              )}
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
              <Text style={styles.pageTitle}>{isEnglish ? 'Executive Summary' : 'Résumé Exécutif'}</Text>
              <Text style={styles.pageSubtitle}>{scenario.name}</Text>
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
            <Text style={styles.heroMetricValue}>{formatCurrency(results.tcoTotal)}</Text>
            <Text style={styles.heroMetricLabel}>{t.tcoTotal}</Text>
          </View>
          <View style={(results.tcoSavings || 0) > 0 ? styles.heroMetricCardHighlight : styles.heroMetricCard}>
            <Text style={(results.tcoSavings || 0) > 0 ? styles.heroMetricValueGreen : styles.heroMetricValue}>
              {(results.tcoSavings || 0) >= 0 ? '+' : ''}{formatCurrency(results.tcoSavings || 0)}
            </Text>
            <Text style={styles.heroMetricLabel}>{isEnglish ? 'TCO Savings' : 'Économies TCO'}</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>{formatNumber(results.co2Savings || 0)}</Text>
            <Text style={styles.heroMetricLabel}>{t.co2Reduction} (T)</Text>
          </View>
          <View style={styles.heroMetricCard}>
            <Text style={styles.heroMetricValue}>
              {results.paybackPeriodYears ? `${results.paybackPeriodYears.toFixed(1)}` : 'N/A'}
            </Text>
            <Text style={styles.heroMetricLabel}>{t.paybackPeriod} ({t.years})</Text>
          </View>
        </View>

        {/* Fleet Mix Donut + Key Insights */}
        <View style={styles.chartsSection}>
          <View style={styles.chartBox}>
            <Text style={styles.chartTitle}>{t.fleetComposition}</Text>
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
            <Text style={styles.chartTitle}>{isEnglish ? 'Key Insights' : 'Insights Clés'}</Text>
            <View style={styles.insightsBox}>
              {(results.co2SavingsPercent || 0) > 0 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    {isEnglish 
                      ? `${(results.co2SavingsPercent || 0).toFixed(0)}% CO₂ reduction vs diesel baseline`
                      : `Réduction CO₂ de ${(results.co2SavingsPercent || 0).toFixed(0)}% vs référence diesel`
                    }
                  </Text>
                </View>
              )}
              {Number(zevRate) >= 50 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    {isEnglish ? `ZEV rate of ${zevRate}% achieved` : `Taux ZEV de ${zevRate}% atteint`}
                  </Text>
                </View>
              )}
              {results.paybackPeriodYears && results.paybackPeriodYears > 0 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    {isEnglish 
                      ? `Payback period: ${results.paybackPeriodYears.toFixed(1)} years`
                      : `Période de retour sur investissement: ${results.paybackPeriodYears.toFixed(1)} ans`
                    }
                  </Text>
                </View>
              )}
              {results.npv && results.npv !== 0 && (
                <View style={styles.insightItem}>
                  <Text style={styles.insightBullet}>✓</Text>
                  <Text style={styles.insightText}>
                    {isEnglish 
                      ? `Net Present Value: ${formatCurrency(results.npv)}`
                      : `Valeur actuelle nette: ${formatCurrency(results.npv)}`
                    }
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Narrative Text */}
        <View style={styles.narrativeText}>
          <Text>
            {isEnglish
              ? `This analysis demonstrates that a ${evCount > 0 && h2Count > 0 ? 'mixed BEV/FCEV' : evCount > 0 ? 'electric (BEV)' : 'hydrogen (FCEV)'} strategy offers an optimal balance between cost and environmental impact${results.paybackPeriodYears ? `, with an estimated ROI of ${results.paybackPeriodYears.toFixed(1)} years` : ''}.`
              : `Cette analyse démontre qu'une stratégie ${evCount > 0 && h2Count > 0 ? 'mixte BEV/FCEV' : evCount > 0 ? 'électrique (BEV)' : 'hydrogène (FCEV)'} offre un équilibre optimal entre coût et impact environnemental${results.paybackPeriodYears ? `, avec un retour d'investissement estimé à ${results.paybackPeriodYears.toFixed(1)} ans` : ''}.`
            }
          </Text>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t.disclaimer}</Text>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footer}</Text>
          <Text style={styles.pageNumber}>Page 1/6</Text>
        </View>
      </Page>

      {/* ==================== PAGE 3: FINANCIAL ANALYSIS ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>{isEnglish ? 'Financial Analysis' : 'Analyse Financière'}</Text>
              <Text style={styles.pageSubtitle}>{scenario.name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Investment Breakdown Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'Investment Breakdown' : 'Ventilation des Investissements'}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCellFirst}>{isEnglish ? 'Category' : 'Catégorie'}</Text>
              <Text style={styles.tableHeaderCell}>{isEnglish ? 'Amount' : 'Montant'}</Text>
              <Text style={styles.tableHeaderCell}>% Total</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellFirst}>{t.initialCapex}</Text>
              <Text style={styles.tableCell}>{formatCurrency(results.capex)}</Text>
              <Text style={styles.tableCell}>{results.tcoTotal > 0 ? ((results.capex / results.tcoTotal) * 100).toFixed(0) : 0}%</Text>
            </View>
            <View style={styles.tableRowAlt}>
              <Text style={styles.tableCellFirst}>{t.totalOpex} ({analysisYears} {t.years})</Text>
              <Text style={styles.tableCell}>{formatCurrency(results.opexTotal)}</Text>
              <Text style={styles.tableCell}>{results.tcoTotal > 0 ? ((results.opexTotal / results.tcoTotal) * 100).toFixed(0) : 0}%</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellFirst}>{t.totalInfraCost}</Text>
              <Text style={styles.tableCell}>{formatCurrency(results.totalInfrastructureCost || 0)}</Text>
              <Text style={styles.tableCell}>{results.tcoTotal > 0 ? (((results.totalInfrastructureCost || 0) / results.tcoTotal) * 100).toFixed(0) : 0}%</Text>
            </View>
            <View style={styles.tableRowAlt}>
              <Text style={styles.tableCellFirst}>{t.residualValue}</Text>
              <Text style={{ ...styles.tableCell, color: colors.success }}>-{formatCurrency(results.residualValue || 0)}</Text>
              <Text style={styles.tableCell}>-{results.tcoTotal > 0 ? (((results.residualValue || 0) / results.tcoTotal) * 100).toFixed(0) : 0}%</Text>
            </View>
            <View style={styles.tableRowTotal}>
              <Text style={styles.tableCellTotalFirst}>{t.netTco}</Text>
              <Text style={styles.tableCellTotal}>{formatCurrency(results.tcoTotal)}</Text>
              <Text style={styles.tableCellTotal}>100%</Text>
            </View>
          </View>
        </View>

        {/* Cost Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.costBreakdown}</Text>
          {costChartData.length > 0 && (
            <PDFBarChart 
              data={costChartData} 
              width={480} 
              height={120}
              formatValue={formatCurrency}
            />
          )}
        </View>

        {/* Financial Metrics Grid */}
        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Text style={styles.sectionTitleAlt}>{isEnglish ? 'Financial Metrics' : 'Métriques Financières'}</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.costPerKm}</Text>
              <Text style={styles.rowValue}>${results.tcoPerKm.toFixed(3)}/km</Text>
            </View>
            <View style={styles.rowAlt}>
              <Text style={styles.rowLabel}>{t.npv}</Text>
              <Text style={styles.rowValue}>{formatCurrency(results.npv || 0)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.paybackPeriod}</Text>
              <Text style={styles.rowValue}>{results.paybackPeriodYears ? `${results.paybackPeriodYears.toFixed(1)} ${t.years}` : 'N/A'}</Text>
            </View>
            <View style={styles.rowAlt}>
              <Text style={styles.rowLabel}>{t.discountRate}</Text>
              <Text style={styles.rowValue}>{(discountRate * 100).toFixed(1)}%</Text>
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitleAlt}>{isEnglish ? 'Baseline Comparison' : 'Comparaison Référence'}</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.baselineTco}</Text>
              <Text style={styles.rowValue}>{formatCurrency(results.baselineTco || 0)}</Text>
            </View>
            <View style={styles.rowAlt}>
              <Text style={styles.rowLabel}>{t.tcoSavingsVsBaseline}</Text>
              <Text style={styles.rowValueGreen}>
                {(results.tcoSavings || 0) >= 0 ? '+' : ''}{formatCurrency(results.tcoSavings || 0)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{isEnglish ? 'Savings %' : '% Économies'}</Text>
              <Text style={styles.rowValueGreen}>
                {results.baselineTco && results.baselineTco > 0 
                  ? `${(((results.baselineTco - results.tcoTotal) / results.baselineTco) * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footer}</Text>
          <Text style={styles.pageNumber}>Page 2/6</Text>
        </View>
      </Page>

      {/* ==================== PAGE 4: FLEET COMPOSITION ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>{isEnglish ? 'Fleet Composition' : 'Composition Flotte'}</Text>
              <Text style={styles.pageSubtitle}>{scenario.name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Fleet Mix Chart and Table */}
        <View style={styles.chartsSection}>
          <View style={styles.chartBox}>
            <Text style={styles.chartTitle}>{isEnglish ? 'Fleet Mix' : 'Mix Flotte'}</Text>
            {fleetChartData.length > 0 && (
              <PDFDonutChart 
                data={fleetChartData} 
                size={140}
                centerValue={totalVehicles.toString()}
                centerLabel={t.vehicles}
                showPercentages
              />
            )}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={styles.chartTitle}>{isEnglish ? 'Vehicle Breakdown' : 'Répartition Véhicules'}</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderCellFirst}>{isEnglish ? 'Type' : 'Type'}</Text>
                <Text style={styles.tableHeaderCell}>{isEnglish ? 'Count' : 'Nombre'}</Text>
                <Text style={styles.tableHeaderCell}>%</Text>
                <Text style={styles.tableHeaderCell}>{isEnglish ? 'Annual km' : 'km/an'}</Text>
              </View>
              {dieselCount > 0 && (
                <View style={styles.tableRow}>
                  <Text style={styles.tableCellFirst}>{t.diesel}</Text>
                  <Text style={styles.tableCell}>{dieselCount}</Text>
                  <Text style={styles.tableCell}>{((dieselCount / totalVehicles) * 100).toFixed(0)}%</Text>
                  <Text style={styles.tableCell}>{formatNumber(dieselKm)}</Text>
                </View>
              )}
              {evCount > 0 && (
                <View style={dieselCount > 0 ? styles.tableRowAlt : styles.tableRow}>
                  <Text style={styles.tableCellFirst}>{t.electricBev}</Text>
                  <Text style={styles.tableCell}>{evCount}</Text>
                  <Text style={styles.tableCell}>{((evCount / totalVehicles) * 100).toFixed(0)}%</Text>
                  <Text style={styles.tableCell}>{formatNumber(evKm)}</Text>
                </View>
              )}
              {h2Count > 0 && (
                <View style={(dieselCount > 0 && evCount === 0) || (dieselCount === 0 && evCount > 0) ? styles.tableRowAlt : styles.tableRow}>
                  <Text style={styles.tableCellFirst}>{t.hydrogenFcev}</Text>
                  <Text style={styles.tableCell}>{h2Count}</Text>
                  <Text style={styles.tableCell}>{((h2Count / totalVehicles) * 100).toFixed(0)}%</Text>
                  <Text style={styles.tableCell}>{formatNumber(h2Km)}</Text>
                </View>
              )}
              <View style={styles.tableRowTotal}>
                <Text style={styles.tableCellTotalFirst}>Total</Text>
                <Text style={styles.tableCellTotal}>{totalVehicles}</Text>
                <Text style={styles.tableCellTotal}>100%</Text>
                <Text style={styles.tableCellTotal}>—</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Infrastructure Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.chargingInfrastructure}</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.evChargers}</Text>
                <Text style={styles.rowValue}>{results.chargingStations || 0}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>{t.evChargersCost}</Text>
                <Text style={styles.rowValue}>{formatCurrency(results.chargingStationsCost || 0)}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.h2Stations}</Text>
                <Text style={styles.rowValue}>{results.h2Stations || 0}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>{t.h2StationsCost}</Text>
                <Text style={styles.rowValue}>{formatCurrency(results.h2StationsCost || 0)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.rowHighlight}>
            <Text style={styles.rowLabel}>{t.totalInfraCost}</Text>
            <Text style={styles.rowValue}>{formatCurrency(results.totalInfrastructureCost || 0)}</Text>
          </View>
        </View>

        {/* Fleet Description */}
        <View style={styles.narrativeText}>
          <Text>
            {isEnglish
              ? `The ${evCount > 0 && h2Count > 0 ? 'mixed BEV/FCEV' : evCount > 0 ? 'electric (BEV)' : 'hydrogen (FCEV)'} fleet composition is optimized to provide:\n• BEV: Minimal operating costs, fast charging for short routes\n• FCEV: Extended range, quick refueling for long-haul operations`
              : `Le mix ${evCount > 0 && h2Count > 0 ? 'BEV/FCEV' : evCount > 0 ? 'électrique (BEV)' : 'hydrogène (FCEV)'} optimisé offre les avantages:\n• BEV: Coûts opérationnels minimaux, recharge rapide\n• FCEV: Autonomie accrue, ravitaillement rapide pour longs parcours`
            }
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footer}</Text>
          <Text style={styles.pageNumber}>Page 3/6</Text>
        </View>
      </Page>

      {/* ==================== PAGE 5: ENVIRONMENTAL IMPACT ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>{t.environmentalImpact}</Text>
              <Text style={styles.pageSubtitle}>{scenario.name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Headline Metric */}
        <View style={styles.headlineMetric}>
          <Text style={styles.headlineValue}>{(results.co2SavingsPercent || 0).toFixed(0)}%</Text>
          <Text style={styles.headlineLabel}>
            {isEnglish 
              ? `CO₂ Reduction - ${formatNumber(results.co2Savings || 0)} tonnes avoided vs baseline`
              : `Réduction CO₂ - ${formatNumber(results.co2Savings || 0)} tonnes évitées vs référence`
            }
          </Text>
        </View>

        {/* Environmental Metrics Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'Environmental Metrics' : 'Métriques Environnementales'}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCellFirst}>{isEnglish ? 'Metric' : 'Métrique'}</Text>
              <Text style={styles.tableHeaderCell}>{isEnglish ? 'Value' : 'Valeur'}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellFirst}>{isEnglish ? 'Annual CO₂ Reduction' : 'Réduction CO₂ Annuelle'}</Text>
              <Text style={styles.tableCell}>{formatNumber((results.co2Savings || 0) / analysisYears)} T</Text>
            </View>
            <View style={styles.tableRowAlt}>
              <Text style={styles.tableCellFirst}>{isEnglish ? 'Total CO₂ Reduction' : 'Réduction CO₂ Totale'} ({analysisYears} {t.years})</Text>
              <Text style={styles.tableCell}>{formatNumber(results.co2Savings || 0)} T</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellFirst}>{isEnglish ? 'ZEV Rate' : 'Taux ZEV'}</Text>
              <Text style={styles.tableCell}>{zevRate}%</Text>
            </View>
            <View style={styles.tableRowAlt}>
              <Text style={styles.tableCellFirst}>{isEnglish ? 'Fleet CO₂ Emissions' : 'Émissions CO₂ Flotte'}</Text>
              <Text style={styles.tableCell}>{formatNumber(results.co2Total)} T</Text>
            </View>
          </View>
        </View>

        {/* Environmental Insight */}
        <View style={styles.narrativeText}>
          <Text>
            {isEnglish
              ? `The transition to a ${Number(zevRate)}% zero-emission fleet represents the equivalent of planting approximately ${Math.round((results.co2Savings || 0) / 40)} acres of forest in terms of carbon absorption over the analysis period.`
              : `La transition vers une flotte ${Number(zevRate)}% zéro émission représente l'équivalent de planter environ ${Math.round((results.co2Savings || 0) / 40)} acres de forêt en termes d'absorption de carbone sur la période d'analyse.`
            }
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footer}</Text>
          <Text style={styles.pageNumber}>Page 4/6</Text>
        </View>
      </Page>

      {/* ==================== PAGE 6: RECOMMENDATIONS ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>{isEnglish ? 'Strategic Recommendations' : 'Recommandations Stratégiques'}</Text>
              <Text style={styles.pageSubtitle}>{scenario.name}</Text>
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
                {isEnglish ? 'DEPLOY MIXED BEV/FCEV STRATEGY' : 'DÉPLOYER LA STRATÉGIE MIXTE BEV/FCEV'}
              </Text>
              <Text style={styles.recommendationDescription}>
                {isEnglish
                  ? `Start with ${evCount > 0 ? `${((evCount / totalVehicles) * 100).toFixed(0)}% BEV` : ''}${evCount > 0 && h2Count > 0 ? ', ' : ''}${h2Count > 0 ? `${((h2Count / totalVehicles) * 100).toFixed(0)}% FCEV` : ''} composition. Adjust based on operational results and infrastructure availability.`
                  : `Commencer avec ${evCount > 0 ? `${((evCount / totalVehicles) * 100).toFixed(0)}% BEV` : ''}${evCount > 0 && h2Count > 0 ? ', ' : ''}${h2Count > 0 ? `${((h2Count / totalVehicles) * 100).toFixed(0)}% FCEV` : ''}. Ajuster selon les résultats opérationnels et la disponibilité de l'infrastructure.`
                }
              </Text>
            </View>
          </View>

          <View style={styles.recommendationItem}>
            <View style={styles.recommendationNumber}>
              <Text style={styles.recommendationNumberText}>2</Text>
            </View>
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationTitle}>
                {isEnglish ? 'SECURE AVAILABLE SUBSIDIES' : 'SÉCURISER LES SUBVENTIONS DISPONIBLES'}
              </Text>
              <Text style={styles.recommendationDescription}>
                {isEnglish
                  ? `Identify and apply for federal (iMHZEV, ZETF) and provincial incentive programs. Early application recommended for maximum benefit.`
                  : `Identifier et demander les programmes incitatifs fédéraux (iMHZEV, ZETF) et provinciaux. Candidature anticipée recommandée pour maximiser les bénéfices.`
                }
              </Text>
            </View>
          </View>

          <View style={styles.recommendationItem}>
            <View style={styles.recommendationNumber}>
              <Text style={styles.recommendationNumberText}>3</Text>
            </View>
            <View style={styles.recommendationContent}>
              <Text style={styles.recommendationTitle}>
                {isEnglish ? 'PLAN INFRASTRUCTURE DEPLOYMENT' : 'PLANIFIER LE DÉPLOIEMENT INFRASTRUCTURE'}
              </Text>
              <Text style={styles.recommendationDescription}>
                {isEnglish
                  ? `Install ${results.chargingStations || 0} EV chargers and ${results.h2Stations || 0} H₂ stations. Phased deployment recommended over 12-18 months aligned with vehicle delivery schedule.`
                  : `Installer ${results.chargingStations || 0} bornes VÉ et ${results.h2Stations || 0} stations H₂. Déploiement par phases recommandé sur 12-18 mois aligné avec le calendrier de livraison des véhicules.`
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Analysis Parameters */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.assumptionsAndParams}</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.analysisHorizon}</Text>
                <Text style={styles.rowValue}>{analysisYears} {t.years}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>{t.discountRate}</Text>
                <Text style={styles.rowValue}>{(discountRate * 100).toFixed(1)}%</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.region}</Text>
                <Text style={styles.rowValue}>{scenario.region}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t.totalVehicles}</Text>
                <Text style={styles.rowValue}>{totalVehicles}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>{isEnglish ? 'Total Fleet km' : 'km Flotte Total'}</Text>
                <Text style={styles.rowValue}>{formatNumber(totalFleetKm)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footer}</Text>
          <Text style={styles.pageNumber}>Page 5/6</Text>
        </View>
      </Page>

      {/* ==================== PAGE 7: SOURCES & DISCLAIMERS ==================== */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderTop}>
            <View>
              <Text style={styles.pageTitle}>{isEnglish ? 'Sources & Methodology' : 'Sources & Méthodologie'}</Text>
              <Text style={styles.pageSubtitle}>{scenario.name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
              <Text style={styles.pageDate}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Data Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'Data Sources' : 'Sources de Données'}</Text>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? 'H2Fleet internal TCO calculation engine' : 'Moteur de calcul TCO interne H2Fleet'}</Text>
          </View>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? 'Regional energy prices (electricity, hydrogen, diesel)' : 'Prix énergétiques régionaux (électricité, hydrogène, diesel)'}</Text>
          </View>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? 'Federal and provincial incentive programs (iMHZEV, ZETF)' : 'Programmes incitatifs fédéraux et provinciaux (iMHZEV, ZETF)'}</Text>
          </View>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? 'Vehicle manufacturer specifications and pricing' : 'Spécifications et prix des constructeurs de véhicules'}</Text>
          </View>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? 'Infrastructure cost estimates from industry sources' : 'Estimations de coûts d\'infrastructure de sources industrielles'}</Text>
          </View>
        </View>

        {/* Methodology Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'Methodology Notes' : 'Notes Méthodologiques'}</Text>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? 'TCO estimates include vehicle purchase, energy, maintenance, and infrastructure' : 'Les estimations TCO incluent achat véhicule, énergie, maintenance et infrastructure'}</Text>
          </View>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? `Analysis period: ${analysisYears} years` : `Durée d'analyse: ${analysisYears} ans`}</Text>
          </View>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? `Discount rate: ${(discountRate * 100).toFixed(1)}%` : `Taux d'actualisation: ${(discountRate * 100).toFixed(1)}%`}</Text>
          </View>
          <View style={styles.sourceItem}>
            <Text style={styles.sourceBullet}>•</Text>
            <Text style={styles.sourceText}>{isEnglish ? 'CO₂ emissions calculated using regional grid emission factors' : 'Émissions CO₂ calculées avec facteurs d\'émission régionaux'}</Text>
          </View>
        </View>

        {/* Important Disclaimer */}
        <View style={{ ...styles.insightsBox, backgroundColor: '#fef3c7', borderLeftColor: colors.warning, marginTop: 30 }}>
          <Text style={{ ...styles.insightsTitle, color: colors.warning }}>
            {isEnglish ? 'Important Disclaimer' : 'Avertissement Important'}
          </Text>
          <Text style={{ fontSize: 9, color: colors.textSecondary, lineHeight: 1.5 }}>
            {isEnglish
              ? 'TCO estimates are for planning purposes only. Actual costs may vary based on local conditions, future energy prices, and subsidy policy changes. For critical financial decisions, consult an independent expert. H2Fleet Planner is not responsible for investment decisions made based on this analysis.'
              : 'Les estimations TCO sont à des fins de planification uniquement. Les coûts réels peuvent varier selon les conditions locales, les prix d\'énergie futurs et les changements de politiques de subventions. Pour toute décision financière critique, consulter un expert indépendant. H2Fleet Planner n\'est pas responsable des décisions d\'investissement basées sur cette analyse.'
            }
          </Text>
        </View>

        {/* Report Generated By */}
        {generatedBy && (
          <View style={{ marginTop: 30, alignItems: 'center' }}>
            <Text style={{ fontSize: 9, color: colors.textMuted }}>
              {t.reportGeneratedBy}: {generatedBy}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footer}</Text>
          <Text style={styles.pageNumber}>Page 6/6</Text>
        </View>
      </Page>
    </Document>
  );
};

export default TCOReportPDF;

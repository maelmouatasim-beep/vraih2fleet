import { StyleSheet } from '@react-pdf/renderer';

// Centralized branding constant
export const PDF_BRAND = {
  name: 'H2Fleet Planner',
  subtitle: 'Fleet TCO Analysis Platform',
  shortName: 'H2Fleet',
  footerAnalytics: 'H2Fleet Planner - Analytics Report',
  footerTCO: 'H2Fleet Planner - TCO Report',
  footerComparison: 'H2Fleet Planner - Comparison Report',
};

// Professional color palette
export const pdfColors = {
  // Primary brand colors
  primary: '#0d9488',       // Teal-600
  primaryDark: '#0f766e',   // Teal-700
  primaryLight: '#5eead4',  // Teal-300
  
  // Secondary colors
  secondary: '#0ea5e9',     // Sky-500
  accent: '#8b5cf6',        // Violet-500
  
  // Vehicle type colors
  diesel: '#6b7280',        // Gray-500
  ev: '#22c55e',            // Green-500
  hydrogen: '#3b82f6',      // Blue-500
  mixed: '#f59e0b',         // Amber-500
  
  // Status colors
  success: '#16a34a',       // Green-600
  warning: '#d97706',       // Amber-600
  danger: '#dc2626',        // Red-600
  
  // Neutrals
  background: '#f8fafc',    // Slate-50
  backgroundAlt: '#f1f5f9', // Slate-100
  surface: '#ffffff',
  text: '#0f172a',          // Slate-900
  textSecondary: '#475569', // Slate-600
  textMuted: '#94a3b8',     // Slate-400
  border: '#e2e8f0',        // Slate-200
  borderLight: '#f1f5f9',   // Slate-100
};

// Professional typography
export const pdfTypography = {
  fontFamily: 'Helvetica',
  fontFamilyBold: 'Helvetica-Bold',
  sizes: {
    heroTitle: 48,
    pageTitle: 28,
    sectionTitle: 14,
    subheading: 12,
    body: 10,
    caption: 9,
    small: 8,
    tiny: 7,
  },
};

// Professional PDF styles
export const professionalStyles = StyleSheet.create({
  // ==================== COVER PAGE ====================
  coverPage: {
    padding: 0,
    backgroundColor: pdfColors.surface,
  },
  
  // Cover header with gradient effect
  coverHeader: {
    backgroundColor: pdfColors.primary,
    padding: 50,
    paddingTop: 60,
    paddingBottom: 50,
  },
  
  coverHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  coverLogo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  coverLogoText: {
    fontSize: 28,
    color: 'white',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  
  coverLogoSubtext: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  
  coverReportType: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  
  coverReportTypeText: {
    fontSize: 9,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  coverTitleSection: {
    marginTop: 40,
  },
  
  coverTitle: {
    fontSize: pdfTypography.sizes.heroTitle,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 1.1,
  },
  
  coverSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 25,
  },
  
  coverDateBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  
  coverDateText: {
    fontSize: 10,
    color: 'white',
  },
  
  // Cover body (white section)
  coverBody: {
    backgroundColor: 'white',
    padding: 50,
  },
  
  // Hero metrics cards
  heroMetricsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 35,
  },
  
  heroMetricCard: {
    flex: 1,
    backgroundColor: pdfColors.background,
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
  
  heroMetricCardHighlight: {
    flex: 1,
    backgroundColor: '#ecfdf5', // Green-50
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: pdfColors.success,
  },
  
  heroMetricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pdfColors.text,
    marginBottom: 4,
  },
  
  heroMetricValueHighlight: {
    fontSize: 24,
    fontWeight: 'bold',
    color: pdfColors.success,
    marginBottom: 4,
  },
  
  heroMetricLabel: {
    fontSize: 9,
    color: pdfColors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Verdict badge
  verdictContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  
  verdictBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  verdictBadgeRecommended: {
    backgroundColor: '#dcfce7', // Green-100
  },
  
  verdictBadgeOptimize: {
    backgroundColor: '#fef3c7', // Amber-100
  },
  
  verdictBadgeNotViable: {
    backgroundColor: '#fee2e2', // Red-100
  },
  
  verdictText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  verdictTextRecommended: {
    color: pdfColors.success,
  },
  
  verdictTextOptimize: {
    color: pdfColors.warning,
  },
  
  verdictTextNotViable: {
    color: pdfColors.danger,
  },
  
  // Info grid on cover
  coverInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 30,
  },
  
  coverInfoItem: {
    width: '30%',
  },
  
  coverInfoLabel: {
    fontSize: 8,
    color: pdfColors.textMuted,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  coverInfoValue: {
    fontSize: 11,
    color: pdfColors.text,
    fontWeight: 'bold',
  },
  
  // Charts section on cover
  coverChartsSection: {
    flexDirection: 'row',
    gap: 30,
    marginTop: 20,
  },
  
  coverChartBox: {
    flex: 1,
  },
  
  coverChartTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: pdfColors.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Cover footer
  coverFooter: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 12,
  },
  
  coverFooterText: {
    fontSize: 8,
    color: pdfColors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // ==================== CONTENT PAGES ====================
  page: {
    padding: 40,
    paddingTop: 50,
    paddingBottom: 60,
    fontFamily: pdfTypography.fontFamily,
    fontSize: pdfTypography.sizes.body,
    backgroundColor: pdfColors.surface,
  },
  
  // Page header
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: pdfColors.primary,
  },
  
  pageHeaderLeft: {},
  
  pageHeaderRight: {
    alignItems: 'flex-end',
  },
  
  pageTitle: {
    fontSize: pdfTypography.sizes.pageTitle,
    color: pdfColors.text,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  pageSubtitle: {
    fontSize: pdfTypography.sizes.body,
    color: pdfColors.textSecondary,
  },
  
  pageLogo: {
    fontSize: 14,
    color: pdfColors.primary,
    fontWeight: 'bold',
  },
  
  pageDate: {
    fontSize: 9,
    color: pdfColors.textMuted,
    marginTop: 2,
  },
  
  // Sections
  section: {
    marginBottom: 22,
  },
  
  sectionTitle: {
    fontSize: pdfTypography.sizes.sectionTitle,
    fontWeight: 'bold',
    color: pdfColors.text,
    marginBottom: 12,
    backgroundColor: pdfColors.background,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: pdfColors.primary,
  },
  
  sectionSubtitle: {
    fontSize: pdfTypography.sizes.subheading,
    fontWeight: 'bold',
    color: pdfColors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  
  // Data rows
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.borderLight,
  },
  
  rowAlt: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: pdfColors.background,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.borderLight,
  },
  
  rowHighlight: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#ecfdf5',
    borderRadius: 4,
    marginTop: 4,
  },
  
  rowLabel: {
    flex: 3,
    fontSize: pdfTypography.sizes.body,
    color: pdfColors.textSecondary,
  },
  
  rowValue: {
    flex: 2,
    fontSize: pdfTypography.sizes.body,
    fontWeight: 'bold',
    textAlign: 'right',
    color: pdfColors.text,
  },
  
  rowValueHighlight: {
    flex: 2,
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'right',
    color: pdfColors.success,
  },
  
  // Two column layout
  twoColumn: {
    flexDirection: 'row',
    gap: 25,
  },
  
  column: {
    flex: 1,
  },
  
  // Three column layout
  threeColumn: {
    flexDirection: 'row',
    gap: 15,
  },
  
  columnThird: {
    flex: 1,
  },
  
  // Cards
  card: {
    backgroundColor: pdfColors.background,
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
  
  cardTitle: {
    fontSize: pdfTypography.sizes.subheading,
    fontWeight: 'bold',
    color: pdfColors.text,
    marginBottom: 10,
  },
  
  // Key insights box
  insightsBox: {
    backgroundColor: '#eff6ff', // Blue-50
    borderRadius: 8,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: pdfColors.secondary,
    marginTop: 15,
  },
  
  insightsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: pdfColors.secondary,
    marginBottom: 8,
  },
  
  insightItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 5,
  },
  
  insightBullet: {
    fontSize: 10,
    color: pdfColors.secondary,
  },
  
  insightText: {
    fontSize: 9,
    color: pdfColors.textSecondary,
    flex: 1,
  },
  
  // Chart container
  chartContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  
  // Legend
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  
  legendText: {
    fontSize: 8,
    color: pdfColors.textSecondary,
  },
  
  // Badges/Tags
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  
  badgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  
  // Page footer
  pageFooter: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
    paddingTop: 10,
  },
  
  pageFooterText: {
    fontSize: 8,
    color: pdfColors.textMuted,
  },
  
  pageNumber: {
    fontSize: 9,
    color: pdfColors.textSecondary,
    fontWeight: 'bold',
  },
  
  // Disclaimer
  disclaimer: {
    fontSize: 8,
    color: pdfColors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
  },
  
  // Comparison table styles
  comparisonTable: {
    marginTop: 10,
  },
  
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: pdfColors.primary,
    padding: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  tableHeaderCellFirst: {
    flex: 1.5,
    fontSize: 9,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'left',
  },
  
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  
  tableRowAlt: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: pdfColors.background,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  
  tableCell: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center',
    color: pdfColors.text,
  },
  
  tableCellFirst: {
    flex: 1.5,
    fontSize: 9,
    textAlign: 'left',
    color: pdfColors.textSecondary,
  },
  
  tableCellHighlight: {
    flex: 1,
    fontSize: 9,
    textAlign: 'center',
    color: pdfColors.success,
    fontWeight: 'bold',
  },
  
  // Winner badge for comparison
  winnerBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  
  winnerBadgeText: {
    fontSize: 8,
    color: pdfColors.success,
    fontWeight: 'bold',
  },
});

// Utility function to get verdict styling
export function getVerdictStyle(savings: number, paybackYears: number | null) {
  // Recommended: > 10% savings AND payback < 7 years
  // Optimize: > 0% savings OR payback between 7-10 years
  // Not viable: negative savings AND payback > 10 years
  
  const savingsPercent = savings;
  const payback = paybackYears || 999;
  
  if (savingsPercent >= 10 && payback <= 7) {
    return 'recommended';
  } else if (savingsPercent >= 0 || payback <= 10) {
    return 'optimize';
  } else {
    return 'notViable';
  }
}

// Export color utilities
export function getVehicleColor(type: 'diesel' | 'ev' | 'hydrogen' | 'mixed') {
  return pdfColors[type] || pdfColors.diesel;
}

// ==================== ADDITIONAL PROFESSIONAL STYLES ====================

// Recommendations styles for action plan pages
export const recommendationStyles = StyleSheet.create({
  container: {
    marginTop: 15,
  },
  
  item: {
    flexDirection: 'row',
    marginBottom: 15,
    padding: 12,
    backgroundColor: pdfColors.background,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: pdfColors.primary,
  },
  
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: pdfColors.primary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  numberText: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
  
  content: {
    flex: 1,
  },
  
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    color: pdfColors.text,
    marginBottom: 4,
  },
  
  text: {
    fontSize: 10,
    color: pdfColors.textSecondary,
    lineHeight: 1.4,
  },
  
  subItems: {
    marginTop: 6,
    paddingLeft: 10,
  },
  
  subItem: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  
  subBullet: {
    fontSize: 8,
    color: pdfColors.primary,
    marginRight: 6,
  },
  
  subText: {
    fontSize: 9,
    color: pdfColors.textSecondary,
  },
});

// Headline metric styles for large impact numbers
export const headlineStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 25,
    backgroundColor: pdfColors.background,
    borderRadius: 8,
  },
  
  value: {
    fontSize: 48,
    fontWeight: 'bold',
    color: pdfColors.success,
  },
  
  valueWarning: {
    fontSize: 48,
    fontWeight: 'bold',
    color: pdfColors.warning,
  },
  
  valueDanger: {
    fontSize: 48,
    fontWeight: 'bold',
    color: pdfColors.danger,
  },
  
  label: {
    fontSize: 14,
    color: pdfColors.textSecondary,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  sublabel: {
    fontSize: 10,
    color: pdfColors.textMuted,
    marginTop: 4,
  },
});

// Checklist styles for application steps
export const checklistStyles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 10,
  },
  
  checkbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: pdfColors.border,
    marginRight: 10,
    backgroundColor: pdfColors.surface,
  },
  
  checkboxChecked: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 10,
    backgroundColor: pdfColors.success,
  },
  
  text: {
    fontSize: 10,
    color: pdfColors.text,
    flex: 1,
  },
});

// Alert/Warning box styles
export const alertStyles = StyleSheet.create({
  warning: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: pdfColors.warning,
    borderRadius: 6,
    padding: 12,
    marginTop: 10,
  },
  
  warningTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: pdfColors.warning,
    marginBottom: 4,
  },
  
  warningText: {
    fontSize: 9,
    color: '#92400e',
  },
  
  success: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: pdfColors.success,
    borderRadius: 6,
    padding: 12,
    marginTop: 10,
  },
  
  successTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: pdfColors.success,
    marginBottom: 4,
  },
  
  successText: {
    fontSize: 9,
    color: '#166534',
  },
  
  info: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: pdfColors.secondary,
    borderRadius: 6,
    padding: 12,
    marginTop: 10,
  },
  
  infoTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: pdfColors.secondary,
    marginBottom: 4,
  },
  
  infoText: {
    fontSize: 9,
    color: '#1e40af',
  },
});

// KPI Grid styles for hero metrics
export const kpiGridStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  
  card: {
    flex: 1,
    backgroundColor: pdfColors.background,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: pdfColors.border,
  },
  
  cardHighlight: {
    flex: 1,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: pdfColors.success,
  },
  
  cardWarning: {
    flex: 1,
    backgroundColor: '#fefce8',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: pdfColors.warning,
  },
  
  value: {
    fontSize: 22,
    fontWeight: 'bold',
    color: pdfColors.text,
    marginBottom: 4,
  },
  
  valueSuccess: {
    fontSize: 22,
    fontWeight: 'bold',
    color: pdfColors.success,
    marginBottom: 4,
  },
  
  valueWarning: {
    fontSize: 22,
    fontWeight: 'bold',
    color: pdfColors.warning,
    marginBottom: 4,
  },
  
  label: {
    fontSize: 8,
    color: pdfColors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

// Timeline/Gantt styles
export const timelineStyles = StyleSheet.create({
  container: {
    marginTop: 15,
    padding: 15,
    backgroundColor: pdfColors.backgroundAlt,
    borderRadius: 8,
  },
  
  header: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: pdfColors.border,
  },
  
  headerLabel: {
    flex: 1,
    fontSize: 8,
    color: pdfColors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  label: {
    width: 80,
    fontSize: 9,
    color: pdfColors.text,
  },
  
  track: {
    flex: 1,
    height: 16,
    backgroundColor: pdfColors.background,
    borderRadius: 4,
    position: 'relative',
  },
  
  bar: {
    height: 16,
    borderRadius: 4,
    position: 'absolute',
  },
  
  barBlue: {
    backgroundColor: pdfColors.primary,
  },
  
  barGreen: {
    backgroundColor: pdfColors.success,
  },
  
  barOrange: {
    backgroundColor: pdfColors.warning,
  },
});

// Methodology/Sources section styles  
export const methodologyStyles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 15,
    backgroundColor: pdfColors.backgroundAlt,
    borderRadius: 8,
  },
  
  title: {
    fontSize: 11,
    fontWeight: 'bold',
    color: pdfColors.text,
    marginBottom: 10,
  },
  
  section: {
    marginBottom: 12,
  },
  
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: pdfColors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  item: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 8,
  },
  
  bullet: {
    fontSize: 8,
    color: pdfColors.primary,
    marginRight: 6,
  },
  
  text: {
    fontSize: 9,
    color: pdfColors.textSecondary,
    flex: 1,
  },
  
  link: {
    fontSize: 8,
    color: pdfColors.secondary,
    textDecoration: 'underline',
  },
});

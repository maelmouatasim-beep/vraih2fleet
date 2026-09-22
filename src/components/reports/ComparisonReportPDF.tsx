import { Document, Page, Text, View, Svg, Circle, Path } from '@react-pdf/renderer';
import { professionalStyles as styles, pdfColors, PDF_BRAND } from './styles/pdfStyles';
import { PDFStackedBarChart, PDFBarChart } from './charts';

interface ScenarioWithResult {
  id: string;
  name: string;
  region: string;
  tco_result?: {
    tco_total: number;
    tco_per_km: number;
    capex: number;
    opex_total: number;
    co2_total: number;
    co2_savings_percent: number;
    npv: number;
    payback_period_years: number | null;
  };
}

interface ComparisonTranslations {
  comparisonTitle: string;
  summaryTable: string;
  tcoTotal: string;
  capex: string;
  opex: string;
  co2Total: string;
  co2Savings: string;
  payback: string;
  npv: string;
  tcoPerKm: string;
  region: string;
  scenarioName: string;
  recommendedScenario: string;
  lowestTco: string;
  disclaimer: string;
  reportDate: string;
  generatedBy: string;
}

interface ComparisonReportPDFProps {
  scenarios: ScenarioWithResult[];
  projectName?: string;
  translations: ComparisonTranslations;
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

export const ComparisonReportPDF = ({ scenarios, projectName, translations: t, locale = 'en-CA' }: ComparisonReportPDFProps) => {
  // Find best scenario (lowest TCO)
  const scenariosWithTco = scenarios.filter(s => s.tco_result);
  const bestScenario = scenariosWithTco.reduce((best, current) => 
    (current.tco_result?.tco_total || Infinity) < (best.tco_result?.tco_total || Infinity) ? current : best
  , scenariosWithTco[0]);

  // Prepare chart data
  const tcoChartData = scenarios.map((s, i) => ({
    label: s.name.substring(0, 12),
    values: [
      { key: t.capex, value: s.tco_result?.capex || 0, color: pdfColors.primary },
      { key: t.opex, value: s.tco_result?.opex_total || 0, color: pdfColors.secondary },
    ]
  }));

  const co2ChartData = scenarios.map((s, i) => ({
    label: s.name.substring(0, 10),
    value: s.tco_result?.co2_total || 0,
    color: [pdfColors.primary, pdfColors.secondary, pdfColors.accent, pdfColors.warning, pdfColors.hydrogen][i % 5]
  }));

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.coverHeader}>
          <View style={styles.coverHeaderContent}>
            <View style={styles.coverLogo}>
              <Logo />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.coverLogoText}>{PDF_BRAND.name}</Text>
                <Text style={styles.coverLogoSubtext}>{PDF_BRAND.subtitle}</Text>
              </View>
            </View>
            <View style={styles.coverReportType}>
              <Text style={styles.coverReportTypeText}>Comparison</Text>
            </View>
          </View>
          <View style={styles.coverTitleSection}>
            <Text style={styles.coverTitle}>{t.comparisonTitle}</Text>
            <Text style={styles.coverSubtitle}>{projectName || `${scenarios.length} scenarios`}</Text>
            <View style={styles.coverDateBadge}>
              <Text style={styles.coverDateText}>
                {new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.coverBody}>
          {/* Winner Badge */}
          {bestScenario && (
            <View style={{ alignItems: 'center', marginBottom: 25 }}>
              <View style={[styles.verdictBadge, { backgroundColor: '#dcfce7' }]}>
                <Text style={{ fontSize: 12, color: pdfColors.success }}>★</Text>
                <Text style={[styles.verdictText, { color: pdfColors.success }]}>
                  {t.recommendedScenario}: {bestScenario.name}
                </Text>
              </View>
              <Text style={{ fontSize: 9, color: pdfColors.textMuted, marginTop: 5 }}>
                {t.lowestTco}: {formatCurrency(bestScenario.tco_result?.tco_total || 0)}
              </Text>
            </View>
          )}

          {/* Summary Table */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.summaryTable}</Text>
            <View style={styles.comparisonTable}>
              {/* Header */}
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderCellFirst}>Metric</Text>
                {scenarios.map((s, i) => (
                  <Text key={i} style={styles.tableHeaderCell}>{s.name.substring(0, 12)}</Text>
                ))}
              </View>
              {/* Rows */}
              {[
                { label: t.tcoTotal, key: 'tco_total', format: formatCurrency },
                { label: t.capex, key: 'capex', format: formatCurrency },
                { label: t.opex, key: 'opex_total', format: formatCurrency },
                { label: t.tcoPerKm, key: 'tco_per_km', format: (v: number) => `$${v.toFixed(3)}` },
                { label: t.co2Total, key: 'co2_total', format: (v: number) => v.toLocaleString() },
                { label: t.co2Savings, key: 'co2_savings_percent', format: (v: number) => `${v.toFixed(1)}%` },
                { label: t.payback, key: 'payback_period_years', format: (v: number | null) => v ? `${v.toFixed(1)}` : '-' },
              ].map((row, rowIndex) => (
                <View key={rowIndex} style={rowIndex % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.tableCellFirst}>{row.label}</Text>
                  {scenarios.map((s, i) => {
                    const value = s.tco_result?.[row.key as keyof typeof s.tco_result];
                    const isBest = row.key === 'tco_total' && s.id === bestScenario?.id;
                    return (
                      <Text key={i} style={isBest ? styles.tableCellHighlight : styles.tableCell}>
                        {value !== undefined ? row.format(value as any) : '-'}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* TCO Chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TCO Breakdown</Text>
            <PDFStackedBarChart 
              data={tcoChartData}
              width={480}
              height={140}
              horizontal
              formatValue={formatCurrency}
            />
          </View>

          {/* CO2 Chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.co2Total}</Text>
            <PDFBarChart 
              data={co2ChartData}
              width={400}
              height={100}
              formatValue={(v) => `${(v/1000).toFixed(0)}k t`}
            />
          </View>

          <View style={styles.coverFooter}>
            <Text style={styles.coverFooterText}>{t.disclaimer}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ComparisonReportPDF;

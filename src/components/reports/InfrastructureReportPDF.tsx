import { Document, Page, Text, View, Svg, Circle, Path } from '@react-pdf/renderer';
import { professionalStyles as styles, pdfColors, PDF_BRAND, recommendationStyles, kpiGridStyles } from './styles/pdfStyles';
import { PDFDonutChart, PDFBarChart } from './charts';

export interface InfrastructureReportTranslations {
  title: string;
  subtitle: string;
  evChargers: string;
  h2Stations: string;
  totalCapex: string;
  annualOpex: string;
  gridCapacity: string;
  evInfrastructure: string;
  h2Infrastructure: string;
  chargerType: string;
  quantity: string;
  unitCost: string;
  totalCost: string;
  stationType: string;
  capacity: string;
  dailyDemand: string;
  recommendations: string;
  phasingPlan: string;
  disclaimer: string;
  methodology: string;
  dataSources: string;
  chargingProfile: string;
  operatingHours: string;
  vehicles: string;
}

interface InfrastructureData {
  evVehicleCount: number;
  h2VehicleCount: number;
  chargersNeeded: number;
  chargersSlow: number;
  chargersFast: number;
  chargersUltra: number;
  evCapex: number;
  evOpex: number;
  evGridUpgrade: number;
  h2StationsNeeded: number;
  h2Capex: number;
  h2Opex: number;
  totalCapex: number;
  totalOpex10y: number;
  chargingSpeed: string;
  h2StationCapacity: string;
  evDailyKwh: number;
  h2DailyKg: number;
  evChargingHours: number;
  h2OperatingHours: number;
}

interface InfrastructureReportPDFProps {
  data: InfrastructureData;
  scenarioName?: string;
  translations: InfrastructureReportTranslations;
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

export const InfrastructureReportPDF = ({
  data,
  scenarioName,
  translations: t,
  locale = 'en-CA',
}: InfrastructureReportPDFProps) => {
  // Chart data
  const costBreakdownData = [
    { label: 'EV Chargers', value: data.evCapex, color: pdfColors.ev },
    { label: 'Grid Upgrade', value: data.evGridUpgrade, color: pdfColors.secondary },
    { label: 'H₂ Stations', value: data.h2Capex, color: pdfColors.hydrogen },
  ].filter(d => d.value > 0);

  const vehicleMixData = [
    { label: 'EV', value: data.evVehicleCount, color: pdfColors.ev },
    { label: 'H₂', value: data.h2VehicleCount, color: pdfColors.hydrogen },
  ].filter(d => d.value > 0);

  const totalVehicles = data.evVehicleCount + data.h2VehicleCount;

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
              <Text style={styles.coverReportTypeText}>Infrastructure Planning</Text>
            </View>
          </View>

          <View style={styles.coverTitleSection}>
            <Text style={styles.coverTitle}>{t.title}</Text>
            <Text style={styles.coverSubtitle}>{scenarioName || t.subtitle}</Text>
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
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{data.chargersNeeded}</Text>
              <Text style={styles.heroMetricLabel}>{t.evChargers}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{data.h2StationsNeeded}</Text>
              <Text style={styles.heroMetricLabel}>{t.h2Stations}</Text>
            </View>
            <View style={styles.heroMetricCardHighlight}>
              <Text style={styles.heroMetricValueHighlight}>{formatCurrency(data.totalCapex)}</Text>
              <Text style={styles.heroMetricLabel}>{t.totalCapex}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{formatCurrency(data.totalOpex10y)}</Text>
              <Text style={styles.heroMetricLabel}>{t.annualOpex} (10y)</Text>
            </View>
          </View>

          {/* Context Info */}
          <View style={styles.coverInfoGrid}>
            <View style={styles.coverInfoItem}>
              <Text style={styles.coverInfoLabel}>{t.vehicles}</Text>
              <Text style={styles.coverInfoValue}>{totalVehicles}</Text>
            </View>
            <View style={styles.coverInfoItem}>
              <Text style={styles.coverInfoLabel}>EV Daily Demand</Text>
              <Text style={styles.coverInfoValue}>{data.evDailyKwh} kWh</Text>
            </View>
            <View style={styles.coverInfoItem}>
              <Text style={styles.coverInfoLabel}>H₂ Daily Demand</Text>
              <Text style={styles.coverInfoValue}>{data.h2DailyKg} kg</Text>
            </View>
            <View style={styles.coverInfoItem}>
              <Text style={styles.coverInfoLabel}>Charging Speed</Text>
              <Text style={styles.coverInfoValue}>{data.chargingSpeed}</Text>
            </View>
            <View style={styles.coverInfoItem}>
              <Text style={styles.coverInfoLabel}>H₂ Station Capacity</Text>
              <Text style={styles.coverInfoValue}>{data.h2StationCapacity} kg/day</Text>
            </View>
          </View>

          {/* Charts Section */}
          <View style={styles.coverChartsSection}>
            <View style={styles.coverChartBox}>
              <Text style={styles.coverChartTitle}>Fleet Mix</Text>
              {vehicleMixData.length > 0 && (
                <PDFDonutChart
                  data={vehicleMixData}
                  size={130}
                  centerValue={totalVehicles.toString()}
                  centerLabel={t.vehicles}
                  showPercentages
                />
              )}
            </View>
            <View style={styles.coverChartBox}>
              <Text style={styles.coverChartTitle}>CAPEX Breakdown</Text>
              {costBreakdownData.length > 0 && (
                <PDFBarChart
                  data={costBreakdownData}
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

      {/* ==================== PAGE 2: EV INFRASTRUCTURE ==================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>{t.evInfrastructure}</Text>
            <Text style={styles.pageSubtitle}>{data.evVehicleCount} vehicles • {data.chargersNeeded} chargers</Text>
          </View>
          <View style={styles.pageHeaderRight}>
            <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
            <Text style={styles.pageDate}>{new Date().toLocaleDateString(locale)}</Text>
          </View>
        </View>

        {/* EV Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Charging Infrastructure</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Vehicles</Text>
                <Text style={styles.rowValue}>{data.evVehicleCount}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>Daily Energy Demand</Text>
                <Text style={styles.rowValue}>{data.evDailyKwh} kWh</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Charging Hours Available</Text>
                <Text style={styles.rowValue}>{data.evChargingHours}h</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>Charging Speed</Text>
                <Text style={styles.rowValue}>{data.chargingSpeed}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Chargers Required</Text>
                <Text style={styles.rowValue}>{data.chargersNeeded}</Text>
              </View>
              <View style={styles.rowAlt}>
                <Text style={styles.rowLabel}>Equipment Cost</Text>
                <Text style={styles.rowValue}>{formatCurrency(data.evCapex)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Grid Upgrade</Text>
                <Text style={styles.rowValue}>{formatCurrency(data.evGridUpgrade)}</Text>
              </View>
              <View style={styles.rowHighlight}>
                <Text style={styles.rowLabel}>Annual OPEX</Text>
                <Text style={styles.rowValueHighlight}>{formatCurrency(data.evOpex)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* H2 Infrastructure */}
        {data.h2VehicleCount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.h2Infrastructure}</Text>
            <View style={styles.twoColumn}>
              <View style={styles.column}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Vehicles</Text>
                  <Text style={styles.rowValue}>{data.h2VehicleCount}</Text>
                </View>
                <View style={styles.rowAlt}>
                  <Text style={styles.rowLabel}>Daily H₂ Demand</Text>
                  <Text style={styles.rowValue}>{data.h2DailyKg} kg</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Operating Hours</Text>
                  <Text style={styles.rowValue}>{data.h2OperatingHours}h</Text>
                </View>
              </View>
              <View style={styles.column}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Stations Required</Text>
                  <Text style={styles.rowValue}>{data.h2StationsNeeded}</Text>
                </View>
                <View style={styles.rowAlt}>
                  <Text style={styles.rowLabel}>Station Capacity</Text>
                  <Text style={styles.rowValue}>{data.h2StationCapacity} kg/day</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Station Cost</Text>
                  <Text style={styles.rowValue}>{formatCurrency(data.h2Capex)}</Text>
                </View>
                <View style={styles.rowHighlight}>
                  <Text style={styles.rowLabel}>Annual OPEX</Text>
                  <Text style={styles.rowValueHighlight}>{formatCurrency(data.h2Opex)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.recommendations}</Text>
          <View style={recommendationStyles.container}>
            <View style={recommendationStyles.item}>
              <View style={recommendationStyles.number}>
                <Text style={recommendationStyles.numberText}>1</Text>
              </View>
              <View style={recommendationStyles.content}>
                <Text style={recommendationStyles.title}>Assess Grid Capacity</Text>
                <Text style={recommendationStyles.text}>Contact utility provider to verify available power capacity and upgrade requirements.</Text>
              </View>
            </View>
            <View style={recommendationStyles.item}>
              <View style={recommendationStyles.number}>
                <Text style={recommendationStyles.numberText}>2</Text>
              </View>
              <View style={recommendationStyles.content}>
                <Text style={recommendationStyles.title}>Phased Deployment</Text>
                <Text style={recommendationStyles.text}>Consider deploying infrastructure in phases aligned with vehicle acquisitions.</Text>
              </View>
            </View>
            <View style={recommendationStyles.item}>
              <View style={recommendationStyles.number}>
                <Text style={recommendationStyles.numberText}>3</Text>
              </View>
              <View style={recommendationStyles.content}>
                <Text style={recommendationStyles.title}>Apply for Subsidies</Text>
                <Text style={recommendationStyles.text}>Check federal and provincial infrastructure incentive programs before purchasing.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>{t.disclaimer}</Text>

        {/* Footer */}
        <View style={styles.pageFooter}>
          <Text style={styles.pageFooterText}>{PDF_BRAND.footerTCO}</Text>
          <Text style={styles.pageNumber}>2</Text>
        </View>
      </Page>
    </Document>
  );
};

export default InfrastructureReportPDF;

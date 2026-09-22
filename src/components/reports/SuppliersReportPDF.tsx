import { Document, Page, Text, View, Svg, Circle, Path } from '@react-pdf/renderer';
import { professionalStyles as styles, pdfColors, PDF_BRAND, methodologyStyles } from './styles/pdfStyles';
import { PDFDonutChart, PDFBarChart } from './charts';

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

export interface SuppliersReportTranslations {
  title: string;
  subtitle: string;
  totalSuppliers: string;
  h2Suppliers: string;
  evSuppliers: string;
  regionsServed: string;
  supplierType: string;
  companyName: string;
  location: string;
  contact: string;
  services: string;
  verified: string;
  notVerified: string;
  disclaimer: string;
  dataSources: string;
  lastUpdated: string;
  filterApplied: string;
  typeBreakdown: string;
  regionBreakdown: string;
}

interface SuppliersReportPDFProps {
  suppliers: Supplier[];
  filters?: {
    supplierType?: string;
    country?: string;
    certification?: string;
  };
  translations: SuppliersReportTranslations;
  locale?: string;
}

const Logo = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40">
    <Circle cx={20} cy={20} r={18} fill="rgba(255,255,255,0.15)" />
    <Path d="M12 28 L20 12 L28 28 L20 22 Z" fill="white" />
    <Circle cx={20} cy={18} r={4} fill="rgba(255,255,255,0.85)" />
  </Svg>
);

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  vehicle_manufacturer: 'Vehicle Manufacturer',
  infrastructure: 'Infrastructure',
  fuel_provider: 'Fuel Provider',
  maintenance: 'Maintenance',
  charging_infrastructure: 'Charging Infrastructure',
  biomethane: 'Biomethane',
  diesel_biodiesel: 'Diesel/Biodiesel',
  retrofit_services: 'Retrofit Services',
  other: 'Other',
};

export const SuppliersReportPDF = ({
  suppliers,
  filters,
  translations: t,
  locale = 'en-CA',
}: SuppliersReportPDFProps) => {
  // Calculate stats
  const h2Suppliers = suppliers.filter(s => 
    ['fuel_provider', 'infrastructure', 'vehicle_manufacturer'].includes(s.supplier_type) &&
    s.products_services.some(p => p.toLowerCase().includes('hydrogen') || p.toLowerCase().includes('h2'))
  ).length;
  
  const evSuppliers = suppliers.filter(s => 
    ['charging_infrastructure', 'vehicle_manufacturer'].includes(s.supplier_type) ||
    s.products_services.some(p => p.toLowerCase().includes('electric') || p.toLowerCase().includes('ev'))
  ).length;

  const uniqueRegions = [...new Set(suppliers.map(s => s.country))].length;
  const verifiedCount = suppliers.filter(s => s.is_verified).length;

  // Type breakdown for chart
  const typeBreakdown = Object.entries(
    suppliers.reduce((acc, s) => {
      acc[s.supplier_type] = (acc[s.supplier_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count], i) => ({
    label: SUPPLIER_TYPE_LABELS[type] || type,
    value: count,
    color: [pdfColors.primary, pdfColors.secondary, pdfColors.accent, pdfColors.success, pdfColors.hydrogen][i % 5],
  })).slice(0, 5);

  // Region breakdown for chart
  const regionBreakdown = Object.entries(
    suppliers.reduce((acc, s) => {
      acc[s.country] = (acc[s.country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([country, count], i) => ({
    label: country,
    value: count,
    color: [pdfColors.primary, pdfColors.secondary, pdfColors.accent, pdfColors.warning, pdfColors.success][i % 5],
  }));

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
              <Text style={styles.coverReportTypeText}>Suppliers Directory</Text>
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
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{suppliers.length}</Text>
              <Text style={styles.heroMetricLabel}>{t.totalSuppliers}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{h2Suppliers}</Text>
              <Text style={styles.heroMetricLabel}>{t.h2Suppliers}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{evSuppliers}</Text>
              <Text style={styles.heroMetricLabel}>{t.evSuppliers}</Text>
            </View>
            <View style={styles.heroMetricCard}>
              <Text style={styles.heroMetricValue}>{uniqueRegions}</Text>
              <Text style={styles.heroMetricLabel}>{t.regionsServed}</Text>
            </View>
          </View>

          {/* Filters Applied */}
          {filters && (filters.supplierType || filters.country || filters.certification) && (
            <View style={styles.coverInfoGrid}>
              <View style={styles.coverInfoItem}>
                <Text style={styles.coverInfoLabel}>{t.filterApplied}</Text>
                <Text style={styles.coverInfoValue}>
                  {[filters.supplierType, filters.country, filters.certification].filter(Boolean).join(' • ')}
                </Text>
              </View>
            </View>
          )}

          {/* Charts Section */}
          <View style={styles.coverChartsSection}>
            <View style={styles.coverChartBox}>
              <Text style={styles.coverChartTitle}>{t.typeBreakdown}</Text>
              {typeBreakdown.length > 0 && (
                <PDFDonutChart
                  data={typeBreakdown}
                  size={130}
                  centerValue={suppliers.length.toString()}
                  centerLabel="Total"
                  showPercentages
                />
              )}
            </View>
            <View style={styles.coverChartBox}>
              <Text style={styles.coverChartTitle}>{t.regionBreakdown}</Text>
              {regionBreakdown.length > 0 && (
                <PDFBarChart
                  data={regionBreakdown}
                  width={200}
                  height={100}
                  formatValue={(v) => v.toString()}
                />
              )}
            </View>
          </View>

          <View style={styles.coverFooter}>
            <Text style={styles.coverFooterText}>{t.disclaimer}</Text>
          </View>
        </View>
      </Page>

      {/* ==================== PAGE 2: SUPPLIERS LIST ==================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLeft}>
            <Text style={styles.pageTitle}>Suppliers List</Text>
            <Text style={styles.pageSubtitle}>{suppliers.length} suppliers • {verifiedCount} verified</Text>
          </View>
          <View style={styles.pageHeaderRight}>
            <Text style={styles.pageLogo}>{PDF_BRAND.shortName}</Text>
            <Text style={styles.pageDate}>{new Date().toLocaleDateString(locale)}</Text>
          </View>
        </View>

        {/* Suppliers Table */}
        <View style={styles.section}>
          <View style={styles.comparisonTable}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCellFirst}>{t.companyName}</Text>
              <Text style={styles.tableHeaderCell}>{t.supplierType}</Text>
              <Text style={styles.tableHeaderCell}>{t.location}</Text>
              <Text style={styles.tableHeaderCell}>{t.verified}</Text>
            </View>
            {/* Rows */}
            {suppliers.slice(0, 15).map((supplier, index) => (
              <View key={supplier.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.tableCellFirst}>{supplier.company_name.substring(0, 25)}</Text>
                <Text style={styles.tableCell}>{SUPPLIER_TYPE_LABELS[supplier.supplier_type]?.substring(0, 12) || supplier.supplier_type}</Text>
                <Text style={styles.tableCell}>
                  {supplier.province_state ? `${supplier.province_state}, ${supplier.country}` : supplier.country}
                </Text>
                <Text style={supplier.is_verified ? styles.tableCellHighlight : styles.tableCell}>
                  {supplier.is_verified ? '✓' : '-'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {suppliers.length > 15 && (
          <Text style={{ fontSize: 9, color: pdfColors.textMuted, textAlign: 'center', marginTop: 10 }}>
            + {suppliers.length - 15} more suppliers not shown
          </Text>
        )}

        {/* Methodology */}
        <View style={methodologyStyles.container}>
          <Text style={methodologyStyles.title}>{t.dataSources}</Text>
          <View style={methodologyStyles.section}>
            <View style={methodologyStyles.item}>
              <Text style={methodologyStyles.bullet}>•</Text>
              <Text style={methodologyStyles.text}>H2Fleet Planner verified supplier database</Text>
            </View>
            <View style={methodologyStyles.item}>
              <Text style={methodologyStyles.bullet}>•</Text>
              <Text style={methodologyStyles.text}>{t.lastUpdated}: {new Date().toLocaleDateString(locale)}</Text>
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

export default SuppliersReportPDF;

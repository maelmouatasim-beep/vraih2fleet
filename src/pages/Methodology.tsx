import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, Fuel, Zap, Building2, TrendingDown, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import DemoRequestModal from '@/components/landing/DemoRequestModal';

import { useState } from 'react';

const Methodology = () => {
  const { t } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              {t('common.back', 'Back')}
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-4">{t('methodology.title', 'TCO Calculation Methodology')}</h1>
          <p className="text-lg text-muted-foreground">
            {t('methodology.subtitle', 'Transparent formulas and assumptions for accurate fleet transition planning')}
          </p>
        </div>

        {/* Disclaimer Alert */}
        <Card className="mb-8 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t('methodology.disclaimer.title', 'Important Notice')}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {t('methodology.disclaimer.text', 'TCO estimates are for planning purposes only. Actual costs may vary based on local conditions, market fluctuations, and operational factors. For critical financial decisions, consult with a qualified expert.')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TCO Formula */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {t('methodology.tco_formula.title', 'TCO Master Formula')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-6 rounded-lg font-mono text-center text-lg">
              <span className="font-bold text-primary">TCO</span> = CAPEX + NPV(OPEX) − Residual Value
            </div>
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              <div className="p-4 border rounded-lg">
                <p className="font-semibold mb-2">CAPEX</p>
                <p className="text-sm text-muted-foreground">
                  {t('methodology.tco_formula.capex_desc', 'Vehicle acquisition cost + Infrastructure investment (chargers, H₂ stations)')}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-semibold mb-2">NPV(OPEX)</p>
                <p className="text-sm text-muted-foreground">
                  {t('methodology.tco_formula.opex_desc', 'Net Present Value of operational costs (fuel, energy, maintenance, insurance) discounted over analysis period')}
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="font-semibold mb-2">{t('methodology.tco_formula.residual', 'Residual Value')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('methodology.tco_formula.residual_desc', 'Estimated vehicle value at end of analysis period (typically 20% of initial cost after 10 years)')}
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            <h4 className="font-semibold mb-3">{t('methodology.npv.title', 'NPV Calculation')}</h4>
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-center">
              NPV = Σ (Cash Flow<sub>t</sub> / (1 + r)<sup>t</sup>)
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t('methodology.npv.desc', 'Where r = discount rate (default 5%) and t = year (1 to analysis horizon)')}
            </p>
          </CardContent>
        </Card>

        {/* Maintenance Costs */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              {t('methodology.maintenance.title', 'Maintenance Costs by Technology')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg border-l-4 border-l-orange-500">
                <div className="flex items-center gap-2 mb-2">
                  <Fuel className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold">Diesel</span>
                </div>
                <p className="text-2xl font-bold">$0.20/km</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('methodology.maintenance.diesel_desc', 'Higher due to complex drivetrain, oil changes, exhaust system maintenance')}
                </p>
              </div>
              <div className="p-4 border rounded-lg border-l-4 border-l-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="font-semibold">BEV (Electric)</span>
                </div>
                <p className="text-2xl font-bold">$0.12/km</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('methodology.maintenance.ev_desc', 'Lower costs: fewer moving parts, regenerative braking reduces brake wear')}
                </p>
              </div>
              <div className="p-4 border rounded-lg border-l-4 border-l-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold">FCEV (Hydrogen)</span>
                </div>
                <p className="text-2xl font-bold">$0.18/km</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('methodology.maintenance.h2_desc', 'Fuel cell stack maintenance, hydrogen system inspections')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Energy Consumption */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('methodology.consumption.title', 'Energy Consumption Constants')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">{t('common.technology', 'Technology')}</th>
                    <th className="text-left py-3 px-4">{t('methodology.consumption.rate', 'Consumption Rate')}</th>
                    <th className="text-left py-3 px-4">{t('methodology.consumption.co2', 'CO₂ Factor')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Diesel</td>
                    <td className="py-3 px-4">2.8 km/L</td>
                    <td className="py-3 px-4">10.21 kg CO₂/gallon (2.68 kg CO₂/L)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Electric (BEV)</td>
                    <td className="py-3 px-4">0.2 kWh/km</td>
                    <td className="py-3 px-4">{t('methodology.consumption.ev_co2', 'Grid-dependent (0.03-0.5 kg CO₂/kWh)')}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Hydrogen (FCEV)</td>
                    <td className="py-3 px-4">0.012 kg/km</td>
                    <td className="py-3 px-4">3.0 kg CO₂/kg H₂ (grey hydrogen)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {t('methodology.consumption.note', 'Note: Consumption rates vary based on vehicle class, load, terrain, and temperature. Adaptive multipliers are applied for operational conditions.')}
            </p>
          </CardContent>
        </Card>

        {/* Infrastructure Calculation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t('methodology.infrastructure.title', 'Infrastructure Sizing')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" />
                {t('methodology.infrastructure.ev_chargers', 'EV Charger Calculation')}
              </h4>
              <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                Chargers = ceil(EVs × Battery Capacity / (Charging Speed × Hours Available × Utilization))
              </div>
              <div className="mt-3 text-sm text-muted-foreground space-y-1">
                <p>• {t('methodology.infrastructure.ev_defaults', 'Default: 150 kWh battery, 50 kW chargers, 8h availability, 80% utilization')}</p>
                <p>• {t('methodology.infrastructure.ev_cost', 'Cost: $50,000 - $150,000 per DC fast charger (installed)')}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                {t('methodology.infrastructure.h2_stations', 'H₂ Station Calculation')}
              </h4>
              <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                Stations = ceil(Daily H₂ Demand / Station Capacity)
              </div>
              <div className="mt-3 text-sm text-muted-foreground space-y-1">
                <p>• {t('methodology.infrastructure.h2_demand', 'Daily demand = Vehicles × km/day × 0.012 kg/km')}</p>
                <p>• {t('methodology.infrastructure.h2_capacity', 'Default station capacity: 200 kg/day')}</p>
                <p>• {t('methodology.infrastructure.h2_cost', 'Cost: $1,500,000 - $3,000,000 per station')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Residual Value */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('methodology.residual.title', 'Residual Value Assumptions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg font-mono text-center mb-4">
              Residual Value = Purchase Price × Depreciation Factor
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">{t('methodology.residual.period', 'Analysis Period')}</th>
                    <th className="text-left py-3 px-4">{t('methodology.residual.factor', 'Depreciation Factor')}</th>
                    <th className="text-left py-3 px-4">{t('methodology.residual.retained', 'Value Retained')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4">5 years</td>
                    <td className="py-3 px-4">0.40</td>
                    <td className="py-3 px-4">40%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">7 years</td>
                    <td className="py-3 px-4">0.30</td>
                    <td className="py-3 px-4">30%</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4">10 years</td>
                    <td className="py-3 px-4">0.20</td>
                    <td className="py-3 px-4">20%</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">15 years</td>
                    <td className="py-3 px-4">0.10</td>
                    <td className="py-3 px-4">10%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Data Sources */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('methodology.sources.title', 'Data Sources')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold">{t('methodology.sources.fuel_prices', 'Fuel & Energy Prices')}</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">CA</Badge>
                    <span>Natural Resources Canada - Fuel Focus</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">CA</Badge>
                    <span>Hydro-Québec, BC Hydro, IESO (electricity rates)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">CA</Badge>
                    <span>HTEC, Air Liquide (hydrogen pricing)</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold">{t('methodology.sources.vehicles', 'Vehicle & Infrastructure')}</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">OEM</Badge>
                    <span>Manufacturer MSRP and specifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">CA</Badge>
                    <span>NRCAN FleetSmart program data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="mt-0.5">IEA</Badge>
                    <span>Global EV Outlook (infrastructure costs)</span>
                  </li>
                </ul>
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-xs text-muted-foreground">
              {t('methodology.sources.update', 'Reference data is updated quarterly to reflect current market conditions. Last update: January 2026')}
            </p>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">
              {t('methodology.cta.title', 'Ready to calculate your fleet TCO?')}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t('methodology.cta.desc', 'Use our calculator with these validated formulas')}
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/signup">
                <Button>{t('common.requestAccess', 'Sign up')}</Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline">{t('common.contactUs', 'Contact Us')}</Button>
              </Link>
            </div>
            <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Methodology;

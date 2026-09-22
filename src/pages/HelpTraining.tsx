import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calculator, 
  Fuel, 
  Zap, 
  Building2, 
  TrendingDown, 
  Info, 
  HelpCircle,
  BookOpen,
  DollarSign,
  Leaf
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import DashboardLayout from '@/components/dashboard/DashboardLayout';

const HelpTraining = () => {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">{t('helpTraining.title', 'Help & Training')}</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            {t('helpTraining.subtitle', 'Learn how to use H2Fleet Planner tools and understand our calculations')}
          </p>
        </div>

        {/* Disclaimer Alert */}
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t('helpTraining.disclaimer.title', 'Important Notice')}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {t('helpTraining.disclaimer.text', 'TCO estimates are for planning purposes only. Actual costs may vary based on local conditions, market fluctuations, and operational factors. For critical financial decisions, consult with a qualified expert.')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accordion Sections */}
        <Accordion type="multiple" defaultValue={["methodology"]} className="space-y-4">
          {/* TCO Methodology */}
          <AccordionItem value="methodology" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Calculator className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.methodology', 'TCO Methodology')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pt-4">
              {/* TCO Formula */}
              <div>
                <h4 className="font-semibold mb-3">{t('helpTraining.tcoFormula.title', 'TCO Master Formula')}</h4>
                <div className="bg-muted/50 p-6 rounded-lg font-mono text-center text-lg">
                  <span className="font-bold text-primary">TCO</span> = CAPEX + NPV(OPEX) − {t('helpTraining.tcoFormula.residualValue', 'Residual Value')}
                </div>
                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 border rounded-lg">
                    <p className="font-semibold mb-2">CAPEX</p>
                    <p className="text-sm text-muted-foreground">
                      {t('helpTraining.tcoFormula.capexDesc', 'Vehicle acquisition cost + Infrastructure investment (chargers, H₂ stations)')}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="font-semibold mb-2">NPV(OPEX)</p>
                    <p className="text-sm text-muted-foreground">
                      {t('helpTraining.tcoFormula.opexDesc', 'Net Present Value of operational costs (fuel, energy, maintenance, insurance) discounted over analysis period')}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="font-semibold mb-2">{t('helpTraining.tcoFormula.residual', 'Residual Value')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('helpTraining.tcoFormula.residualDesc', 'Estimated vehicle value at end of analysis period (typically 20% of initial cost after 10 years)')}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* NPV Calculation */}
              <div>
                <h4 className="font-semibold mb-3">{t('helpTraining.npv.title', 'NPV Calculation')}</h4>
                <div className="bg-muted/50 p-4 rounded-lg font-mono text-center">
                  NPV = Σ (Cash Flow<sub>t</sub> / (1 + r)<sup>t</sup>)
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('helpTraining.npv.desc', 'Where r = discount rate (default 5%) and t = year (1 to analysis horizon)')}
                </p>
              </div>

              <Separator />

              {/* OPEX Components */}
              <div>
                <h4 className="font-semibold mb-3">{t('helpTraining.opex.title', 'OPEX Components')}</h4>
                <div className="bg-muted/50 p-4 rounded-lg font-mono text-center mb-3">
                  OPEX = {t('helpTraining.opex.formula', 'Fuel + Maintenance + Insurance + Downtime')}
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>{t('helpTraining.opex.fuel', 'Fuel/Energy: based on consumption rate × energy price × annual km')}</li>
                  <li>{t('helpTraining.opex.maintenance', 'Maintenance: technology-specific cost per km')}</li>
                  <li>{t('helpTraining.opex.insurance', 'Insurance: annual premium based on vehicle value')}</li>
                  <li>{t('helpTraining.opex.downtime', 'Downtime: estimated productivity loss during charging/refueling')}</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Maintenance Costs */}
          <AccordionItem value="maintenance" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.maintenance', 'Maintenance Costs')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg border-l-4 border-l-orange-500">
                  <div className="flex items-center gap-2 mb-2">
                    <Fuel className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold">Diesel</span>
                  </div>
                  <p className="text-2xl font-bold">$0.20/km</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('helpTraining.maintenance.dieselDesc', 'Higher due to complex drivetrain, oil changes, exhaust system maintenance')}
                  </p>
                </div>
                <div className="p-4 border rounded-lg border-l-4 border-l-green-500">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="font-semibold">BEV ({t('common.electric', 'Electric')})</span>
                  </div>
                  <p className="text-2xl font-bold">$0.12/km</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('helpTraining.maintenance.evDesc', 'Lower costs: fewer moving parts, regenerative braking reduces brake wear')}
                  </p>
                </div>
                <div className="p-4 border rounded-lg border-l-4 border-l-blue-500">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold">FCEV ({t('common.hydrogen', 'Hydrogen')})</span>
                  </div>
                  <p className="text-2xl font-bold">$0.18/km</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t('helpTraining.maintenance.h2Desc', 'Fuel cell stack maintenance, hydrogen system inspections')}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Energy Consumption */}
          <AccordionItem value="consumption" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Fuel className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.consumption', 'Energy Consumption')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">{t('common.technology', 'Technology')}</th>
                      <th className="text-left py-3 px-4">{t('helpTraining.consumption.rate', 'Consumption Rate')}</th>
                      <th className="text-left py-3 px-4">{t('helpTraining.consumption.co2', 'CO₂ Factor')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">Diesel</td>
                      <td className="py-3 px-4">2.8 km/L</td>
                      <td className="py-3 px-4">2.68 kg CO₂/L</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">{t('common.electric', 'Electric')} (BEV)</td>
                      <td className="py-3 px-4">0.2 kWh/km</td>
                      <td className="py-3 px-4">{t('helpTraining.consumption.evCo2', 'Grid-dependent (0.03-0.5 kg CO₂/kWh)')}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-medium">{t('common.hydrogen', 'Hydrogen')} (FCEV)</td>
                      <td className="py-3 px-4">0.012 kg/km</td>
                      <td className="py-3 px-4">3.0 kg CO₂/kg H₂</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {t('helpTraining.consumption.note', 'Note: Consumption rates vary based on vehicle class, load, terrain, and temperature. Adaptive multipliers are applied for operational conditions.')}
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Infrastructure Sizing */}
          <AccordionItem value="infrastructure" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.infrastructure', 'Infrastructure Sizing')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pt-4">
              {/* EV Chargers */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  {t('helpTraining.infrastructure.evChargers', 'EV Charger Calculation')}
                </h4>
                <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                  {t('helpTraining.infrastructure.evFormula', 'Chargers = ceil(EVs × Battery Capacity / (Charging Speed × Hours Available × Utilization))')}
                </div>
                <div className="mt-3 text-sm text-muted-foreground space-y-1">
                  <p>• {t('helpTraining.infrastructure.evDefaults', 'Default: 150 kWh battery, 50 kW chargers, 8h availability, 80% utilization')}</p>
                  <p>• {t('helpTraining.infrastructure.evCost', 'Cost: $50,000 - $150,000 per DC fast charger (installed)')}</p>
                </div>
              </div>

              <Separator />

              {/* H2 Stations */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  {t('helpTraining.infrastructure.h2Stations', 'H₂ Station Calculation')}
                </h4>
                <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                  {t('helpTraining.infrastructure.h2Formula', 'Stations = ceil(Daily H₂ Demand / Station Capacity)')}
                </div>
                <div className="mt-3 text-sm text-muted-foreground space-y-1">
                  <p>• {t('helpTraining.infrastructure.h2Demand', 'Daily demand = Vehicles × km/day × 0.012 kg/km')}</p>
                  <p>• {t('helpTraining.infrastructure.h2Capacity', 'Default station capacity: 200 kg/day')}</p>
                  <p>• {t('helpTraining.infrastructure.h2Cost', 'Cost: $1,500,000 - $3,000,000 per station')}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Reference Data */}
          <AccordionItem value="referenceData" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.referenceData', 'Reference Data')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {/* Vehicle Prices */}
              <div>
                <h4 className="font-semibold mb-3">{t('helpTraining.referenceData.vehiclePrices', 'Vehicle Prices (Canadian Market)')}</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('helpTraining.referenceData.dieselTruck', 'Diesel Truck')}</p>
                    <p className="text-xl font-bold">$150,000</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('helpTraining.referenceData.evTruck', 'EV Truck')}</p>
                    <p className="text-xl font-bold">$280,000</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('helpTraining.referenceData.h2Truck', 'H₂ Truck')}</p>
                    <p className="text-xl font-bold">$350,000</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Energy Prices */}
              <div>
                <h4 className="font-semibold mb-3">{t('helpTraining.referenceData.energyPrices', 'Energy Prices (Canadian Average)')}</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Diesel</p>
                    <p className="text-xl font-bold">$1.48/L</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('common.electricity', 'Electricity')}</p>
                    <p className="text-xl font-bold">$0.12/kWh</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">{t('common.hydrogen', 'Hydrogen')}</p>
                    <p className="text-xl font-bold">$12.00/kg</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t('helpTraining.referenceData.note', 'These are indicative averages. For accurate calculations, use your actual contract prices.')}
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Data Sources */}
          <AccordionItem value="sources" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.sources', 'Data Sources')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold">{t('helpTraining.sources.fuelPrices', 'Fuel & Energy Prices')}</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">CA</Badge>
                      <span>Natural Resources Canada - Fuel Focus</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">CA</Badge>
                      <span>Hydro-Québec, BC Hydro, IESO</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">CA</Badge>
                      <span>HTEC, Air Liquide (H₂)</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">{t('helpTraining.sources.vehicles', 'Vehicle & Infrastructure')}</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">OEM</Badge>
                      <span>{t('helpTraining.sources.oem', 'Manufacturer MSRP and specifications')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">CA</Badge>
                      <span>NRCAN FleetSmart</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">IEA</Badge>
                      <span>Global EV Outlook</span>
                    </li>
                  </ul>
                </div>
              </div>
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground">
                {t('helpTraining.sources.update', 'Reference data is updated quarterly. Last update: January 2026')}
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Residual Value */}
          <AccordionItem value="residual" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.residual', 'Residual Value')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              <div className="bg-muted/50 p-4 rounded-lg font-mono text-center mb-4">
                {t('helpTraining.residual.formula', 'Residual Value = Purchase Price × Depreciation Factor')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">{t('helpTraining.residual.period', 'Analysis Period')}</th>
                      <th className="text-left py-3 px-4">{t('helpTraining.residual.factor', 'Depreciation Factor')}</th>
                      <th className="text-left py-3 px-4">{t('helpTraining.residual.retained', 'Value Retained')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4">5 {t('common.years', 'years')}</td>
                      <td className="py-3 px-4">0.40</td>
                      <td className="py-3 px-4">40%</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">7 {t('common.years', 'years')}</td>
                      <td className="py-3 px-4">0.30</td>
                      <td className="py-3 px-4">30%</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">10 {t('common.years', 'years')}</td>
                      <td className="py-3 px-4">0.20</td>
                      <td className="py-3 px-4">20%</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">15 {t('common.years', 'years')}</td>
                      <td className="py-3 px-4">0.10</td>
                      <td className="py-3 px-4">10%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* FAQ */}
          <AccordionItem value="faq" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t('helpTraining.sections.faq', 'Frequently Asked Questions')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <p className="font-medium mb-2">{t('helpTraining.faq.q1', 'Why is the default discount rate 5%?')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('helpTraining.faq.a1', 'A 5% discount rate represents a typical cost of capital for fleet operators. You can adjust this in Advanced Parameters to match your specific financing costs.')}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="font-medium mb-2">{t('helpTraining.faq.q2', 'How are cold weather impacts calculated?')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('helpTraining.faq.a2', 'Cold weather can reduce EV range by 20-40%. When enabled, this multiplier is applied to energy consumption based on regional climate data.')}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="font-medium mb-2">{t('helpTraining.faq.q3', 'What is Time-of-Use (TOU) pricing?')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('helpTraining.faq.a3', 'TOU pricing applies different electricity rates based on charging time. Off-peak charging (nights/weekends) can reduce costs by 30-50%.')}
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="font-medium mb-2">{t('helpTraining.faq.q4', 'How are carbon credits calculated?')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('helpTraining.faq.a4', 'Carbon credits are based on CO₂ savings vs diesel baseline, valued at the current carbon price (typically $65-170/tonne in Canada).')}
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DashboardLayout>
  );
};

export default HelpTraining;

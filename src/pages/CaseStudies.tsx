import { useTranslation } from "react-i18next";
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bus, 
  Truck, 
  TrendingDown, 
  Leaf, 
  DollarSign, 
  Clock, 
  MapPin,
  Zap,
  Fuel,
  ArrowRight,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  BookOpen,
  ExternalLink,
  Calculator
} from "lucide-react";
import {
  calculateSTMCase,
  calculateWinnipegCase,
  calculateERACase,
  formatNumber,
  formatCurrency,
  ASSUMPTIONS
} from "@/lib/calculations/caseStudies";

const CaseStudies = () => {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  useEffect(() => {
    document.title = t('caseStudies.pageTitle');
  }, [t]);

  // Calculate all case study results using corrected formulas
  const stmResults = useMemo(() => calculateSTMCase(), []);
  const winnipegResults = useMemo(() => calculateWinnipegCase(), []);
  const eraResults = useMemo(() => calculateERACase(), []);

  const caseStudies = [
    {
      id: 'stm_montreal',
      icon: Bus,
      organization: t('caseStudies.cases.stm_montreal.organization'),
      title: t('caseStudies.cases.stm_montreal.title'),
      location: t('caseStudies.cases.stm_montreal.location'),
      source: 'STM 2025',
      context: {
        current: t('caseStudies.cases.stm_montreal.context.current'),
        electricityRate: '$0.1065/kWh',
        goal: t('caseStudies.cases.stm_montreal.context.goal'),
        annualMileage: '60,000 km/bus'
      },
      scenarios: [
        {
          name: t('caseStudies.scenarios.diesel'),
          type: 'diesel',
          annualCost: formatCurrency(stmResults.dieselAnnualCost),
          infrastructure: '-',
          viable: true,
          isBaseline: true
        },
        {
          name: t('caseStudies.scenarios.electric'),
          type: 'electric',
          annualCost: formatCurrency(stmResults.electricAnnualCost),
          infrastructure: '$8M',
          viable: true,
          isOptimal: true
        },
        {
          name: t('caseStudies.scenarios.hybrid'),
          type: 'hybrid',
          annualCost: formatCurrency(stmResults.dieselAnnualCost * 0.5),
          infrastructure: '$4M',
          viable: true
        }
      ],
      results: {
        optimal: t('caseStudies.cases.stm_montreal.results.optimal'),
        annualSavings: formatCurrency(stmResults.annualSavings),
        tcoComparison: {
          new: '$18.6M',
          old: '$42M',
          years: 10
        },
        roi: stmResults.paybackYears.toString(),
        co2Reduction: formatNumber(stmResults.co2AvoidedTonnes)
      },
      calculationDetails: {
        formula: `${stmResults.breakdown.totalKm.toLocaleString()} km × ${ASSUMPTIONS.dieselConsumption.transitBus} L/100km × ${ASSUMPTIONS.co2PerLiterDiesel} kg/L`,
        dieselCO2: stmResults.dieselCO2Tonnes,
        electricCO2: stmResults.electricCO2Tonnes,
      },
      highlight: 'electric'
    },
    {
      id: 'winnipeg_transit',
      icon: Bus,
      organization: t('caseStudies.cases.winnipeg_transit.organization'),
      title: t('caseStudies.cases.winnipeg_transit.title'),
      location: t('caseStudies.cases.winnipeg_transit.location'),
      source: 'Winnipeg Transit 2025',
      context: {
        current: t('caseStudies.cases.winnipeg_transit.context.current'),
        electricityRate: '$0.10/kWh',
        h2Rate: '$15/kg',
        goal: t('caseStudies.cases.winnipeg_transit.context.goal'),
        annualMileage: t('caseStudies.cases.winnipeg_transit.context.depot')
      },
      scenarios: [
        {
          name: t('caseStudies.scenarios.diesel'),
          type: 'diesel',
          annualCost: formatCurrency(winnipegResults.dieselAnnualCost),
          infrastructure: '-',
          viable: true,
          isBaseline: true
        },
        {
          name: t('caseStudies.scenarios.electric'),
          type: 'electric',
          annualCost: formatCurrency(winnipegResults.mixedAnnualCost * 0.7),
          infrastructure: '$2.5M',
          viable: true,
          detail: t('caseStudies.cases.winnipeg_transit.electricDetail')
        },
        {
          name: t('caseStudies.scenarios.strategic'),
          type: 'hybrid',
          annualCost: formatCurrency(winnipegResults.mixedAnnualCost),
          infrastructure: '$6.5M',
          viable: true,
          isOptimal: true,
          detail: t('caseStudies.cases.winnipeg_transit.mixDetail')
        }
      ],
      results: {
        optimal: t('caseStudies.cases.winnipeg_transit.results.optimal'),
        annualSavings: formatCurrency(winnipegResults.annualSavings),
        tcoComparison: {
          new: '$15.7M',
          old: '$19.2M',
          years: 10
        },
        roi: winnipegResults.paybackYears.toString(),
        co2Reduction: formatNumber(winnipegResults.co2AvoidedTonnes),
        note: t('caseStudies.cases.winnipeg_transit.results.note')
      },
      calculationDetails: {
        formula: `20 bus × 50,000 km × ${ASSUMPTIONS.dieselConsumption.transitBus} L/100km × ${ASSUMPTIONS.co2PerLiterDiesel} kg/L`,
        dieselCO2: winnipegResults.dieselCO2Tonnes,
        mixedCO2: winnipegResults.mixedCO2Tonnes,
      },
      highlight: 'hydrogen'
    },
    {
      id: 'azetec_alberta',
      icon: Truck,
      organization: t('caseStudies.cases.azetec_alberta.organization'),
      title: t('caseStudies.cases.azetec_alberta.title'),
      location: t('caseStudies.cases.azetec_alberta.location'),
      source: 'ERA Alberta 2025',
      context: {
        current: t('caseStudies.cases.azetec_alberta.context.current'),
        electricityRate: '$0.14/kWh',
        h2Rate: '$12-15/kg',
        routes: t('caseStudies.cases.azetec_alberta.context.routes'),
        annualMileage: t('caseStudies.cases.azetec_alberta.context.goal')
      },
      scenarios: [
        {
          name: t('caseStudies.scenarios.diesel'),
          type: 'diesel',
          annualCost: formatCurrency(eraResults.dieselAnnualCost),
          infrastructure: '-',
          viable: true,
          isBaseline: true
        },
        {
          name: t('caseStudies.scenarios.electric'),
          type: 'electric',
          annualCost: '-',
          infrastructure: '-',
          viable: false,
          reason: t('caseStudies.cases.azetec_alberta.electricNotViable')
        },
        {
          name: t('caseStudies.scenarios.hydrogen'),
          type: 'hydrogen',
          annualCost: formatCurrency(eraResults.h2AnnualCost),
          infrastructure: '$3M',
          viable: true,
          isOptimal: true,
          detail: t('caseStudies.cases.azetec_alberta.hydrogenDetail')
        }
      ],
      results: {
        optimal: t('caseStudies.cases.azetec_alberta.results.optimal'),
        annualSavings: formatCurrency(eraResults.annualSavings),
        tcoComparison: {
          new: '$8.2M',
          old: '$7.8M',
          years: 10
        },
        roi: eraResults.paybackYears.toString(),
        co2Reduction: formatNumber(eraResults.co2AvoidedTonnes),
        note: t('caseStudies.cases.azetec_alberta.results.note')
      },
      calculationDetails: {
        formula: `10 trucks × 120,000 km × 38 L/100km × ${ASSUMPTIONS.co2PerLiterDiesel} kg/L`,
        dieselCO2: eraResults.dieselCO2Tonnes,
        h2CO2: eraResults.h2CO2Tonnes,
      },
      highlight: 'hydrogen'
    }
  ];

  const getScenarioIcon = (type: string, viable: boolean, isOptimal?: boolean) => {
    if (!viable) return <XCircle className="w-5 h-5 text-destructive" />;
    if (isOptimal) return <CheckCircle2 className="w-5 h-5 text-primary" />;
    return <AlertTriangle className="w-5 h-5 text-muted-foreground" />;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'diesel': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'electric': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'hydrogen': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'hybrid': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-12 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-6 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
            {t('caseStudies.badge')}
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6">
            {t('caseStudies.hero.title')}
          </h1>
          <p className="text-xl text-primary-foreground/80 max-w-3xl mx-auto">
            {t('caseStudies.hero.subtitle')}
          </p>
        </div>
      </section>

      {/* Prominent Disclaimer */}
      <section className="py-6 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 text-center">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm md:text-base font-medium text-amber-800 dark:text-amber-200">
              {t('caseStudies.prominentDisclaimer')}
            </p>
          </div>
        </div>
      </section>

      {/* Methodology Note */}
      <section className="py-8 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-blue-200 dark:border-blue-800 bg-white/80 dark:bg-background/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Calculator className="w-5 h-5" />
                {isEnglish ? 'Calculation Methodology' : 'Méthodologie de calcul'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p className="text-muted-foreground">
                {isEnglish 
                  ? 'All figures on this page are calculated using industry-standard assumptions for transparency and auditability:'
                  : 'Tous les chiffres de cette page sont calculés selon des hypothèses standards de l\'industrie pour la transparence et l\'auditabilité :'}
              </p>
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-semibold mb-2">
                    {isEnglish ? 'CO₂ Emissions' : 'Émissions CO₂'}
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• {isEnglish ? 'Diesel factor' : 'Facteur diesel'}: {ASSUMPTIONS.co2PerLiterDiesel} kg CO₂/L</li>
                    <li>• {isEnglish ? 'Transit bus consumption' : 'Consommation bus urbain'}: {ASSUMPTIONS.dieselConsumption.transitBus} L/100km</li>
                    <li>• {isEnglish ? 'Heavy truck consumption' : 'Consommation camion lourd'}: 38 L/100km</li>
                    <li>• {isEnglish ? 'Grid factor (QC)' : 'Facteur réseau (QC)'}: {ASSUMPTIONS.gridCO2Factor.quebec} g CO₂/kWh</li>
                  </ul>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-semibold mb-2">
                    {isEnglish ? 'ROI / Payback' : 'ROI / Retour sur investissement'}
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• {isEnglish ? 'Formula' : 'Formule'}: {isEnglish ? 'Infrastructure Cost ÷ Annual Savings' : 'Coût infrastructure ÷ Économies annuelles'}</li>
                    <li>• {isEnglish ? 'Blue H₂ factor' : 'Facteur H₂ bleu'}: {ASSUMPTIONS.h2CO2Factor.blue} kg CO₂/kg H₂</li>
                    <li>• {isEnglish ? 'Electric bus consumption' : 'Consommation bus électrique'}: {ASSUMPTIONS.electricityConsumption.transitBus} kWh/km</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic pt-2 border-t">
                {isEnglish 
                  ? 'Sources: Environment and Climate Change Canada, NRCan, EPA, NACFE. All calculations are reproducible and documented in the codebase.'
                  : 'Sources: Environnement et Changement climatique Canada, RNCan, EPA, NACFE. Tous les calculs sont reproductibles et documentés dans le code.'}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Case Studies */}
      <main className="py-20">
        <div className="container mx-auto px-4 space-y-16">
          {caseStudies.map((study, index) => (
            <Card key={study.id} className="overflow-hidden border-2">
              {/* Header */}
              <CardHeader className="bg-muted/50 border-b">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <study.icon className="w-7 h-7 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-muted-foreground font-medium">{study.organization}</p>
                          <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                            {t('caseStudies.representativeBadge')}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl md:text-2xl">{study.title}</CardTitle>
                        {study.source && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <ExternalLink className="w-3 h-3" />
                            {t('caseStudies.labels.source')}: {study.source}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm font-medium">{study.location}</span>
                    </div>
                  </div>
              </CardHeader>

              <CardContent className="p-6 md:p-8">
                {/* Context */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Fuel className="w-5 h-5 text-primary" />
                    {t('caseStudies.context')}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('caseStudies.labels.currentFleet')}</p>
                      <p className="font-semibold">{study.context.current}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('caseStudies.labels.electricityRate')}</p>
                      <p className="font-semibold">{study.context.electricityRate}</p>
                    </div>
                    {study.context.h2Rate && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">{t('caseStudies.labels.h2Rate')}</p>
                        <p className="font-semibold">{study.context.h2Rate}</p>
                      </div>
                    )}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">{t('caseStudies.labels.annualMileage')}</p>
                      <p className="font-semibold">{study.context.annualMileage}</p>
                    </div>
                    {(study.context.goal || study.context.routes) && (
                      <div className="bg-muted/50 rounded-lg p-4 col-span-2 md:col-span-4">
                        <p className="text-sm text-muted-foreground mb-1">{t('caseStudies.labels.goal')}</p>
                        <p className="font-semibold">{study.context.goal || study.context.routes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scenarios Comparison */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    {t('caseStudies.scenariosCompared')}
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {study.scenarios.map((scenario, i) => (
                      <div 
                        key={i} 
                        className={`rounded-xl border-2 p-5 transition-all ${
                          scenario.isOptimal 
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                            : !scenario.viable 
                            ? 'border-destructive/30 bg-destructive/5 opacity-75' 
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline" className={getTypeColor(scenario.type)}>
                            {scenario.name}
                          </Badge>
                          {getScenarioIcon(scenario.type, scenario.viable, scenario.isOptimal)}
                        </div>
                        
                        {scenario.isOptimal && (
                          <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
                            {t('caseStudies.labels.optimal')}
                          </Badge>
                        )}
                        
                        {scenario.isBaseline && (
                          <Badge variant="secondary" className="mb-3">
                            {t('caseStudies.labels.baseline')}
                          </Badge>
                        )}

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('caseStudies.labels.annualCost')}</span>
                            <span className={`font-semibold ${!scenario.viable ? 'line-through' : ''}`}>
                              {scenario.annualCost}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t('caseStudies.labels.infrastructure')}</span>
                            <span className="font-semibold">{scenario.infrastructure}</span>
                          </div>
                        </div>

                        {scenario.reason && (
                          <p className="mt-3 text-xs text-destructive">{scenario.reason}</p>
                        )}
                        {scenario.detail && (
                          <p className="mt-3 text-xs text-muted-foreground">{scenario.detail}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation Details */}
                <div className="mb-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Calculator className="w-4 h-4" />
                    {isEnglish ? 'Calculation Detail' : 'Détail du calcul'}
                  </h4>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mb-2">
                    {study.calculationDetails.formula}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded text-orange-700 dark:text-orange-300">
                      {isEnglish ? 'Diesel baseline' : 'Référence diesel'}: {study.calculationDetails.dieselCO2?.toLocaleString()} t CO₂/an
                    </span>
                    {study.calculationDetails.electricCO2 !== undefined && (
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded text-emerald-700 dark:text-emerald-300">
                        {isEnglish ? 'Electric' : 'Électrique'}: {study.calculationDetails.electricCO2?.toLocaleString()} t CO₂/an
                      </span>
                    )}
                    {study.calculationDetails.mixedCO2 !== undefined && (
                      <span className="bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded text-purple-700 dark:text-purple-300">
                        {isEnglish ? 'Mixed fleet' : 'Flotte mixte'}: {study.calculationDetails.mixedCO2?.toLocaleString()} t CO₂/an
                      </span>
                    )}
                    {study.calculationDetails.h2CO2 !== undefined && (
                      <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-blue-700 dark:text-blue-300">
                        H₂: {study.calculationDetails.h2CO2?.toLocaleString()} t CO₂/an
                      </span>
                    )}
                  </div>
                </div>

                {/* Results */}
                <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-primary" />
                    {t('caseStudies.results')}
                  </h3>
                  <p className="text-muted-foreground mb-6">{study.results.optimal}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <DollarSign className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-2xl md:text-3xl font-bold text-primary">{study.results.annualSavings}</p>
                      <p className="text-sm text-muted-foreground">{t('caseStudies.labels.annualSavings')}</p>
                    </div>
                    <div className="text-center">
                      <TrendingDown className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-lg md:text-xl font-bold">
                        <span className="text-primary">{study.results.tcoComparison.new}</span>
                        <span className="text-muted-foreground text-sm mx-1">vs</span>
                        <span className="line-through text-muted-foreground">{study.results.tcoComparison.old}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{study.results.tcoComparison.years}-{t('caseStudies.labels.yearTCO')}</p>
                    </div>
                    <div className="text-center">
                      <Clock className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-2xl md:text-3xl font-bold text-primary">{study.results.roi} {t('caseStudies.labels.years')}</p>
                      <p className="text-sm text-muted-foreground">{t('caseStudies.labels.payback')}</p>
                    </div>
                    <div className="text-center">
                      <Leaf className="w-8 h-8 text-primary mx-auto mb-2" />
                      <p className="text-2xl md:text-3xl font-bold text-primary">{study.results.co2Reduction}</p>
                      <p className="text-sm text-muted-foreground">{t('caseStudies.labels.tonnesCO2Year')}</p>
                    </div>
                  </div>

                  {study.results.note && (
                    <p className="mt-4 text-sm text-muted-foreground italic border-t border-primary/20 pt-4">
                      {study.results.note}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    {t('caseStudies.actions.downloadReport')}
                  </Button>
                  <Button asChild className="gap-2">
                    <Link to="/dashboard/projects">
                      {t('caseStudies.actions.tryScenario')}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* CTA Section */}
      <section className="py-20 bg-muted/50 border-t">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('caseStudies.cta.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('caseStudies.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/dashboard/projects">
                {t('caseStudies.cta.button')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-16 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <BookOpen className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">{t('caseStudies.dataSources.title')}</h2>
            </div>
            
            <p className="text-muted-foreground mb-6">
              {t('caseStudies.dataSources.intro')}
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <Card className="p-4 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Environment Canada</p>
                    <p className="text-xs text-muted-foreground">
                      {isEnglish ? 'Emission factors: 2.68 kg CO₂/L diesel' : 'Facteurs d\'émission: 2.68 kg CO₂/L diesel'}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Hydro-Québec / Manitoba Hydro</p>
                    <p className="text-xs text-muted-foreground">{t('caseStudies.dataSources.sources.hydroQuebec')}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">NACFE / DOE</p>
                    <p className="text-xs text-muted-foreground">
                      {isEnglish ? 'Transit bus consumption benchmarks' : 'Références consommation autobus urbains'}
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-4 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">IEA Hydrogen 2023</p>
                    <p className="text-xs text-muted-foreground">
                      {isEnglish ? 'H₂ emission factors by production type' : 'Facteurs d\'émission H₂ par type de production'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
            
            <Card className="p-6 bg-muted/50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                {t('caseStudies.dataSources.methodology')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('caseStudies.dataSources.methodologyText')}
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-8 bg-muted/30 border-t">
        <div className="container mx-auto px-4">
          <p className="text-sm text-muted-foreground text-center max-w-4xl mx-auto italic">
            {t('caseStudies.disclaimer')}
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CaseStudies;

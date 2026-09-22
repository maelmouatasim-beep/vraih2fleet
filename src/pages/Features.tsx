import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Truck, 
  BarChart3, 
  Zap, 
  Calendar, 
  FileText, 
  Database,
  Calculator,
  Leaf,
  TrendingDown,
  Shield,
  Globe,
  Layers,
  Radio,
  Coins,
  TrendingUp,
  Bot,
  CheckSquare
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import DemoRequestModal from "@/components/landing/DemoRequestModal";
import { useEffect } from 'react';

const Features = () => {
  const { t } = useTranslation();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  useEffect(() => {
    document.title = `${t('pages.features.title')} | H2Fleet Planner`;
  }, [t]);

  const mainFeatures = [
    {
      icon: Calculator,
      titleKey: "pages.features.mainFeatures.tcoCalculator.title",
      descriptionKey: "pages.features.mainFeatures.tcoCalculator.description",
      detailsKey: "pages.features.mainFeatures.tcoCalculator.details",
      color: "bg-chart-ev/10 text-chart-ev",
    },
    {
      icon: Layers,
      titleKey: "pages.features.mainFeatures.scenarioManagement.title",
      descriptionKey: "pages.features.mainFeatures.scenarioManagement.description",
      detailsKey: "pages.features.mainFeatures.scenarioManagement.details",
      color: "bg-chart-h2/10 text-chart-h2",
    },
    {
      icon: Zap,
      titleKey: "pages.features.mainFeatures.infrastructure.title",
      descriptionKey: "pages.features.mainFeatures.infrastructure.description",
      detailsKey: "pages.features.mainFeatures.infrastructure.details",
      color: "bg-chart-mixed/10 text-chart-mixed",
    },
    {
      icon: Calendar,
      titleKey: "pages.features.mainFeatures.roadmap.title",
      descriptionKey: "pages.features.mainFeatures.roadmap.description",
      detailsKey: "pages.features.mainFeatures.roadmap.details",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Leaf,
      titleKey: "pages.features.mainFeatures.co2Analysis.title",
      descriptionKey: "pages.features.mainFeatures.co2Analysis.description",
      detailsKey: "pages.features.mainFeatures.co2Analysis.details",
      color: "bg-accent/10 text-accent",
    },
    {
      icon: FileText,
      titleKey: "pages.features.mainFeatures.reports.title",
      descriptionKey: "pages.features.mainFeatures.reports.description",
      detailsKey: "pages.features.mainFeatures.reports.details",
      color: "bg-chart-diesel/10 text-chart-diesel",
    },
  ];

  const additionalFeatures = [
    {
      icon: Truck,
      titleKey: "landing.features.modeling.title",
      descriptionKey: "landing.features.modeling.description",
      color: "bg-chart-diesel/10 text-chart-diesel",
    },
    {
      icon: Database,
      titleKey: "landing.features.data.title",
      descriptionKey: "landing.features.data.description",
      color: "bg-accent/10 text-accent",
    },
    {
      icon: Radio,
      titleKey: "pages.features.additionalFeatures.telematics.title",
      descriptionKey: "pages.features.additionalFeatures.telematics.description",
      color: "bg-chart-ev/10 text-chart-ev",
    },
    {
      icon: Coins,
      titleKey: "pages.features.additionalFeatures.subsidies.title",
      descriptionKey: "pages.features.additionalFeatures.subsidies.description",
      color: "bg-chart-h2/10 text-chart-h2",
    },
    {
      icon: TrendingUp,
      titleKey: "pages.features.additionalFeatures.analytics.title",
      descriptionKey: "pages.features.additionalFeatures.analytics.description",
      color: "bg-chart-mixed/10 text-chart-mixed",
    },
    {
      icon: Bot,
      titleKey: "pages.features.additionalFeatures.assistant.title",
      descriptionKey: "pages.features.additionalFeatures.assistant.description",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: CheckSquare,
      titleKey: "pages.features.additionalFeatures.tasks.title",
      descriptionKey: "pages.features.additionalFeatures.tasks.description",
      color: "bg-chart-ev/10 text-chart-ev",
    },
    {
      icon: Globe,
      titleKey: "pages.features.additionalFeatures.multiRegion.title",
      descriptionKey: "pages.features.additionalFeatures.multiRegion.description",
      color: "bg-primary/10 text-primary",
    },
  ];

  const benefits = [
    {
      icon: TrendingDown,
      titleKey: "pages.features.benefits.costReduction.title",
      descriptionKey: "pages.features.benefits.costReduction.description",
    },
    {
      icon: Shield,
      titleKey: "pages.features.benefits.riskMitigation.title",
      descriptionKey: "pages.features.benefits.riskMitigation.description",
    },
    {
      icon: Leaf,
      titleKey: "pages.features.benefits.sustainability.title",
      descriptionKey: "pages.features.benefits.sustainability.description",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              {t('pages.features.badge')}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              {t('pages.features.hero.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('pages.features.hero.subtitle')}
            </p>
            <div className="flex justify-center">
              <Button size="lg" className="text-lg px-8" onClick={() => setIsDemoModalOpen(true)}>
                {t('pages.features.hero.cta.start')}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Features Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('pages.features.mainFeatures.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('pages.features.mainFeatures.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mainFeatures.map((feature) => (
              <Card 
                key={feature.titleKey}
                className="group relative overflow-hidden border-border/50 bg-card hover:shadow-xl transition-all duration-300"
              >
                <CardContent className="p-8">
                  <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110`}>
                    <feature.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-semibold text-foreground mb-3">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-muted-foreground mb-4 text-lg">
                    {t(feature.descriptionKey)}
                  </p>
                  <ul className="space-y-2 text-muted-foreground">
                    {(() => {
                      const details = t(feature.detailsKey, { returnObjects: true });
                      if (Array.isArray(details)) {
                        return details.map((detail: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{detail}</span>
                          </li>
                        ));
                      }
                      return null;
                    })()}
                  </ul>
                </CardContent>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('pages.features.additionalFeatures.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('pages.features.additionalFeatures.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {additionalFeatures.map((feature) => (
              <Card 
                key={feature.titleKey}
                className="group border-border/50 bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-muted-foreground">
                    {t(feature.descriptionKey)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('pages.features.benefits.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('pages.features.benefits.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div key={benefit.titleKey} className="text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <benefit.icon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {t(benefit.titleKey)}
                </h3>
                <p className="text-muted-foreground">
                  {t(benefit.descriptionKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t('pages.features.cta.title')}
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            {t('pages.features.cta.subtitle')}
          </p>
          <div className="flex justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8" onClick={() => setIsDemoModalOpen(true)}>
              {t('pages.features.cta.start')}
            </Button>
          </div>
        </div>
      </section>

      <Footer />
      <DemoRequestModal open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen} />
    </div>
  );
};

export default Features;

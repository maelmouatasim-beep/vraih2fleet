import { useTranslation } from 'react-i18next';
import { 
  Truck, 
  BarChart3, 
  Zap, 
  Calendar, 
  FileText, 
  Database,
  ArrowRight,
  Radio,
  Banknote,
  Building2,
  TrendingUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const Features = () => {
  const { t } = useTranslation();

  const features = [
    {
      icon: Truck,
      titleKey: "landing.features.modeling.title",
      descriptionKey: "landing.features.modeling.description",
      color: "bg-chart-diesel/15 text-chart-diesel",
      borderColor: "group-hover:border-chart-diesel/30",
    },
    {
      icon: BarChart3,
      titleKey: "landing.features.tco.title",
      descriptionKey: "landing.features.tco.description",
      color: "bg-chart-ev/15 text-chart-ev",
      borderColor: "group-hover:border-chart-ev/30",
    },
    {
      icon: Zap,
      titleKey: "landing.features.energy.title",
      descriptionKey: "landing.features.energy.description",
      color: "bg-chart-h2/15 text-chart-h2",
      borderColor: "group-hover:border-chart-h2/30",
    },
    {
      icon: Calendar,
      titleKey: "landing.features.planning.title",
      descriptionKey: "landing.features.planning.description",
      color: "bg-chart-mixed/15 text-chart-mixed",
      borderColor: "group-hover:border-chart-mixed/30",
    },
    {
      icon: FileText,
      titleKey: "landing.features.reports.title",
      descriptionKey: "landing.features.reports.description",
      color: "bg-primary/15 text-primary",
      borderColor: "group-hover:border-primary/30",
    },
    {
      icon: Database,
      titleKey: "landing.features.data.title",
      descriptionKey: "landing.features.data.description",
      color: "bg-accent/15 text-accent",
      borderColor: "group-hover:border-accent/30",
    },
    {
      icon: Radio,
      titleKey: "landing.features.telematics.title",
      descriptionKey: "landing.features.telematics.description",
      color: "bg-chart-diesel/15 text-chart-diesel",
      borderColor: "group-hover:border-chart-diesel/30",
    },
    {
      icon: Banknote,
      titleKey: "landing.features.subsidies.title",
      descriptionKey: "landing.features.subsidies.description",
      color: "bg-chart-ev/15 text-chart-ev",
      borderColor: "group-hover:border-chart-ev/30",
    },
    {
      icon: Building2,
      titleKey: "landing.features.infrastructure.title",
      descriptionKey: "landing.features.infrastructure.description",
      color: "bg-chart-h2/15 text-chart-h2",
      borderColor: "group-hover:border-chart-h2/30",
    },
    {
      icon: TrendingUp,
      titleKey: "landing.features.analytics.title",
      descriptionKey: "landing.features.analytics.description",
      color: "bg-chart-mixed/15 text-chart-mixed",
      borderColor: "group-hover:border-chart-mixed/30",
    },
  ];

  return (
    <section id="features" className="py-20 md:py-28 bg-background scroll-mt-20">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            {t('landing.features.badge')}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 md:mb-6">
            {t('landing.features.title')}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {t('landing.features.subtitle')}
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {features.map((feature, index) => (
            <Card 
              key={feature.titleKey}
              className={`group relative overflow-hidden border border-border/60 bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1.5 ${feature.borderColor}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6 md:p-7">
                <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}>
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-muted-foreground mb-5 leading-relaxed">
                  {t(feature.descriptionKey)}
                </p>
                <div className="flex items-center text-primary font-semibold text-sm group-hover:gap-2 transition-all">
                  <span>{t('landing.features.learnMore')}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </div>
              </CardContent>
              
              {/* Decorative gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;

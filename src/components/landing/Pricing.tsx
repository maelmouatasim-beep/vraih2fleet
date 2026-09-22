import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import DemoRequestModal from './DemoRequestModal';

const Pricing = () => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const { t } = useTranslation();

  const plans = [
    {
      nameKey: "landing.pricing.plans.small.name",
      fleetSizeKey: "landing.pricing.plans.small.fleetSize",
      price: 799,
      descriptionKey: "landing.pricing.plans.small.description",
      featuresKey: "landing.pricing.plans.small.features",
      ctaKey: "landing.pricing.plans.small.cta",
      popular: false,
    },
    {
      nameKey: "landing.pricing.plans.medium.name",
      fleetSizeKey: "landing.pricing.plans.medium.fleetSize",
      price: 2499,
      descriptionKey: "landing.pricing.plans.medium.description",
      featuresKey: "landing.pricing.plans.medium.features",
      ctaKey: "landing.pricing.plans.medium.cta",
      popular: true,
    },
    {
      nameKey: "landing.pricing.plans.large.name",
      fleetSizeKey: "landing.pricing.plans.large.fleetSize",
      price: 4999,
      descriptionKey: "landing.pricing.plans.large.description",
      featuresKey: "landing.pricing.plans.large.features",
      ctaKey: "landing.pricing.plans.large.cta",
      popular: false,
    },
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {t('landing.pricing.badge')}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.pricing.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('landing.pricing.subtitle')}
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const features = t(plan.featuresKey, { returnObjects: true }) as string[];
            return (
              <Card 
                key={plan.nameKey}
                className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular 
                    ? "border-primary shadow-lg shadow-primary/10 scale-105" 
                    : "border-border/50 hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 px-4 py-1 gradient-hero text-primary-foreground text-xs font-semibold rounded-bl-lg">
                    {t('landing.pricing.popular')}
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <h3 className="text-xl font-semibold text-foreground">{t(plan.nameKey)}</h3>
                  
                  {/* Fleet size badge */}
                  <div className="flex items-center gap-2 mt-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {t(plan.fleetSizeKey)}
                    </span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-2">{t(plan.descriptionKey)}</p>
                  
                  {/* Price display */}
                  <div className="mt-4 space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">${plan.price.toLocaleString()}</span>
                      <span className="text-muted-foreground">{t('landing.pricing.perMonth')}</span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {features.map((feature: string) => (
                      <li key={feature} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-accent" />
                        </div>
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                    onClick={() => setIsDemoModalOpen(true)}
                  >
                    {t(plan.ctaKey)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional info */}
        <p className="text-center text-sm text-muted-foreground mt-8 max-w-2xl mx-auto">
          {t('landing.pricing.note')}
        </p>
      </div>
      <DemoRequestModal open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen} />
    </section>
  );
};
export default Pricing;
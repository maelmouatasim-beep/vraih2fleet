import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from "lucide-react";

const HowItWorks = () => {
  const { t } = useTranslation();

  const steps = [
    {
      number: "01",
      titleKey: "landing.howItWorks.steps.step1.title",
      descriptionKey: "landing.howItWorks.steps.step1.description",
      featuresKey: "landing.howItWorks.steps.step1.features",
    },
    {
      number: "02",
      titleKey: "landing.howItWorks.steps.step2.title",
      descriptionKey: "landing.howItWorks.steps.step2.description",
      featuresKey: "landing.howItWorks.steps.step2.features",
    },
    {
      number: "03",
      titleKey: "landing.howItWorks.steps.step3.title",
      descriptionKey: "landing.howItWorks.steps.step3.description",
      featuresKey: "landing.howItWorks.steps.step3.features",
    },
    {
      number: "04",
      titleKey: "landing.howItWorks.steps.step4.title",
      descriptionKey: "landing.howItWorks.steps.step4.description",
      featuresKey: "landing.howItWorks.steps.step4.features",
    },
  ];

  return (
    <section className="py-24 bg-secondary/50">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            {t('landing.howItWorks.badge')}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('landing.howItWorks.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('landing.howItWorks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const features = t(step.featuresKey, { returnObjects: true }) as string[];
            return (
              <div 
                key={step.number}
                className={`relative flex flex-col md:flex-row gap-8 md:gap-12 ${
                  index !== steps.length - 1 ? "pb-12 md:pb-16" : ""
                }`}
              >
                {/* Connector line */}
                {index !== steps.length - 1 && (
                  <div className="hidden md:block absolute left-[39px] top-20 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/20" />
                )}

                {/* Step number */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl gradient-hero flex items-center justify-center shadow-lg shadow-primary/20">
                    <span className="text-2xl font-bold text-primary-foreground">{step.number}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-card rounded-2xl p-6 md:p-8 shadow-sm border border-border/50">
                  <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-3">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {t(step.descriptionKey)}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {features.map((feature: string) => (
                      <div 
                        key={feature}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

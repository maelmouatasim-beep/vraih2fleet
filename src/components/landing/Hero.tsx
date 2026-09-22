import { useState } from "react";
import { ArrowRight, Calculator, Leaf, Lightbulb, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DemoRequestModal from './DemoRequestModal';

const Hero = () => {
  const { t } = useTranslation();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
        {/* Background with gradient */}
        <div className="absolute inset-0 gradient-hero" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-32 right-10 w-72 h-72 bg-primary-foreground/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-40 left-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-foreground/5 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        <div className="container relative z-10 mx-auto px-4 py-12 md:py-16">
          <div className="max-w-4xl mx-auto text-center">
            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 md:mb-8 animate-slide-up opacity-0 text-balance leading-tight">
              {t('landing.hero.title')}{" "}
              <span className="relative inline-block">
                <span className="relative z-10">{t('landing.hero.titleHighlight1')}</span>
                <span className="absolute bottom-1 md:bottom-2 left-0 w-full h-2 md:h-3 bg-primary-foreground/30 -skew-x-3" />
              </span>{" "}
              {t('landing.hero.and')}{" "}
              <span className="relative inline-block">
                <span className="relative z-10">{t('landing.hero.titleHighlight2')}</span>
                <span className="absolute bottom-1 md:bottom-2 left-0 w-full h-2 md:h-3 bg-primary-foreground/30 -skew-x-3" />
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-primary-foreground/90 mb-10 md:mb-12 max-w-2xl mx-auto animate-slide-up opacity-0 stagger-1 leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 md:mb-16 animate-slide-up opacity-0 stagger-2">
              <Button 
                variant="hero" 
                size="xl" 
                className="shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 hover:-translate-y-0.5"
                onClick={() => setIsDemoModalOpen(true)}
              >
                {t('landing.hero.cta.start')}
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto animate-slide-up opacity-0 stagger-3">
              <div className="flex flex-col items-center p-5 md:p-6 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 hover:bg-primary-foreground/15 transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center mb-3">
                  <Calculator className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-base md:text-lg font-bold text-primary-foreground text-center">{t('landing.hero.benefits.tco.title')}</span>
                <span className="text-sm text-primary-foreground/80 text-center mt-1">{t('landing.hero.benefits.tco.description')}</span>
              </div>
              <div className="flex flex-col items-center p-5 md:p-6 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 hover:bg-primary-foreground/15 transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center mb-3">
                  <Leaf className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-base md:text-lg font-bold text-primary-foreground text-center">{t('landing.hero.benefits.emissions.title')}</span>
                <span className="text-sm text-primary-foreground/80 text-center mt-1">{t('landing.hero.benefits.emissions.description')}</span>
              </div>
              <div className="flex flex-col items-center p-5 md:p-6 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20 hover:bg-primary-foreground/15 transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center mb-3">
                  <Lightbulb className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-base md:text-lg font-bold text-primary-foreground text-center">{t('landing.hero.benefits.decisions.title')}</span>
                <span className="text-sm text-primary-foreground/80 text-center mt-1">{t('landing.hero.benefits.decisions.description')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <button 
          onClick={scrollToFeatures}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-primary-foreground/60 hover:text-primary-foreground transition-colors cursor-pointer animate-bounce"
          aria-label="Scroll to features"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </section>

      <DemoRequestModal 
        open={isDemoModalOpen} 
        onOpenChange={setIsDemoModalOpen} 
      />
    </>
  );
};

export default Hero;

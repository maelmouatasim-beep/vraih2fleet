import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Shield, Clock, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

import DemoRequestModal from './DemoRequestModal';

const CTA = () => {
  const { t } = useTranslation();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <>
      <section className="py-24 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 gradient-dark" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6">
              {t('landing.cta.title')}
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/70 mb-10 max-w-2xl mx-auto">
              {t('landing.cta.subtitle')}
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                variant="hero" 
                size="xl"
                onClick={() => setIsDemoModalOpen(true)}
              >
                {t('landing.cta.createAccount')}
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="xl" 
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setIsDemoModalOpen(true)}
              >
                {t('landing.cta.requestDemo')}
              </Button>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2 text-primary-foreground/70">
                <Shield className="w-5 h-5" />
                <span className="text-sm">{t('landing.cta.trust.secure')}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-primary-foreground/70">
                <Clock className="w-5 h-5" />
                <span className="text-sm">{t('landing.cta.trust.trial')}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-primary-foreground/70">
                <HeadphonesIcon className="w-5 h-5" />
                <span className="text-sm">{t('landing.cta.trust.support')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DemoRequestModal 
        open={isDemoModalOpen} 
        onOpenChange={setIsDemoModalOpen} 
      />
    </>
  );
};

export default CTA;

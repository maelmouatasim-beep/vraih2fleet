import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Target, 
  Eye, 
  Heart, 
  Leaf, 
  Users, 
  Lightbulb,
  Globe,
  TrendingUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import DemoRequestModal from "@/components/landing/DemoRequestModal";
import { useEffect } from 'react';

const About = () => {
  const { t } = useTranslation();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  useEffect(() => {
    document.title = `${t('pages.about.title')} | H2Fleet Planner`;
  }, [t]);

  const values = [
    {
      icon: Leaf,
      titleKey: "pages.about.values.sustainability.title",
      descriptionKey: "pages.about.values.sustainability.description",
      color: "bg-accent/10 text-accent",
    },
    {
      icon: Lightbulb,
      titleKey: "pages.about.values.innovation.title",
      descriptionKey: "pages.about.values.innovation.description",
      color: "bg-chart-ev/10 text-chart-ev",
    },
    {
      icon: Users,
      titleKey: "pages.about.values.collaboration.title",
      descriptionKey: "pages.about.values.collaboration.description",
      color: "bg-chart-h2/10 text-chart-h2",
    },
    {
      icon: Heart,
      titleKey: "pages.about.values.transparency.title",
      descriptionKey: "pages.about.values.transparency.description",
      color: "bg-primary/10 text-primary",
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
              {t('pages.about.badge')}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              {t('pages.about.hero.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('pages.about.hero.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 bg-background overflow-x-clip">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                {t('pages.about.mission.title')}
              </h2>
              <p className="text-lg text-muted-foreground mb-4">
                {t('pages.about.mission.description1')}
              </p>
              <p className="text-lg text-muted-foreground">
                {t('pages.about.mission.description2')}
              </p>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Globe className="w-32 h-32 text-primary/50" />
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-2xl bg-accent/20 flex items-center justify-center">
                <Leaf className="w-16 h-16 text-accent/50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <div className="order-2 lg:order-1 relative">
              <div className="aspect-square rounded-3xl bg-gradient-to-br from-accent/20 to-chart-ev/20 flex items-center justify-center">
                <TrendingUp className="w-32 h-32 text-accent/50" />
              </div>
              <div className="absolute -top-6 -left-6 w-32 h-32 rounded-2xl bg-chart-h2/20 flex items-center justify-center">
                <Eye className="w-16 h-16 text-chart-h2/50" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                <Eye className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                {t('pages.about.vision.title')}
              </h2>
              <p className="text-lg text-muted-foreground mb-4">
                {t('pages.about.vision.description1')}
              </p>
              <p className="text-lg text-muted-foreground">
                {t('pages.about.vision.description2')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t('pages.about.values.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('pages.about.values.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((value) => (
              <Card 
                key={value.titleKey}
                className="group border-border/50 bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-center"
              >
                <CardContent className="p-6">
                  <div className={`w-16 h-16 rounded-2xl ${value.color} flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110`}>
                    <value.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {t(value.titleKey)}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {t(value.descriptionKey)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t('pages.about.cta.title')}
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            {t('pages.about.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8" onClick={() => setIsDemoModalOpen(true)}>
              {t('pages.about.cta.start')}
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/contact">{t('pages.about.cta.contact')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
      <DemoRequestModal open={isDemoModalOpen} onOpenChange={setIsDemoModalOpen} />
    </div>
  );
};

export default About;

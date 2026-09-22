import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import DemoRequestModal from "@/components/landing/DemoRequestModal";
import { BookOpen, ArrowRight, Clock } from "lucide-react";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { guideCategories, processGuides } from "@/data/guidesData";

const Guides = () => {
  const { t } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    document.title = `${t("guides.pageTitle", "Practical Guides")} - H2Fleet Planner`;
  }, [t]);

  // Helper to get category title/description with fallback
  const getCategoryTitle = (categoryId: string): string => {
    const fallbacks: Record<string, string> = {
      technology: "By Technology",
      sector: "By Industry Sector",
      process: "Process Guides"
    };
    return t(`guides.categories.${categoryId}`, fallbacks[categoryId] || categoryId);
  };

  const getCategoryDesc = (categoryId: string): string => {
    const fallbacks: Record<string, string> = {
      technology: "Choose the right solution: battery electric, hydrogen or biomethane vehicles",
      sector: "Recommendations tailored to your type of operation",
      process: "Complete step-by-step guides for planning, funding, and operating your electric fleet"
    };
    return t(`guides.categories.${categoryId}Desc`, fallbacks[categoryId] || "");
  };

  // Helper to get guide translations with fallbacks
  const getGuideTitle = (guideId: string): string => {
    const fallbacks: Record<string, string> = {
      bev: "Battery Electric Vehicles (BEV)",
      fcev: "Hydrogen Fuel Cell Vehicles (FCEV)",
      biomethane: "Biomethane / RNG",
      urban: "Urban Delivery",
      regional: "Regional Transport",
      longhaul: "Long-Haul Trucking",
      planning: "Transition Planning Guide",
      funding: "Funding & Subsidies Guide",
      operations: "Operations Management Guide"
    };
    return t(`guides.${guideId}.title`, fallbacks[guideId] || guideId);
  };

  const getGuideDescription = (guideId: string): string => {
    const fallbacks: Record<string, string> = {
      bev: "Battery electric vehicles are the most mature solution for fleet electrification.",
      fcev: "Hydrogen fuel cell vehicles offer unique advantages for long-distance heavy transport.",
      biomethane: "Renewable natural gas offers an immediate emissions reduction path.",
      urban: "Electrification strategies for urban delivery fleets with short, frequent routes",
      regional: "Recommendations for fleets operating medium distances (200-500 km)",
      longhaul: "Solutions for long-distance heavy transport: hydrogen, biomethane and future BEV prospects",
      planning: "A detailed month-by-month timeline for fleet electrification from audit to full deployment",
      funding: "Complete overview of Canadian federal and provincial programs for fleet electrification",
      operations: "Best practices for route optimization, energy management, and fleet monitoring"
    };
    return t(`guides.${guideId}.description`, fallbacks[guideId] || "");
  };

  const getGuideReadTime = (guideId: string): string => {
    const fallbacks: Record<string, string> = {
      bev: "15 min read",
      fcev: "12 min read",
      biomethane: "8 min read",
      urban: "10 min read",
      regional: "12 min read",
      longhaul: "15 min read",
      planning: "25 min read",
      funding: "20 min read",
      operations: "15 min read"
    };
    return t(`guides.${guideId}.readTime`, fallbacks[guideId] || "10 min read");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <BookOpen className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t("guides.title", "Practical Guides")}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t("guides.subtitle", "Step-by-step tutorials to help you electrify your fleet with confidence")}
            </p>
          </div>

          {/* Technology & Sector Guides */}
          {guideCategories.slice(0, 2).map((category) => (
            <section key={category.id} className="mb-16">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {getCategoryTitle(category.id)}
                </h2>
                <p className="text-muted-foreground">
                  {getCategoryDesc(category.id)}
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {category.guides.map((guide) => {
                  const Icon = guide.icon;
                  return (
                    <Link key={guide.id} to={guide.href}>
                      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                              <Icon className="w-6 h-6 text-primary" />
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {getGuideReadTime(guide.id)}
                            </Badge>
                          </div>
                          <CardTitle className="group-hover:text-primary transition-colors">
                            {getGuideTitle(guide.id)}
                          </CardTitle>
                          <CardDescription>{getGuideDescription(guide.id)}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <span className="inline-flex items-center text-sm font-medium text-primary">
                            {t("guides.readGuide", "Read guide")}
                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Process Guides - Featured */}
          <section className="mb-16">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {getCategoryTitle("process")}
              </h2>
              <p className="text-muted-foreground">
                {getCategoryDesc("process")}
              </p>
            </div>

            {/* Featured Planning Guide */}
            <Link to="/guides/planning" className="block mb-6">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:shadow-lg transition-shadow cursor-pointer group">
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      {(() => {
                        const PlanningIcon = processGuides[0].icon;
                        return <PlanningIcon className="w-8 h-8 text-primary" />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <Badge variant="secondary" className="mb-2">
                        <Clock className="w-3 h-3 mr-1" />
                        {getGuideReadTime("planning")}
                      </Badge>
                      <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        {getGuideTitle("planning")}
                      </h3>
                      <p className="text-muted-foreground">
                        {getGuideDescription("planning")}
                      </p>
                    </div>
                    <ArrowRight className="w-6 h-6 text-primary group-hover:translate-x-2 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Funding & Operations */}
            <div className="grid md:grid-cols-2 gap-6">
              {processGuides.slice(1).map((guide) => {
                const Icon = guide.icon;
                return (
                  <Link key={guide.id} to={guide.href}>
                    <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {getGuideReadTime(guide.id)}
                          </Badge>
                        </div>
                        <CardTitle className="group-hover:text-primary transition-colors">
                          {getGuideTitle(guide.id)}
                        </CardTitle>
                        <CardDescription>{getGuideDescription(guide.id)}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <span className="inline-flex items-center text-sm font-medium text-primary">
                          {t("guides.readGuide", "Read guide")}
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* CTA Section */}
          <section className="text-center py-12 px-6 bg-muted/50 rounded-2xl">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {t("guides.cta.mainTitle", "Ready to start your transition?")}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              {t("guides.cta.mainDescription", "Use our TCO calculator to compare scenarios for your fleet")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setDemoOpen(true)}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                {t("guides.cta.getStarted", "Request Access")}
              </button>
              <Link
                to="/features"
                className="inline-flex items-center justify-center px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
              >
                {t("landing.navbar.features", "See Features")}
              </Link>
            </div>
            <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Guides;

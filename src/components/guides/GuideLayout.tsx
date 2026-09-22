import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, ChevronRight } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface TableOfContentsItem {
  id: string;
  titleKey: string;
}

interface GuideLayoutProps {
  titleKey: string;
  subtitleKey: string;
  readTimeKey: string;
  icon: React.ComponentType<{ className?: string }>;
  tableOfContents: TableOfContentsItem[];
  children: React.ReactNode;
  ctaLink?: string;
  ctaLabelKey?: string;
}

const GuideLayout = ({
  titleKey,
  subtitleKey,
  readTimeKey,
  icon: Icon,
  tableOfContents,
  children,
  ctaLink = "/signup",
  ctaLabelKey = "guides.cta.getStarted",
}: GuideLayoutProps) => {
  const { t } = useTranslation();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Link
              to="/guides"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("guides.backToGuides", "Back to Guides")}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Table of Contents - Sticky Sidebar */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-24">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  {t("guides.tableOfContents", "Table of Contents")}
                </h3>
                <nav className="space-y-2">
                  {tableOfContents.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className="block text-sm text-muted-foreground hover:text-foreground transition-colors text-left w-full py-1"
                    >
                      {t(item.titleKey)}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <article className="lg:col-span-6">
              {/* Header */}
              <header className="mb-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{t(readTimeKey)}</span>
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {t(titleKey)}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {t(subtitleKey)}
                </p>
              </header>

              {/* Content */}
              <div className="prose prose-lg max-w-none dark:prose-invert">
                {children}
              </div>
            </article>

            {/* CTA Sidebar */}
            <aside className="lg:col-span-3">
              <div className="sticky top-24 space-y-6">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-foreground mb-2">
                      {t("guides.cta.title", "Ready to get started?")}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t(
                        "guides.cta.description",
                        "Use H2Fleet Planner to calculate your TCO and plan your transition."
                      )}
                    </p>
                    <Button asChild className="w-full">
                      <Link to={ctaLink}>
                        {t(ctaLabelKey)}
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-foreground mb-2">
                      {t("guides.relatedTools.title", "Related Tools")}
                    </h3>
                    <div className="space-y-2">
                      <Link
                        to="/dashboard/scenarios/new"
                        className="block text-sm text-primary hover:underline"
                      >
                        {t("guides.relatedTools.tcoCalculator", "TCO Calculator")}
                      </Link>
                      <Link
                        to="/dashboard/subsidies"
                        className="block text-sm text-primary hover:underline"
                      >
                        {t("guides.relatedTools.subsidies", "Subsidies Explorer")}
                      </Link>
                      <Link
                        to="/dashboard/infrastructure"
                        className="block text-sm text-primary hover:underline"
                      >
                        {t("guides.relatedTools.infrastructure", "Infrastructure Planner")}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default GuideLayout;

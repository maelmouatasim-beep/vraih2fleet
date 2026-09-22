import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { History } from "lucide-react";

const Changelog = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('pages.changelog.title')} - H2Fleet Planner`;
  }, [t]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-32 pb-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <History className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              {t('pages.changelog.title')}
            </h1>
            <div className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
              {t('pages.changelog.badge')}
            </div>
            <p className="text-xl text-muted-foreground mb-8">
              {t('pages.changelog.description')}
            </p>
            <p className="text-muted-foreground">
              {t('pages.changelog.footer')}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Changelog;
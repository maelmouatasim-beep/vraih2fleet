/**
 * Page publique « Méthodologie » (E1) : même texte que l'Aide, décrivant
 * le moteur ACTUEL — l'ancienne page décrivait l'ancien moteur (formule
 * CAPEX + NPV(OPEX), coûts de bornes/stations et valeur résiduelle
 * figés, « mise à jour trimestrielle »). Aucun chiffre figé : renvoi au
 * registre sourcé, consultable dans l'application.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import DemoRequestModal from "@/components/landing/DemoRequestModal";
import MethodSections from "@/components/help/MethodSections";

const Methodology = () => {
  const { t } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl space-y-8">
        <div>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              {t("common.back")}
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-4">{t("methodology.title")}</h1>
          <p className="text-lg text-muted-foreground">{t("methodology.subtitle")}</p>
        </div>

        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">{t("helpTraining.disclaimer.title")}</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{t("helpTraining.disclaimer.text")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <MethodSections sections={["method", "uncertainty", "data", "infrastructure", "subsidies"]} avecFaq={false} ouvertes={["method"]} />

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 text-center">
            <h3 className="text-xl font-semibold mb-2">{t("methodology.cta.title")}</h3>
            <p className="text-muted-foreground mb-4">{t("methodology.cta.desc")}</p>
            <div className="flex gap-4 justify-center">
              <Link to="/signup">
                <Button>{t("common.requestAccess")}</Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline">{t("common.contactUs")}</Button>
              </Link>
            </div>
            <DemoRequestModal open={demoOpen} onOpenChange={setDemoOpen} />
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Methodology;

/**
 * Aide (D3) : décrit le moteur et le parcours ACTUELS. Aucun chiffre
 * figé ici — toute valeur (prix, coûts, facteurs, statuts de
 * programmes) vit dans le registre de la Bibliothèque, avec sa source et
 * sa date de vérification.
 */
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { BookOpen, Info } from "lucide-react";
import MethodSections from "@/components/help/MethodSections";



const HelpTraining = () => {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">{t("helpTraining.title")}</h1>
          </div>
          <p className="text-lg text-muted-foreground">{t("helpTraining.subtitle")}</p>
        </div>

        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t("helpTraining.disclaimer.title")}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">{t("helpTraining.disclaimer.text")}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard/library">{t("helpTraining.openLibrary")}</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <MethodSections />
      </div>
    </DashboardLayout>
  );
};

export default HelpTraining;

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  BookOpen,
  Building2,
  Calculator,
  Database,
  HandCoins,
  HelpCircle,
  Info,
  Route,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

/** Sections de l'aide : clé i18n et nombre de points (helpTraining.<id>.p1..pN). */
export const SECTIONS_AIDE: { id: string; icone: LucideIcon; points: number }[] = [
  { id: "journey", icone: Route, points: 7 },
  { id: "method", icone: Calculator, points: 7 },
  { id: "uncertainty", icone: TrendingDown, points: 3 },
  { id: "data", icone: Database, points: 5 },
  { id: "infrastructure", icone: Building2, points: 4 },
  { id: "subsidies", icone: HandCoins, points: 4 },
];

export const NB_QUESTIONS_FAQ = 5;

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

        <Accordion type="multiple" defaultValue={["journey"]} className="space-y-4">
          {SECTIONS_AIDE.map(({ id, icone: Icone, points }) => (
            <AccordionItem key={id} value={id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Icone className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{t(`helpTraining.${id}.title`)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                  {Array.from({ length: points }, (_, i) => (
                    <li key={i}>{t(`helpTraining.${id}.p${i + 1}`)}</li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}

          <AccordionItem value="faq" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t("helpTraining.faq.title")}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {Array.from({ length: NB_QUESTIONS_FAQ }, (_, i) => (
                <div key={i}>
                  <p className="font-medium text-sm">{t(`helpTraining.faq.q${i + 1}`)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t(`helpTraining.faq.a${i + 1}`)}</p>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DashboardLayout>
  );
};

export default HelpTraining;

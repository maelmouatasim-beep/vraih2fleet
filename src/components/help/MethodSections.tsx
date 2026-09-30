/**
 * Sections de méthode partagées par l'Aide (app) et la page publique
 * Méthodologie (E1) : un seul texte, celui du moteur ACTUEL, sans chiffre
 * figé (les valeurs vivent dans le registre de la Bibliothèque).
 */
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Building2,
  Calculator,
  Database,
  HandCoins,
  HelpCircle,
  Route,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

/** Sections (clé i18n helpTraining.<id>, points p1..pN). */
export const SECTIONS_AIDE: { id: string; icone: LucideIcon; points: number }[] = [
  { id: "journey", icone: Route, points: 7 },
  { id: "method", icone: Calculator, points: 7 },
  { id: "uncertainty", icone: TrendingDown, points: 3 },
  { id: "data", icone: Database, points: 5 },
  { id: "infrastructure", icone: Building2, points: 4 },
  { id: "subsidies", icone: HandCoins, points: 4 },
];

export const NB_QUESTIONS_FAQ = 5;

export default function MethodSections({
  sections = SECTIONS_AIDE.map((s) => s.id),
  avecFaq = true,
  ouvertes = ["journey"],
}: {
  sections?: string[];
  avecFaq?: boolean;
  ouvertes?: string[];
}) {
  const { t } = useTranslation();
  return (
    <Accordion type="multiple" defaultValue={ouvertes} className="space-y-4">
      {SECTIONS_AIDE.filter((s) => sections.includes(s.id)).map(({ id, icone: Icone, points }) => (
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
      {avecFaq && (
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
      )}
    </Accordion>
  );
}

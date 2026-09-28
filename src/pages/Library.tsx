import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, Database, FileJson, Plug } from "lucide-react";

const ENTREES = [
  { href: "/dashboard/donnees-ref", icone: Database, cle: "referenceData" },
  { href: "/dashboard/custom-data", icone: FileJson, cle: "customData" },
  { href: "/dashboard/telematics", icone: Plug, cle: "telematics" },
] as const;

/** Bibliothèque (menu 6 entrées) : le point d'entrée des données de
 *  référence, données personnalisées et sources télématiques. */
export default function Library() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6" /> {t("library.title")}
          </h1>
          <p className="text-muted-foreground">{t("library.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ENTREES.map(({ href, icone: Icone, cle }) => (
            <Link key={href} to={href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icone className="w-5 h-5 text-primary" />
                    {t(`library.items.${cle}.title`)}
                    <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardTitle>
                  <CardDescription>{t(`library.items.${cle}.description`)}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Battery, Check, X } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const tableOfContents = [
  { id: "suitability", titleKey: "guides.bev.toc.suitability" },
  { id: "infrastructure", titleKey: "guides.bev.toc.infrastructure" },
  { id: "consumption", titleKey: "guides.bev.toc.consumption" },
  { id: "climate", titleKey: "guides.bev.toc.climate" },
  { id: "tco", titleKey: "guides.bev.toc.tco" },
];

const GuideBEV = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.bev.title")} - H2Fleet Planner`;
  }, [t]);

  const optimalCases = t("guides.bev.suitability.optimalCases", { returnObjects: true }) as string[];
  const lessIdealCases = t("guides.bev.suitability.lessIdealCases", { returnObjects: true }) as string[];
  const climateSolutions = t("guides.bev.climate.solutions.items", { returnObjects: true }) as string[];

  return (
    <GuideLayout
      titleKey="guides.bev.title"
      subtitleKey="guides.bev.subtitle"
      readTimeKey="guides.bev.readTime"
      icon={Battery}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/scenarios/new"
      ctaLabelKey="guides.bev.cta.createScenario"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.bev.description")}
        </p>
      </GuideSection>

      {/* Suitability */}
      <GuideSection id="suitability">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.bev.suitability.title")}
        </h2>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Optimal Use Cases */}
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-6 border border-green-200 dark:border-green-800">
            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
              <Check className="w-5 h-5" />
              {t("guides.bev.suitability.optimal")}
            </h3>
            <ul className="space-y-2 text-sm text-green-700 dark:text-green-400">
              {Array.isArray(optimalCases) && optimalCases.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Less Suitable */}
          <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-6 border border-red-200 dark:border-red-800">
            <h3 className="font-semibold text-red-800 dark:text-red-300 mb-4 flex items-center gap-2">
              <X className="w-5 h-5" />
              {t("guides.bev.suitability.lessIdeal")}
            </h3>
            <ul className="space-y-2 text-sm text-red-700 dark:text-red-400">
              {Array.isArray(lessIdealCases) && lessIdealCases.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GuideSection>

      {/* Infrastructure */}
      <GuideSection id="infrastructure">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.bev.infrastructure.title")}
        </h2>

        <div className="space-y-6">
          {/* Level 2 Chargers */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-3">
              {t("guides.bev.infrastructure.level2.title")}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("guides.bev.infrastructure.level2.cost")}</p>
              <p>{t("guides.bev.infrastructure.level2.time")}</p>
              <p>{t("guides.bev.infrastructure.level2.ideal")}</p>
              <p>{t("guides.bev.infrastructure.level2.ratio")}</p>
            </div>
          </div>

          {/* DC Fast Chargers */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-3">
              {t("guides.bev.infrastructure.dcFast.title")}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("guides.bev.infrastructure.dcFast.cost")}</p>
              <p>{t("guides.bev.infrastructure.dcFast.time")}</p>
              <p>{t("guides.bev.infrastructure.dcFast.ideal")}</p>
              <p>{t("guides.bev.infrastructure.dcFast.ratio")}</p>
            </div>
          </div>
        </div>

        <GuideCallout
          type="tool"
          titleKey="guides.bev.infrastructure.callout.title"
          descriptionKey="guides.bev.infrastructure.callout.description"
          linkTo="/dashboard/infrastructure"
          linkTextKey="guides.cta.exploreTools"
        />
      </GuideSection>

      {/* Real Consumption */}
      <GuideSection id="consumption">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.bev.consumption.title")}
        </h2>

        <p className="text-muted-foreground mb-6">
          {t("guides.bev.consumption.description")}
        </p>

        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">{t("guides.bev.consumption.van.title")}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <p>{t("guides.bev.consumption.van.summer")}</p>
              <p>{t("guides.bev.consumption.van.winter")}</p>
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">{t("guides.bev.consumption.medium.title")}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <p>{t("guides.bev.consumption.medium.summer")}</p>
              <p>{t("guides.bev.consumption.medium.winter")}</p>
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">{t("guides.bev.consumption.heavy.title")}</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <p>{t("guides.bev.consumption.heavy.summer")}</p>
              <p>{t("guides.bev.consumption.heavy.winter")}</p>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* Cold Climate */}
      <GuideSection id="climate">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.bev.climate.title")}
        </h2>

        <p className="text-muted-foreground mb-6">
          {t("guides.bev.climate.description")}
        </p>

        <div className="bg-muted/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-foreground mb-4">
            {t("guides.bev.climate.impact.title")}
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div className="bg-background rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">-15%</div>
              <div className="text-sm text-muted-foreground">{t("guides.bev.climate.impact.minus10")}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">-30%</div>
              <div className="text-sm text-muted-foreground">{t("guides.bev.climate.impact.minus20")}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-2xl font-bold text-foreground">-40%</div>
              <div className="text-sm text-muted-foreground">{t("guides.bev.climate.impact.minus30")}</div>
            </div>
          </div>
        </div>

        <h3 className="font-semibold text-foreground mb-4">
          {t("guides.bev.climate.solutions.title")}
        </h3>
        <ul className="space-y-2 text-muted-foreground">
          {Array.isArray(climateSolutions) && climateSolutions.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-1 text-primary flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <GuideCallout
          type="success"
          titleKey="guides.bev.climate.callout.title"
          descriptionKey="guides.bev.climate.callout.description"
        />
      </GuideSection>

      {/* TCO Comparison */}
      <GuideSection id="tco">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.bev.tco.title")}
        </h2>

        <p className="text-muted-foreground mb-6">
          {t("guides.bev.tco.description")}
        </p>

        <GuideCallout
          type="tool"
          titleKey="guides.bev.tco.callout.title"
          descriptionKey="guides.bev.tco.callout.description"
          linkTo="/dashboard/scenarios/new"
          linkTextKey="guides.cta.startCalculation"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideBEV;

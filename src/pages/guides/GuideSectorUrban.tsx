import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Building2, Check, Battery } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";

const tableOfContents = [
  { id: "profile", titleKey: "guides.sectorUrban.profile.title" },
  { id: "recommendation", titleKey: "guides.sectorUrban.recommendation" },
  { id: "implementation", titleKey: "guides.sectorUrban.steps.title" },
];

const GuideSectorUrban = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.sectorUrban.title")} - H2Fleet Planner`;
  }, [t]);

  const profileItems = t("guides.sectorUrban.profile.items", { returnObjects: true }) as string[];
  const stepItems = t("guides.sectorUrban.steps.items", { returnObjects: true }) as string[];

  return (
    <GuideLayout
      titleKey="guides.sectorUrban.title"
      subtitleKey="guides.sectorUrban.subtitle"
      readTimeKey="guides.sectorUrban.readTime"
      icon={Building2}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/scenarios/new"
      ctaLabelKey="guides.cta.startCalculation"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.sectorUrban.description")}
        </p>
      </GuideSection>

      {/* Profile */}
      <GuideSection id="profile">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorUrban.profile.title")}
        </h2>

        <div className="bg-muted/50 rounded-lg p-6">
          <ul className="space-y-3">
            {Array.isArray(profileItems) && profileItems.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </GuideSection>

      {/* Recommendation */}
      <GuideSection id="recommendation">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorUrban.recommendation")}
        </h2>

        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-6 border border-green-200 dark:border-green-800 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Battery className="w-6 h-6 text-green-700 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-bold text-green-800 dark:text-green-300 text-lg">
                95% BEV
              </h3>
              <p className="text-green-700 dark:text-green-400 text-sm">
                {t("guides.sectorUrban.description")}
              </p>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* Implementation Steps */}
      <GuideSection id="implementation">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorUrban.steps.title")}
        </h2>

        <div className="space-y-4">
          {Array.isArray(stepItems) && stepItems.map((item, index) => (
            <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold flex-shrink-0">
                {index + 1}
              </div>
              <p className="text-muted-foreground pt-1">{item}</p>
            </div>
          ))}
        </div>

        <GuideCallout
          type="success"
          titleKey="guides.sectorUrban.caseStudy.title"
          descriptionKey="guides.sectorUrban.caseStudy.description"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideSectorUrban;

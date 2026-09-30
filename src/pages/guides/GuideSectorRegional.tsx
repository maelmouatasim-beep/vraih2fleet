import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Route, AlertTriangle, Check } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";

const tableOfContents = [
  { id: "profile", titleKey: "guides.sectorRegional.profile.title" },
  { id: "recommendation", titleKey: "guides.sectorRegional.recommendation" },
  { id: "decision-tree", titleKey: "guides.sectorRegional.decisionTree.title" },
];

const GuideSectorRegional = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.sectorRegional.title")} - H2Fleet Planner`;
  }, [t]);

  const profileItems = t("guides.sectorRegional.profile.items", { returnObjects: true }) as string[];

  return (
    <GuideLayout
      titleKey="guides.sectorRegional.title"
      subtitleKey="guides.sectorRegional.subtitle"
      readTimeKey="guides.sectorRegional.readTime"
      icon={Route}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/scenarios/new"
      ctaLabelKey="guides.cta.startCalculation"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.sectorRegional.description")}
        </p>
      </GuideSection>

      {/* Profile */}
      <GuideSection id="profile">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorRegional.profile.title")}
        </h2>

        <div className="bg-muted/50 rounded-lg p-6 mb-6">
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
          {t("guides.sectorRegional.recommendation")}
        </h2>

        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-6 border border-amber-200 dark:border-amber-800 mb-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-300 text-lg mb-2">
                {t("guides.sectorRegional.recommendation")}
              </h3>
              <p className="text-amber-700 dark:text-amber-400">
                {t("guides.sectorRegional.description")}
              </p>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* Decision Tree */}
      <GuideSection id="decision-tree">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorRegional.decisionTree.title")}
        </h2>

        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">
              {t("guides.sectorRegional.decisionTree.question1")}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-300">&lt; 250 km</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400">
                  {t("guides.sectorRegional.decisionTree.answer1Yes")}
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-foreground">&gt; 250 km</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("guides.sectorRegional.decisionTree.answer1No")}
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-4">
              {t("guides.sectorRegional.decisionTree.question2")}
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-300">4h+</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-400">
                  {t("guides.sectorRegional.decisionTree.answer2Yes")}
                </p>
              </div>
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-foreground">&lt; 4h</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("guides.sectorRegional.decisionTree.answer2No")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <GuideCallout
          type="tool"
          titleKey="guides.sectorRegional.callout.title"
          descriptionKey="guides.sectorRegional.callout.description"
          linkTo="/dashboard/scenarios/new"
          linkTextKey="guides.cta.startCalculation"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideSectorRegional;

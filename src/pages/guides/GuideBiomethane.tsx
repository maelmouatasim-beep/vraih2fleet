import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Leaf, Check } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";

const tableOfContents = [
  { id: "what", titleKey: "guides.biomethane.toc.what" },
  { id: "conversion", titleKey: "guides.biomethane.toc.conversion" },
  { id: "availability", titleKey: "guides.biomethane.toc.availability" },
  { id: "tco", titleKey: "guides.biomethane.toc.tco" },
];

const GuideBiomethane = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.biomethane.title")} - H2Fleet Planner`;
  }, [t]);

  const benefits = t("guides.biomethane.what.benefits", { returnObjects: true }) as string[];
  const advantages = t("guides.biomethane.conversion.advantages.items", { returnObjects: true }) as string[];

  return (
    <GuideLayout
      titleKey="guides.biomethane.title"
      subtitleKey="guides.biomethane.subtitle"
      readTimeKey="guides.biomethane.readTime"
      icon={Leaf}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/scenarios/new"
      ctaLabelKey="guides.biomethane.cta.createScenario"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.biomethane.description")}
        </p>
      </GuideSection>

      {/* What is it */}
      <GuideSection id="what">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.biomethane.what.title")}
        </h2>

        <p className="text-muted-foreground mb-6">
          {t("guides.biomethane.what.description")}
        </p>

        <div className="bg-muted/50 rounded-lg p-6">
          <ul className="space-y-3">
            {Array.isArray(benefits) && benefits.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </GuideSection>

      {/* Fleet Conversion */}
      <GuideSection id="conversion">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.biomethane.conversion.title")}
        </h2>

        <div className="space-y-4 mb-6">
          <div className="border rounded-lg p-4">
            <p className="text-muted-foreground">{t("guides.biomethane.conversion.cost")}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-muted-foreground">{t("guides.biomethane.conversion.subsidies")}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-muted-foreground">{t("guides.biomethane.conversion.benefit")}</p>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-6 border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
            <Check className="w-5 h-5" />
            {t("guides.biomethane.conversion.advantages.title")}
          </h3>
          <ul className="space-y-2 text-sm text-green-700 dark:text-green-400">
            {Array.isArray(advantages) && advantages.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </GuideSection>

      {/* Availability */}
      <GuideSection id="availability">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.biomethane.availability.title")}
        </h2>

        <p className="text-muted-foreground mb-6">
          {t("guides.biomethane.availability.description")}
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">10</div>
            <div className="text-sm text-muted-foreground">{t("guides.biomethane.availability.stations.quebec")}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">15</div>
            <div className="text-sm text-muted-foreground">{t("guides.biomethane.availability.stations.ontario")}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-foreground">20+</div>
            <div className="text-sm text-muted-foreground">{t("guides.biomethane.availability.stations.alberta")}</div>
          </div>
        </div>

        <GuideCallout
          type="info"
          titleKey="guides.biomethane.availability.callout.title"
          descriptionKey="guides.biomethane.availability.callout.description"
        />
      </GuideSection>

      {/* TCO Comparison */}
      <GuideSection id="tco">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.biomethane.tco.title")}
        </h2>

        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 mb-6">
          <p className="text-muted-foreground">
            {t("guides.biomethane.tco.conclusion")}
          </p>
        </div>

        <GuideCallout
          type="tool"
          titleKey="guides.cta.startCalculation"
          descriptionKey="guides.biomethane.description"
          linkTo="/dashboard/scenarios/new"
          linkTextKey="guides.cta.startCalculation"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideBiomethane;

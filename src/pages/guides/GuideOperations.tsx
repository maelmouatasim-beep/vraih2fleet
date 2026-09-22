import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Settings } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";

const tableOfContents = [
  { id: "routes", titleKey: "guides.operations.toc.routes" },
  { id: "energy", titleKey: "guides.operations.toc.energy" },
  { id: "monitoring", titleKey: "guides.operations.toc.monitoring" },
];

const GuideOperations = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.operations.title")} - H2Fleet Planner`;
  }, [t]);

  return (
    <GuideLayout
      titleKey="guides.operations.title"
      subtitleKey="guides.operations.subtitle"
      readTimeKey="guides.operations.readTime"
      icon={Settings}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/telematics"
      ctaLabelKey="guides.operations.cta.connectTelematics"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.operations.description")}
        </p>
      </GuideSection>

      {/* Routes */}
      <GuideSection id="routes">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("guides.operations.routes.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("guides.operations.routes.description")}
        </p>
      </GuideSection>

      {/* Energy */}
      <GuideSection id="energy">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("guides.operations.energy.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("guides.operations.energy.description")}
        </p>
        <GuideCallout
          type="info"
          titleKey="guides.operations.energy.callout.title"
          descriptionKey="guides.operations.energy.callout.description"
        />
      </GuideSection>

      {/* Monitoring */}
      <GuideSection id="monitoring">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("guides.operations.monitoring.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("guides.operations.monitoring.description")}
        </p>
        <GuideCallout
          type="tool"
          titleKey="guides.operations.monitoring.callout.title"
          descriptionKey="guides.operations.monitoring.callout.description"
          linkTo="/dashboard/analytics"
          linkTextKey="guides.operations.monitoring.callout.link"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideOperations;

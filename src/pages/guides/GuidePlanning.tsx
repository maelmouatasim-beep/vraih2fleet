import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Calendar } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";

const tableOfContents = [
  { id: "phase1", titleKey: "guides.planning.toc.phase1" },
  { id: "phase2", titleKey: "guides.planning.toc.phase2" },
  { id: "phase3", titleKey: "guides.planning.toc.phase3" },
  { id: "phase4", titleKey: "guides.planning.toc.phase4" },
];

const GuidePlanning = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.planning.title")} - H2Fleet Planner`;
  }, [t]);

  return (
    <GuideLayout
      titleKey="guides.planning.title"
      subtitleKey="guides.planning.subtitle"
      readTimeKey="guides.planning.readTime"
      icon={Calendar}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/projects"
      ctaLabelKey="guides.planning.cta.startRoadmap"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.planning.description")}
        </p>
      </GuideSection>

      {/* Phase 1 */}
      <GuideSection id="phase1">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("guides.planning.phase1.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("guides.planning.phase1.description")}
        </p>
        <GuideCallout
          type="tool"
          titleKey="guides.planning.phase1.callout.title"
          descriptionKey="guides.planning.phase1.callout.description"
          linkTo="/dashboard/telematics"
          linkTextKey="guides.planning.phase1.callout.link"
        />
      </GuideSection>

      {/* Phase 2 */}
      <GuideSection id="phase2">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("guides.planning.phase2.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("guides.planning.phase2.description")}
        </p>
        <GuideCallout
          type="tool"
          titleKey="guides.planning.phase2.callout.title"
          descriptionKey="guides.planning.phase2.callout.description"
          linkTo="/dashboard/scenarios/new"
          linkTextKey="guides.planning.phase2.callout.link"
        />
      </GuideSection>

      {/* Phase 3 */}
      <GuideSection id="phase3">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("guides.planning.phase3.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("guides.planning.phase3.description")}
        </p>
        <GuideCallout
          type="tool"
          titleKey="guides.planning.phase3.callout.title"
          descriptionKey="guides.planning.phase3.callout.description"
          linkTo="/dashboard/infrastructure"
          linkTextKey="guides.planning.phase3.callout.link"
        />
      </GuideSection>

      {/* Phase 4 */}
      <GuideSection id="phase4">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          {t("guides.planning.phase4.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("guides.planning.phase4.description")}
        </p>
        <GuideCallout
          type="success"
          titleKey="guides.planning.phase4.callout.title"
          descriptionKey="guides.planning.phase4.callout.description"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuidePlanning;

import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Coins } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";

const tableOfContents = [
  { id: "federal", titleKey: "guides.funding.toc.federal" },
  { id: "provincial", titleKey: "guides.funding.toc.provincial" },
  { id: "optimization", titleKey: "guides.funding.toc.optimization" },
];

const GuideFunding = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.funding.title")} - H2Fleet Planner`;
  }, [t]);

  return (
    <GuideLayout
      titleKey="guides.funding.title"
      subtitleKey="guides.funding.subtitle"
      readTimeKey="guides.funding.readTime"
      icon={Coins}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/subsidies"
      ctaLabelKey="guides.funding.cta.exploreSubsidies"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.funding.description")}
        </p>
      </GuideSection>

      {/* Federal Programs */}
      <GuideSection id="federal">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.funding.federal.title")}
        </h2>
        
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-2 text-lg">iVMLZE</h3>
            <p className="text-sm text-muted-foreground">
              {t("guides.funding.federal.ivmlze")}
            </p>
          </div>
          
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-2 text-lg">ZEVIP</h3>
            <p className="text-sm text-muted-foreground">
              {t("guides.funding.federal.zevip")}
            </p>
          </div>
        </div>
      </GuideSection>

      {/* Provincial Programs */}
      <GuideSection id="provincial">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.funding.provincial.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("guides.funding.provincial.description")}
        </p>
      </GuideSection>

      {/* Optimization */}
      <GuideSection id="optimization">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.funding.optimization.title")}
        </h2>
        <p className="text-muted-foreground mb-6">
          {t("guides.funding.optimization.description")}
        </p>
        
        <GuideCallout
          type="tool"
          titleKey="guides.funding.optimization.callout.title"
          descriptionKey="guides.funding.optimization.callout.description"
          linkTo="/dashboard/subsidies"
          linkTextKey="guides.funding.optimization.callout.link"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideFunding;

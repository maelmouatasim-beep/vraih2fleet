import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Truck, AlertTriangle, Check, X } from "lucide-react";
import { GuideLayout, GuideCallout, GuideSection } from "@/components/guides";

const tableOfContents = [
  { id: "profile", titleKey: "guides.sectorLongHaul.profile.title" },
  { id: "reality-2026", titleKey: "guides.sectorLongHaul.reality2026.title" },
  { id: "roadmap", titleKey: "guides.sectorLongHaul.roadmap.title" },
];

const GuideSectorLongHaul = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.sectorLongHaul.title")} - H2Fleet Planner`;
  }, [t]);

  const profileItems = t("guides.sectorLongHaul.profile.items", { returnObjects: true }) as string[];
  const bevReasons = t("guides.sectorLongHaul.reality2026.bev.reasons", { returnObjects: true }) as string[];
  const h2Reasons = t("guides.sectorLongHaul.reality2026.h2.reasons", { returnObjects: true }) as string[];
  const biomethaneReasons = t("guides.sectorLongHaul.reality2026.biomethane.reasons", { returnObjects: true }) as string[];

  return (
    <GuideLayout
      titleKey="guides.sectorLongHaul.title"
      subtitleKey="guides.sectorLongHaul.subtitle"
      readTimeKey="guides.sectorLongHaul.readTime"
      icon={Truck}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/scenarios/new"
      ctaLabelKey="guides.sectorLongHaul.cta.startAnalysis"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.sectorLongHaul.description")}
        </p>
      </GuideSection>

      {/* Profile */}
      <GuideSection id="profile">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorLongHaul.profile.title")}
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

      {/* Reality 2026 */}
      <GuideSection id="reality-2026">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorLongHaul.reality2026.title")}
        </h2>

        <div className="space-y-4 mb-6">
          {/* BEV */}
          <div className="border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <X className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  BEV - {t("guides.sectorLongHaul.reality2026.bev.status")}
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {Array.isArray(bevReasons) && bevReasons.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* H2 */}
          <div className="border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  H₂ - {t("guides.sectorLongHaul.reality2026.h2.status")}
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {Array.isArray(h2Reasons) && h2Reasons.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {index === 0 ? (
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Biomethane */}
          <div className="border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t("guides.biomethane.title")} - {t("guides.sectorLongHaul.reality2026.biomethane.status")}
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {Array.isArray(biomethaneReasons) && biomethaneReasons.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* Roadmap */}
      <GuideSection id="roadmap">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.sectorLongHaul.roadmap.title")}
        </h2>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <div className="flex items-center justify-center w-16 h-8 bg-muted rounded font-mono text-sm font-bold flex-shrink-0">
              2026-28
            </div>
            <p className="text-muted-foreground pt-1">
              {t("guides.sectorLongHaul.roadmap.phase1")}
            </p>
          </div>

          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <div className="flex items-center justify-center w-16 h-8 bg-muted rounded font-mono text-sm font-bold flex-shrink-0">
              2028-30
            </div>
            <p className="text-muted-foreground pt-1">
              {t("guides.sectorLongHaul.roadmap.phase2")}
            </p>
          </div>

          <div className="flex items-start gap-4 p-4 border rounded-lg">
            <div className="flex items-center justify-center w-16 h-8 bg-primary text-primary-foreground rounded font-mono text-sm font-bold flex-shrink-0">
              2030-35
            </div>
            <p className="text-muted-foreground pt-1">
              {t("guides.sectorLongHaul.roadmap.phase3")}
            </p>
          </div>
        </div>

        <GuideCallout
          type="tool"
          titleKey="guides.planning.cta.startRoadmap"
          descriptionKey="guides.sectorLongHaul.description"
          linkTo="/dashboard/roadmap"
          linkTextKey="guides.planning.cta.startRoadmap"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideSectorLongHaul;

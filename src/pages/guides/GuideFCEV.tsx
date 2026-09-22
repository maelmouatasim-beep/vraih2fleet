import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Droplets, Check } from "lucide-react";
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
  { id: "why-hydrogen", titleKey: "guides.fcev.toc.whyHydrogen" },
  { id: "infrastructure", titleKey: "guides.fcev.toc.infrastructure" },
  { id: "costs", titleKey: "guides.fcev.toc.costs" },
  { id: "funding", titleKey: "guides.fcev.toc.funding" },
];

const GuideFCEV = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t("guides.fcev.title")} - H2Fleet Planner`;
  }, [t]);

  const advantages = t("guides.fcev.whyHydrogen.advantages.items", { returnObjects: true }) as string[];
  const useCases = t("guides.fcev.whyHydrogen.useCases.items", { returnObjects: true }) as string[];
  const fundingPrograms = t("guides.fcev.funding.programs", { returnObjects: true }) as string[];

  return (
    <GuideLayout
      titleKey="guides.fcev.title"
      subtitleKey="guides.fcev.subtitle"
      readTimeKey="guides.fcev.readTime"
      icon={Droplets}
      tableOfContents={tableOfContents}
      ctaLink="/dashboard/scenarios/new"
      ctaLabelKey="guides.fcev.cta.createScenario"
    >
      {/* Introduction */}
      <GuideSection id="intro">
        <p className="text-lg text-muted-foreground leading-relaxed">
          {t("guides.fcev.description")}
        </p>
      </GuideSection>

      {/* Why Hydrogen */}
      <GuideSection id="why-hydrogen">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.fcev.whyHydrogen.title")}
        </h2>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Unique Advantages */}
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-6 border border-green-200 dark:border-green-800">
            <h3 className="font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
              <Check className="w-5 h-5" />
              {t("guides.fcev.whyHydrogen.advantages.title")}
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

          {/* Optimal Use Cases */}
          <div className="bg-primary/5 rounded-lg p-6 border border-primary/20">
            <h3 className="font-semibold text-foreground mb-4">
              {t("guides.fcev.whyHydrogen.useCases.title")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {Array.isArray(useCases) && useCases.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
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
          {t("guides.fcev.infrastructure.title")}
        </h2>

        <div className="space-y-6">
          {/* Private Station */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-3">
              {t("guides.fcev.infrastructure.private.title")}
            </h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>{t("guides.fcev.infrastructure.private.cost")}</div>
              <div className="text-green-600">{t("guides.fcev.infrastructure.private.funding")}</div>
              <div>{t("guides.fcev.infrastructure.private.capacity")}</div>
              <div>{t("guides.fcev.infrastructure.private.timeline")}</div>
            </div>
          </div>

          {/* Public Network */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-3">
              {t("guides.fcev.infrastructure.public.title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-2">
              {t("guides.fcev.infrastructure.public.description")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("guides.fcev.infrastructure.public.cost")}
            </p>
          </div>
        </div>

        <GuideCallout
          type="tool"
          titleKey="guides.fcev.infrastructure.callout.title"
          descriptionKey="guides.fcev.infrastructure.callout.description"
          linkTo="/dashboard/infrastructure"
          linkTextKey="guides.cta.exploreTools"
        />
      </GuideSection>

      {/* Costs */}
      <GuideSection id="costs">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.fcev.costs.title")}
        </h2>

        <div className="space-y-6">
          {/* Current Prices */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-3">
              {t("guides.fcev.costs.current.title")}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("guides.fcev.costs.current.public")}</p>
              <p>{t("guides.fcev.costs.current.private")}</p>
              <p className="text-green-600 font-medium">{t("guides.fcev.costs.current.target")}</p>
            </div>
          </div>

          {/* Consumption */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-foreground mb-3">
              {t("guides.fcev.costs.consumption.title")}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("guides.fcev.costs.consumption.class8")}</p>
              <p className="text-amber-600">{t("guides.fcev.costs.consumption.fuelCost")}</p>
              <p>{t("guides.fcev.costs.consumption.vsDiesel")}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {t("guides.fcev.costs.note")}
          </p>
        </div>
      </GuideSection>

      {/* Funding */}
      <GuideSection id="funding">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("guides.fcev.funding.title")}
        </h2>

        <div className="space-y-4">
          {Array.isArray(fundingPrograms) && fundingPrograms.map((program, index) => (
            <div key={index} className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{program}</p>
            </div>
          ))}
        </div>

        <GuideCallout
          type="success"
          titleKey="guides.fcev.funding.callout.title"
          descriptionKey="guides.fcev.funding.callout.description"
          linkTo="/dashboard/subsidies"
          linkTextKey="guides.cta.exploreTools"
        />
      </GuideSection>
    </GuideLayout>
  );
};

export default GuideFCEV;

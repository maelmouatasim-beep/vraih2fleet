import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronRight, Lightbulb, AlertTriangle, CheckCircle2, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuideCalloutProps {
  type: "info" | "warning" | "success" | "tool";
  titleKey: string;
  descriptionKey?: string;
  linkTo?: string;
  linkTextKey?: string;
  className?: string;
}

const iconMap = {
  info: Lightbulb,
  warning: AlertTriangle,
  success: CheckCircle2,
  tool: Calculator,
};

const styleMap = {
  info: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  success: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
  tool: "bg-primary/5 border-primary/20",
};

const iconStyleMap = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  tool: "text-primary",
};

const GuideCallout = ({
  type,
  titleKey,
  descriptionKey,
  linkTo,
  linkTextKey,
  className,
}: GuideCalloutProps) => {
  const { t } = useTranslation();
  const Icon = iconMap[type];

  return (
    <div
      className={cn(
        "rounded-lg border p-4 my-6",
        styleMap[type],
        className
      )}
    >
      <div className="flex gap-3">
        <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", iconStyleMap[type])} />
        <div className="flex-1">
          <h4 className="font-semibold text-foreground mb-1">{t(titleKey)}</h4>
          {descriptionKey && (
            <p className="text-sm text-muted-foreground mb-2">
              {t(descriptionKey)}
            </p>
          )}
          {linkTo && linkTextKey && (
            <Link
              to={linkTo}
              className="inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              {t(linkTextKey)}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuideCallout;

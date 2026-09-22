import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type DataSourceType = "real_data" | "user_input" | "reference_data" | "calculated";

interface DataBadgeProps {
  type: DataSourceType;
  tooltip?: string;
  onClick?: () => void;
  sourceDetails?: {
    source: string;
    lastUpdated?: string;
    confidence?: string;
    formula?: string;
  };
  className?: string;
  size?: "sm" | "default";
  /** If true, shows full badge. If false (default), shows only info icon with tooltip */
  showBadge?: boolean;
}

const badgeConfig: Record<DataSourceType, { icon: string; labelKey: string; className: string }> = {
  real_data: {
    icon: "📡",
    labelKey: "dataProvenance.badges.realData",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  },
  user_input: {
    icon: "✏️",
    labelKey: "dataProvenance.badges.userInput",
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  reference_data: {
    icon: "📚",
    labelKey: "dataProvenance.badges.referenceData",
    className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
  calculated: {
    icon: "🧮",
    labelKey: "dataProvenance.badges.calculated",
    className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
};

export function DataBadge({ 
  type, 
  tooltip, 
  onClick, 
  sourceDetails,
  className,
  size = "default",
  showBadge = false,
}: DataBadgeProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const config = badgeConfig[type];

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (sourceDetails) {
      setShowDetails(true);
    }
  };

  const tooltipText = tooltip || `${config.icon} ${t(config.labelKey)} - ${t(`dataProvenance.tooltips.${type}`)}`;

  // Minimal mode: just show info icon with tooltip
  if (!showBadge) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleClick}
                className={cn(
                  "inline-flex items-center justify-center h-4 w-4 text-muted-foreground hover:text-foreground transition-colors",
                  className
                )}
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm">{tooltipText}</p>
              {sourceDetails?.formula && (
                <code className="block text-xs mt-1 opacity-80">{sourceDetails.formula}</code>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {sourceDetails && (
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>{config.icon}</span>
                  {t("dataProvenance.sourceDetails")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dataProvenance.source")}:</span>
                  <span className="font-medium">{sourceDetails.source}</span>
                </div>
                {sourceDetails.lastUpdated && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("dataProvenance.lastUpdated")}:</span>
                    <span>{sourceDetails.lastUpdated}</span>
                  </div>
                )}
                {sourceDetails.confidence && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("dataProvenance.confidence")}:</span>
                    <span>{sourceDetails.confidence}</span>
                  </div>
                )}
                {sourceDetails.formula && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground block mb-1">{t("dataProvenance.formula")}:</span>
                    <code className="block bg-muted p-2 rounded text-xs">{sourceDetails.formula}</code>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // Full badge mode
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        "cursor-pointer hover:opacity-80 transition-opacity",
        size === "sm" && "text-xs px-1.5 py-0",
        className
      )}
      onClick={handleClick}
    >
      <span className="mr-1">{config.icon}</span>
      {t(config.labelKey)}
    </Badge>
  );

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {sourceDetails && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{config.icon}</span>
                {t("dataProvenance.sourceDetails")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("dataProvenance.source")}:</span>
                <span className="font-medium">{sourceDetails.source}</span>
              </div>
              {sourceDetails.lastUpdated && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dataProvenance.lastUpdated")}:</span>
                  <span>{sourceDetails.lastUpdated}</span>
                </div>
              )}
              {sourceDetails.confidence && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("dataProvenance.confidence")}:</span>
                  <span>{sourceDetails.confidence}</span>
                </div>
              )}
              {sourceDetails.formula && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground block mb-1">{t("dataProvenance.formula")}:</span>
                  <code className="block bg-muted p-2 rounded text-xs">{sourceDetails.formula}</code>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

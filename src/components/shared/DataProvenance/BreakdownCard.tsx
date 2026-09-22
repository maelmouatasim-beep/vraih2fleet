import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataBadge, DataSourceType } from "./DataBadge";
import { cn } from "@/lib/utils";

interface BreakdownItem {
  label: string;
  value: number | string;
  source: DataSourceType;
  formula?: string;
  tooltip?: string;
  unit?: string;
}

interface BreakdownCardProps {
  title: string;
  total: {
    label: string;
    value: number | string;
    unit?: string;
  };
  items: BreakdownItem[];
  defaultExpanded?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function BreakdownCard({
  title,
  total,
  items,
  defaultExpanded = false,
  className,
  icon,
}: BreakdownCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const formatValue = (value: number | string, unit?: string) => {
    const formatted = typeof value === "number" ? value.toLocaleString() : value;
    return unit ? `${formatted} ${unit}` : formatted;
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 px-2"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="ml-1 text-xs">
              {expanded ? t("dataProvenance.collapse") : t("dataProvenance.expand")}
            </span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Total Section */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-3">
          <span className="text-sm font-medium text-muted-foreground">
            {total.label}
          </span>
          <span className="text-xl font-bold">
            {formatValue(total.value, total.unit)}
          </span>
        </div>

        {/* Breakdown Items */}
        {expanded && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              {t("dataProvenance.breakdown")}
            </p>
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm cursor-help">
                          {item.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-1">
                          {item.tooltip && <p>{item.tooltip}</p>}
                          {item.formula && (
                            <p className="text-xs opacity-80">
                              <span className="font-medium">{t("dataProvenance.formula")}:</span>{" "}
                              <code className="bg-background/50 px-1 rounded">{item.formula}</code>
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DataBadge type={item.source} size="sm" />
                </div>
                <span className="text-sm font-medium">
                  {formatValue(item.value, item.unit)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!expanded && items.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {t("dataProvenance.itemsCount", { count: items.length })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

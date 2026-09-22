import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  children,
  defaultCollapsed = true,
  className,
  icon,
  badge,
}: CollapsibleSectionProps) {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <div className={cn("border rounded-lg", className)}>
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-xs">
            {isCollapsed ? t('common.viewDetails', 'View details') : t('common.hideDetails', 'Hide details')}
          </span>
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>
      {!isCollapsed && (
        <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

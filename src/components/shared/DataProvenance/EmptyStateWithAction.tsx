import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateWithActionProps {
  icon: LucideIcon;
  message: string;
  description?: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyStateWithAction({
  icon: Icon,
  message,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateWithActionProps) {
  const ActionButton = (
    <Button onClick={onAction} className="mt-4">
      {actionLabel}
    </Button>
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center",
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{message}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-2">
          {description}
        </p>
      )}
      {actionHref ? (
        <Link to={actionHref}>{ActionButton}</Link>
      ) : (
        ActionButton
      )}
    </div>
  );
}

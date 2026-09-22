import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecommendedActions, type RecommendedAction } from "@/hooks/useRecommendedActions";
import { cn } from "@/lib/utils";

const ActionItem = ({ action }: { action: RecommendedAction }) => {
  const priorityStyles = {
    urgent: "border-destructive/30 bg-destructive/5 hover:bg-destructive/10",
    high: "border-warning/30 bg-warning/5 hover:bg-warning/10",
    medium: "border-primary/20 bg-primary/5 hover:bg-primary/10",
  };

  const iconStyles = {
    urgent: "bg-destructive/10 text-destructive",
    high: "bg-warning/10 text-warning",
    medium: "bg-primary/10 text-primary",
  };

  return (
    <Link
      to={action.href}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 group",
        priorityStyles[action.priority]
      )}
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconStyles[action.priority])}>
        <action.icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium text-foreground text-sm truncate">{action.title}</p>
          {action.badge && (
            <Badge 
              variant={action.badge.variant === 'destructive' ? 'destructive' : 'secondary'}
              className={cn(
                "text-[10px] px-1.5 py-0",
                action.badge.variant === 'warning' && "bg-warning/20 text-warning-foreground border-warning/30"
              )}
            >
              {action.badge.text}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-1">{action.description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-2.5" />
    </Link>
  );
};

const RecommendedActionsCard = () => {
  const { t } = useTranslation();
  const { actions, isLoading, totalActions } = useRecommendedActions();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (totalActions === 0) {
    return null; // Don't show if no actions
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          {t('recommendedActions.title', 'Recommended Actions')}
        </CardTitle>
        {totalActions > 4 && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/projects">
              {t('recommendedActions.viewAll', 'View all')}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map(action => (
          <ActionItem key={action.id} action={action} />
        ))}
      </CardContent>
    </Card>
  );
};

export default RecommendedActionsCard;

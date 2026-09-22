import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: number;
  labelKey: string;
  isCompleted: boolean;
  isActive: boolean;
  isSkipped?: boolean;
}

interface WizardBreadcrumbProps {
  steps: WizardStep[];
  onStepClick?: (stepId: number) => void;
}

const WizardBreadcrumb = ({ steps, onStepClick }: WizardBreadcrumbProps) => {
  const { t } = useTranslation();

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between gap-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center flex-1">
            <button
              onClick={() => onStepClick?.(step.id)}
              disabled={!step.isCompleted && !step.isActive}
              className={cn(
                "flex items-center gap-2 transition-all duration-200 group",
                (step.isCompleted || step.isActive) && "cursor-pointer",
                !step.isCompleted && !step.isActive && "cursor-not-allowed opacity-50"
              )}
            >
              <span
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200",
                  step.isCompleted && "bg-primary text-primary-foreground",
                  step.isActive && !step.isCompleted && "bg-primary/20 text-primary border-2 border-primary",
                  !step.isActive && !step.isCompleted && "bg-muted text-muted-foreground",
                  step.isSkipped && "bg-muted/50 text-muted-foreground line-through"
                )}
              >
                {step.isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  step.id
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium hidden sm:block",
                  step.isActive && "text-foreground",
                  step.isCompleted && "text-primary",
                  !step.isActive && !step.isCompleted && "text-muted-foreground",
                  step.isSkipped && "line-through"
                )}
              >
                {t(step.labelKey)}
              </span>
            </button>
            
            {index < steps.length - 1 && (
              <div 
                className={cn(
                  "flex-1 h-0.5 mx-3 transition-colors duration-200",
                  step.isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default WizardBreadcrumb;

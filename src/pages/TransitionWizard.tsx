import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import {
  WizardBreadcrumb,
  WizardProjectStep,
  WizardScenarioStep,
  WizardTCOStep,
  WizardInfraStep,
  WizardRoadmapStep,
} from "@/components/wizard";
import type { WizardStep } from "@/components/wizard/WizardBreadcrumb";

interface WizardState {
  projectId: string | null;
  scenarioId: string | null;
  tcoData: any | null;
  infraData: any | null;
  infraSkipped: boolean;
}

const TransitionWizard = () => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    projectId: null,
    scenarioId: null,
    tcoData: null,
    infraData: null,
    infraSkipped: false,
  });

  const steps: WizardStep[] = [
    { id: 1, labelKey: 'wizard.steps.project', isCompleted: !!state.projectId, isActive: currentStep === 1 },
    { id: 2, labelKey: 'wizard.steps.scenario', isCompleted: !!state.scenarioId, isActive: currentStep === 2 },
    { id: 3, labelKey: 'wizard.steps.tco', isCompleted: !!state.tcoData, isActive: currentStep === 3 },
    { id: 4, labelKey: 'wizard.steps.infra', isCompleted: !!state.infraData || state.infraSkipped, isActive: currentStep === 4, isSkipped: state.infraSkipped },
    { id: 5, labelKey: 'wizard.steps.roadmap', isCompleted: false, isActive: currentStep === 5 },
  ];

  const handleStepClick = (stepId: number) => {
    // Only allow going back to completed steps
    if (stepId < currentStep) {
      setCurrentStep(stepId);
    }
  };

  const handleProjectComplete = (projectId: string) => {
    setState(prev => ({ ...prev, projectId }));
    setCurrentStep(2);
  };

  const handleScenarioComplete = (scenarioId: string) => {
    setState(prev => ({ ...prev, scenarioId }));
    setCurrentStep(3);
  };

  const handleTCOComplete = (tcoData: any) => {
    setState(prev => ({ ...prev, tcoData }));
    setCurrentStep(4);
  };

  const handleInfraComplete = (infraData: any) => {
    setState(prev => ({ ...prev, infraData, infraSkipped: false }));
    setCurrentStep(5);
  };

  const handleInfraSkip = () => {
    setState(prev => ({ ...prev, infraSkipped: true }));
    setCurrentStep(5);
  };

  const handleBack = (targetStep: number) => {
    setCurrentStep(targetStep);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('wizard.title', 'Transition Planning Wizard')}
          </h1>
          <p className="text-muted-foreground">
            {t('wizard.subtitle', 'Create a complete transition plan in 5 simple steps')}
          </p>
        </div>

        <WizardBreadcrumb steps={steps} onStepClick={handleStepClick} />

        {currentStep === 1 && (
          <WizardProjectStep onComplete={handleProjectComplete} />
        )}

        {currentStep === 2 && state.projectId && (
          <WizardScenarioStep
            projectId={state.projectId}
            onComplete={handleScenarioComplete}
            onBack={() => handleBack(1)}
          />
        )}

        {currentStep === 3 && state.scenarioId && (
          <WizardTCOStep
            scenarioId={state.scenarioId}
            onComplete={handleTCOComplete}
            onBack={() => handleBack(2)}
          />
        )}

        {currentStep === 4 && state.scenarioId && (
          <WizardInfraStep
            scenarioId={state.scenarioId}
            onComplete={handleInfraComplete}
            onBack={() => handleBack(3)}
            onSkip={handleInfraSkip}
          />
        )}

        {currentStep === 5 && state.projectId && state.scenarioId && (
          <WizardRoadmapStep
            projectId={state.projectId}
            scenarioId={state.scenarioId}
            onBack={() => handleBack(4)}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default TransitionWizard;

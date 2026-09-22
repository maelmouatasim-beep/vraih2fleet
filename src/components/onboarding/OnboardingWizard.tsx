import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Package, 
  Truck, 
  Bus, 
  Settings, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  TrendingDown,
  Leaf,
  FileText,
  Check
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  emoji: string;
  vehicleCount: number;
  dailyKm: number;
  vehicleType: string;
  charging: string;
  powertrain: 'bev' | 'fcev' | 'mix';
  color: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'urban_delivery',
    name: 'Livraison urbaine',
    description: '40 VUL, 100km/jour, recharge nuit',
    icon: <Package className="h-8 w-8" />,
    emoji: '📦',
    vehicleCount: 40,
    dailyKm: 100,
    vehicleType: 'VUL 3.5T',
    charging: 'Recharge nocturne au dépôt',
    powertrain: 'bev',
    color: 'bg-blue-500',
  },
  {
    id: 'regional_transport',
    name: 'Transport régional',
    description: '25 camions 19T, 250km/jour, mix BEV/H₂',
    icon: <Truck className="h-8 w-8" />,
    emoji: '🚛',
    vehicleCount: 25,
    dailyKm: 250,
    vehicleType: 'Porteur 19T',
    charging: 'Mix recharge dépôt + stations H₂',
    powertrain: 'mix',
    color: 'bg-amber-500',
  },
  {
    id: 'urban_bus',
    name: 'Bus urbains',
    description: '15 bus 12m, 180km/jour, recharge dépôt',
    icon: <Bus className="h-8 w-8" />,
    emoji: '🚌',
    vehicleCount: 15,
    dailyKm: 180,
    vehicleType: 'Bus 12m',
    charging: 'Recharge au dépôt (nuit + opportunité)',
    powertrain: 'bev',
    color: 'bg-emerald-500',
  },
  {
    id: 'custom',
    name: 'Partir de zéro',
    description: 'Configurez tous les paramètres manuellement',
    icon: <Settings className="h-8 w-8" />,
    emoji: '⚙️',
    vehicleCount: 0,
    dailyKm: 0,
    vehicleType: 'Personnalisé',
    charging: 'À définir',
    powertrain: 'bev',
    color: 'bg-slate-500',
  },
];

interface ResultSummary {
  tcoDiesel: number;
  tcoBev: number;
  savings: number;
  savingsPercent: number;
  co2Saved: number;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [results, setResults] = useState<ResultSummary | null>(null);
  const navigate = useNavigate();

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  const handleCreateProject = async () => {
    // For now, route users to the real (persisted) project creation flow.
    onComplete();
    navigate('/dashboard/projects?create=true');
  };

  const handleGoToProject = () => {
    toast({
      title: 'Créer votre premier projet',
      description: 'Configurez les paramètres de base pour démarrer.',
    });
    onComplete();
    navigate('/dashboard/projects?create=true');
  };

  const handleNewScenario = () => {
    onComplete();
    navigate('/dashboard/projects?create=true');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  };

  const formatTons = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-4">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Étape {step} sur {totalSteps}</span>
            <span className="text-sm font-medium text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="shadow-xl border-2">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <>
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-3xl">Bienvenue sur H2Fleet !</CardTitle>
                <CardDescription className="text-lg mt-2">
                  Je vais vous guider en 4 étapes pour créer votre premier projet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                      <TrendingDown className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-semibold mb-1">Calculez votre TCO</h3>
                    <p className="text-sm text-muted-foreground">Comparez les coûts totaux de possession</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                      <Leaf className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-semibold mb-1">Réduisez vos émissions</h3>
                    <p className="text-sm text-muted-foreground">Mesurez l'impact environnemental</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                      <FileText className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="font-semibold mb-1">Exportez vos rapports</h3>
                    <p className="text-sm text-muted-foreground">Générez des analyses détaillées</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Button size="lg" onClick={() => setStep(2)} className="gap-2">
                    Commencer le guide
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={onSkip}>
                    Passer - Explorer seul
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Template Selection */}
          {step === 2 && (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Choisissez un template pour démarrer rapidement</CardTitle>
                <CardDescription>
                  Sélectionnez un scénario pré-configuré adapté à votre activité
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TEMPLATES.map((template) => (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedTemplate?.id === template.id
                          ? 'ring-2 ring-primary border-primary'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg ${template.color} text-white`}>
                            {template.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xl">{template.emoji}</span>
                              <h3 className="font-semibold">{template.name}</h3>
                              {selectedTemplate?.id === template.id && (
                                <Check className="h-4 w-4 text-primary ml-auto" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                            {template.id !== 'custom' && (
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {template.vehicleCount} véhicules
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {template.dailyKm} km/jour
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Retour
                  </Button>
                  <Button 
                    onClick={() => selectedTemplate?.id === 'custom' ? handleGoToProject() : setStep(3)} 
                    disabled={!selectedTemplate}
                    className="gap-2"
                  >
                    {selectedTemplate?.id === 'custom' ? 'Créer un projet vide' : 'Utiliser ce template'}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Creating Project */}
          {step === 3 && selectedTemplate && (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Création de votre projet</CardTitle>
                <CardDescription>
                  Génération automatique de 2 scénarios: "Diesel actuel" et "{selectedTemplate.powertrain === 'bev' ? 'Électrique BEV' : selectedTemplate.powertrain === 'fcev' ? 'Hydrogène FCEV' : 'Mix BEV/FCEV'}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Card className="bg-muted/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`p-3 rounded-lg ${selectedTemplate.color} text-white`}>
                        {selectedTemplate.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{selectedTemplate.emoji} {selectedTemplate.name}</h3>
                        <p className="text-muted-foreground">{selectedTemplate.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Véhicules</p>
                        <p className="font-semibold">{selectedTemplate.vehicleCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Type</p>
                        <p className="font-semibold">{selectedTemplate.vehicleType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Distance/jour</p>
                        <p className="font-semibold">{selectedTemplate.dailyKm} km</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Recharge</p>
                        <p className="font-semibold text-xs">{selectedTemplate.charging}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-2" disabled={isCreating}>
                    <ChevronLeft className="h-4 w-4" />
                    Changer de template
                  </Button>
                  <Button onClick={handleCreateProject} disabled={isCreating} className="gap-2">
                    {isCreating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Création en cours...
                      </>
                    ) : (
                      <>
                        Créer le projet
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 4: Results */}
          {step === 4 && results && selectedTemplate && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle className="text-2xl">Vos résultats instantanés</CardTitle>
                <CardDescription>
                  Projection sur 10 ans pour votre flotte de {selectedTemplate.vehicleCount} véhicules
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* TCO Comparison */}
                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-amber-700 dark:text-amber-400 mb-1">TCO Diesel (10 ans)</p>
                      <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{formatCurrency(results.tcoDiesel)}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-1">TCO Électrique (10 ans)</p>
                      <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(results.tcoBev)}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">Économies estimées</p>
                      <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                        {formatCurrency(results.savings)}
                        <span className="text-sm font-normal ml-1">({results.savingsPercent}%)</span>
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-4 flex items-center justify-center gap-4">
                    <Leaf className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-green-700 dark:text-green-400">CO₂ évité sur 10 ans</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-300">{formatTons(results.co2Saved)} tonnes</p>
                    </div>
                  </CardContent>
                </Card>

                <p className="text-sm text-muted-foreground text-center">
                  Vous pouvez maintenant modifier les paramètres ou exporter le rapport
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                  <Button onClick={handleGoToProject} className="gap-2">
                    Modifier mon projet
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={handleNewScenario}>
                    Créer nouveau scénario
                  </Button>
                  <Button variant="outline" onClick={() => {
                    toast({
                      title: 'Export PDF',
                      description: 'Fonctionnalité disponible dans le détail du projet.',
                    });
                    handleGoToProject();
                  }}>
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter PDF
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

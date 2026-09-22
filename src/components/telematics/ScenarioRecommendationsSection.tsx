import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScenarioRecommendation } from "@/lib/mockTelematicsData";
import { Sparkles, TrendingDown, Leaf, Building2, ArrowRight, Shield, Scale, Rocket } from "lucide-react";

interface ScenarioRecommendationsSectionProps {
  recommendations: ScenarioRecommendation[];
  totalVehicles: number;
}

const ScenarioRecommendationsSection = ({ recommendations, totalVehicles }: ScenarioRecommendationsSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGenerateScenario = (rec: ScenarioRecommendation) => {
    navigate('/dashboard/scenarios/new', {
      state: {
        fromTelematics: true,
        scenarioName: `${t(`telematics.scenarioTypes.${rec.type.toLowerCase()}`)} Transition`,
        bevPercent: rec.bevPercent,
        fcevPercent: rec.fcevPercent,
        dieselPercent: rec.dieselPercent,
        totalVehicles,
      }
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Conservative': return <Shield className="w-5 h-5 text-blue-500" />;
      case 'Balanced': return <Scale className="w-5 h-5 text-green-500" />;
      case 'Aggressive': return <Rocket className="w-5 h-5 text-purple-500" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Conservative': return 'border-blue-500/50 bg-blue-500/5';
      case 'Balanced': return 'border-green-500/50 bg-green-500/5';
      case 'Aggressive': return 'border-purple-500/50 bg-purple-500/5';
      default: return '';
    }
  };

  const getTypeName = (type: string) => {
    const key = type.toLowerCase();
    return t(`telematics.scenarioTypes.${key}`, type);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          {t('pages.telematics.scenarios.title')}
        </CardTitle>
        <CardDescription>
          {t('pages.telematics.scenarios.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`border-2 rounded-lg p-5 space-y-4 transition-all hover:shadow-md ${getTypeColor(rec.type)}`}
            >
              <div className="flex items-center gap-3">
                {getTypeIcon(rec.type)}
                <h4 className="font-semibold text-lg">{getTypeName(rec.type)}</h4>
              </div>

              <div className="space-y-2">
                <h5 className="text-sm font-medium text-muted-foreground">
                  {t('pages.telematics.scenarios.fleetComposition')}
                </h5>
                <div className="flex flex-wrap gap-2">
                  {rec.bevPercent > 0 && (
                    <Badge variant="default" className="bg-green-600">
                      {rec.bevPercent}% BEV ({rec.bevCount})
                    </Badge>
                  )}
                  {rec.fcevPercent > 0 && (
                    <Badge variant="default" className="bg-blue-600">
                      {rec.fcevPercent}% FCEV ({rec.fcevCount})
                    </Badge>
                  )}
                  {rec.dieselPercent > 0 && (
                    <Badge variant="secondary">
                      {rec.dieselPercent}% Diesel ({rec.dieselCount})
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">{t('pages.telematics.scenarios.tcoSavings')}:</span>
                  <span className="font-semibold">${(rec.tcoSavings / 1000).toFixed(0)}k CAD</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Leaf className="w-4 h-4 text-green-500" />
                  <span className="text-muted-foreground">{t('pages.telematics.scenarios.co2Reduction')}:</span>
                  <span className="font-semibold">{rec.co2Reduction} t/year</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">{t('pages.telematics.scenarios.infrastructure')}:</span>
                  <span className="font-semibold text-xs">{rec.infrastructureNeeded}</span>
                </div>
              </div>

              <Button 
                onClick={() => handleGenerateScenario(rec)} 
                className="w-full"
                variant={rec.type === 'Balanced' ? 'default' : 'outline'}
              >
                {t('pages.telematics.scenarios.generate')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScenarioRecommendationsSection;

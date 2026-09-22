import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Region, STATES_PROVINCES } from '@/lib/calculations/types';
import { formatEnergyPrice } from '@/lib/currency';
import { Lightbulb, Zap, Fuel, Atom } from 'lucide-react';

interface PriceGuidanceProps {
  region: Region;
  onPrefill: (prices: { electricity: number; diesel: number; hydrogen: number }) => void;
  targetPowertrain?: string;
}

export function PriceGuidance({ region, onPrefill, targetPowertrain }: PriceGuidanceProps) {
  const { t } = useTranslation();
  
  // Find the region info
  const stateInfo = STATES_PROVINCES.Canada?.find(s => s.code === region);
  
  if (!stateInfo) return null;

  const handlePrefill = () => {
    onPrefill({
      electricity: stateInfo.electricityPrice || 0.12,
      diesel: stateInfo.dieselPrice || 1.50,
      hydrogen: stateInfo.hydrogenPrice || 15.00,
    });
  };

  const showHydrogen = targetPowertrain === 'fcev';

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('pricing.guidance.helpTitle', '💡 Need help? Regional averages available')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pricing.guidance.indicativeOnly', 'These prices are for reference only. Use the button below to pre-fill if you don\'t have your actual prices.')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 bg-background/50 rounded-md p-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">{t('energy.electricity', 'Electricity')}</p>
                <p className="text-sm font-medium">
                  {stateInfo.electricityPrice 
                    ? formatEnergyPrice(stateInfo.electricityPrice, region, 'electricity')
                    : 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-background/50 rounded-md p-2">
              <Fuel className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">{t('energy.diesel', 'Diesel')}</p>
                <p className="text-sm font-medium">
                  {stateInfo.dieselPrice 
                    ? formatEnergyPrice(stateInfo.dieselPrice, region, 'diesel')
                    : 'N/A'}
                </p>
              </div>
            </div>
            
            {showHydrogen && (
              <div className="flex items-center gap-2 bg-background/50 rounded-md p-2">
                <Atom className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">{t('energy.hydrogen', 'Hydrogen')}</p>
                  <p className="text-sm font-medium">
                    {stateInfo.hydrogenPrice 
                      ? formatEnergyPrice(stateInfo.hydrogenPrice, region, 'hydrogen')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handlePrefill}
            className="w-full md:w-auto"
          >
            {t('pricing.guidance.usePrefill', 'Use {{region}} averages', { region: stateInfo.name })}
          </Button>
        </div>
      </div>
    </div>
  );
}

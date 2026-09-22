import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface InfoTooltipProps {
  content: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function InfoTooltip({ content, className, side = 'top' }: InfoTooltipProps) {
  const { t } = useTranslation();
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
            className
          )}
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">{t('common.moreInfo', 'More information')}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-sm">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

// Field tooltips keys mapping to i18n
export const FIELD_TOOLTIPS_KEYS: Record<string, string> = {
  ptac: 'tooltips.ptac',
  annualKm: 'tooltips.annualKm',
  fcev: 'tooltips.fcev',
  tco: 'tooltips.tco',
  discountRate: 'tooltips.discountRate',
  minAutonomy: 'tooltips.minAutonomy',
  chargingTime: 'tooltips.chargingTime',
  loadProfile: 'tooltips.loadProfile',
  minTemperature: 'tooltips.minTemperature',
  tripType: 'tooltips.tripType',
  subsidies: 'tooltips.subsidies',
  maintenance: 'tooltips.maintenance',
  vehiclePrice: 'tooltips.vehiclePrice',
};

// Hook to get translated tooltip content
export function useFieldTooltip(fieldKey: string): string {
  const { t } = useTranslation();
  const i18nKey = FIELD_TOOLTIPS_KEYS[fieldKey];
  if (!i18nKey) return '';
  return t(i18nKey, '');
}

// Legacy export for backward compatibility - components should migrate to useFieldTooltip
export const FIELD_TOOLTIPS: Record<string, string> = {
  ptac: "Gross Vehicle Weight Rating. Ex: Rigid truck 12-19T, Road tractor 44T. Impacts required battery capacity.",
  annualKm: "Typical examples: Urban delivery 25-40k km/year, Regional 50-80k, Long distance 100-150k.",
  fcev: "FCEV = Fuel Cell Electric Vehicle (hydrogen). Recommended for heavy trucks long distance >300km/day.",
  tco: "Total Cost of Ownership = Total cost including purchase, maintenance, fuel/energy, insurance over entire lifetime.",
  discountRate: "Rate used to calculate present value of future flows. Typically 4-8% for business projects.",
  minAutonomy: "Minimum range required for your daily routes. Plan for a 20% margin for contingencies.",
  chargingTime: "Available pause time for recharging. Fast DC charging: 30min-1h, Slow AC charging: 6-8h.",
  loadProfile: "Average vehicle load profile. Impacts energy consumption and battery wear.",
  minTemperature: "Minimum operating temperature. Batteries lose 15-25% range in cold weather (-10°C).",
  tripType: "Type of trips made. Urban: frequent stops, Peri-urban: mixed, Regional: inter-city, Long distance: highway.",
  subsidies: "Available incentives: Ecological bonus, Conversion premium, Regional grants, Tax depreciation.",
  maintenance: "EV maintenance costs typically 30-40% lower than diesel (fewer wear parts).",
  vehiclePrice: "Catalog price excluding tax. EVs are more expensive to purchase but cheaper to operate.",
};

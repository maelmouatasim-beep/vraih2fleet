import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  FileCheck, 
  TrendingUp, 
  Receipt, 
  Satellite, 
  FileSpreadsheet, 
  FlaskConical,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import { DataSourceType, DATA_SOURCE_LABELS, DATA_SOURCE_LABELS_EN } from '@/lib/calculations/flexibleTypes';

interface SourceDropdownProps {
  value: DataSourceType | undefined;
  onChange: (value: DataSourceType) => void;
  className?: string;
  disabled?: boolean;
}

const sourceIcons: Record<DataSourceType, React.ElementType> = {
  quote: FileText,
  contract: FileCheck,
  market: TrendingUp,
  current_price: Receipt,
  telematics: Satellite,
  manufacturer_specs: FileSpreadsheet,
  pilot_test: FlaskConical,
  reference: BookOpen,
  estimate: HelpCircle,
};

const sourceColors: Record<DataSourceType, string> = {
  quote: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  contract: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  market: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  current_price: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  telematics: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  manufacturer_specs: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  pilot_test: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  reference: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  estimate: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function SourceDropdown({ value, onChange, className, disabled }: SourceDropdownProps) {
  const { i18n } = useTranslation();
  const labels = i18n.language === 'fr' ? DATA_SOURCE_LABELS : DATA_SOURCE_LABELS_EN;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`w-[180px] h-8 text-xs ${className}`}>
        <SelectValue placeholder="Source..." />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(labels) as DataSourceType[]).map((source) => {
          const Icon = sourceIcons[source];
          return (
            <SelectItem key={source} value={source} className="text-xs">
              <div className="flex items-center gap-2">
                <Icon className="h-3 w-3" />
                <span>{labels[source]}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

interface SourceBadgeProps {
  source: DataSourceType | undefined;
  className?: string;
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const { i18n } = useTranslation();
  
  if (!source) {
    return (
      <Badge variant="outline" className={`text-xs gap-1 ${className}`}>
        <HelpCircle className="h-3 w-3" />
        Non spécifié
      </Badge>
    );
  }
  
  const labels = i18n.language === 'fr' ? DATA_SOURCE_LABELS : DATA_SOURCE_LABELS_EN;
  const Icon = sourceIcons[source];
  const colorClass = sourceColors[source];
  
  return (
    <Badge className={`text-xs gap-1 ${colorClass} ${className}`}>
      <Icon className="h-3 w-3" />
      {labels[source]}
    </Badge>
  );
}

export default SourceDropdown;

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { FormField as FormFieldType } from './categorySchemas';
import { cn } from '@/lib/utils';

interface DynamicFormFieldProps {
  field: FormFieldType;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  watchValues?: Record<string, unknown>;
}

export function DynamicFormField({ field, value, onChange, error, watchValues }: DynamicFormFieldProps) {
  const { i18n } = useTranslation();
  const isFr = i18n.language === 'fr';

  // Check conditional visibility
  if (field.conditionalOn) {
    const watchedValue = watchValues?.[field.conditionalOn.field];
    if (!field.conditionalOn.values.includes(watchedValue as string)) {
      return null;
    }
  }

  const label = isFr ? field.labelFr : field.label;
  const placeholder = isFr ? (field.placeholderFr || field.placeholder) : field.placeholder;
  const helpText = isFr ? field.helpTextFr : field.helpText;

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <div className="relative">
            <Input
              type={field.type}
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={cn(
                error && 'border-destructive',
                field.unit && 'pr-16'
              )}
            />
            {field.unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {field.unit}
              </span>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="relative">
            <Input
              type="number"
              value={value !== undefined && value !== null ? String(value) : ''}
              onChange={(e) => {
                const val = e.target.value;
                onChange(val === '' ? undefined : parseFloat(val));
              }}
              placeholder={placeholder}
              min={field.min}
              max={field.max}
              className={cn(
                error && 'border-destructive',
                field.unit && 'pr-16'
              )}
            />
            {field.unit && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {field.unit}
              </span>
            )}
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(error && 'border-destructive')}
          />
        );

      case 'time':
        return (
          <Input
            type="time"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(error && 'border-destructive')}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={cn(error && 'border-destructive')}
          />
        );

      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={onChange}
          >
            <SelectTrigger className={cn(error && 'border-destructive')}>
              <SelectValue placeholder={isFr ? 'Sélectionner...' : 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {isFr ? option.labelFr : option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-background">
              {selectedValues.length === 0 && (
                <span className="text-muted-foreground text-sm">
                  {isFr ? 'Aucune sélection' : 'None selected'}
                </span>
              )}
              {selectedValues.map((val) => {
                const option = field.options?.find((o) => o.value === val);
                return (
                  <Badge
                    key={val}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive/20"
                    onClick={() => onChange(selectedValues.filter((v) => v !== val))}
                  >
                    {option ? (isFr ? option.labelFr : option.label) : val}
                    <span className="ml-1 text-xs">×</span>
                  </Badge>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {field.options?.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onChange([...selectedValues, option.value]);
                        } else {
                          onChange(selectedValues.filter((v) => v !== option.value));
                        }
                      }}
                    />
                    <span>{isFr ? option.labelFr : option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className={cn(field.required && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
          {label}
        </Label>
        {helpText && <InfoTooltip content={helpText} />}
      </div>
      {renderField()}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

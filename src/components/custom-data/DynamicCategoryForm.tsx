import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFieldsForCategory } from './categoryFields';
import { DynamicFormField } from './DynamicFormField';
import { getSchemaForCategory, FormField } from './categorySchemas';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DynamicCategoryFormProps {
  category: string;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
}

interface CustomField {
  key: string;
  value: string;
  type: 'text' | 'number' | 'date';
}

export function DynamicCategoryForm({ category, values, onChange, errors, setErrors }: DynamicCategoryFormProps) {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language === 'fr';
  const fields = getFieldsForCategory(category);
  
  // Group fields by section
  const sections = useMemo(() => {
    const grouped: Record<string, FormField[]> = {};
    fields.forEach((field) => {
      const section = isFr ? (field.sectionFr || field.section || 'General') : (field.section || 'General');
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(field);
    });
    return grouped;
  }, [fields, isFr]);

  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    // Open first two sections by default
    const sectionKeys = Object.keys(sections);
    return new Set(sectionKeys.slice(0, 2));
  });

  // Custom fields for "other" category
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const toggleSection = (section: string) => {
    const newOpen = new Set(openSections);
    if (newOpen.has(section)) {
      newOpen.delete(section);
    } else {
      newOpen.add(section);
    }
    setOpenSections(newOpen);
  };

  const handleFieldChange = (fieldName: string, value: unknown) => {
    onChange({ ...values, [fieldName]: value });
    // Clear error when field is edited
    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  };

  // Validate on blur
  const validateField = (fieldName: string) => {
    const schema = getSchemaForCategory(category);
    try {
      const fieldSchema = schema.shape?.[fieldName];
      if (fieldSchema) {
        fieldSchema.parse(values[fieldName]);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const zodError = err as { errors: Array<{ message: string }> };
        setErrors({ ...errors, [fieldName]: zodError.errors[0]?.message || 'Invalid value' });
      }
    }
  };

  // Handle "Other" category with dynamic fields
  if (category === 'other') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="after:content-['*'] after:ml-0.5 after:text-destructive">
            {isFr ? 'Titre' : 'Title'}
          </Label>
          <Input
            value={(values.title as string) || ''}
            onChange={(e) => handleFieldChange('title', e.target.value)}
            placeholder={isFr ? 'ex. Données personnalisées' : 'e.g., Custom Data Entry'}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
        </div>

        <div className="space-y-2">
          <Label>{isFr ? 'Description' : 'Description'}</Label>
          <Textarea
            value={(values.description as string) || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            placeholder={isFr ? 'Description de ces données...' : 'Description of this data...'}
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{isFr ? 'Champs personnalisés' : 'Custom Fields'}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newFields = [...customFields, { key: '', value: '', type: 'text' as const }];
                setCustomFields(newFields);
                handleFieldChange('customFields', newFields);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              {isFr ? 'Ajouter un champ' : 'Add Field'}
            </Button>
          </div>

          {customFields.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
              {isFr 
                ? 'Cliquez sur "Ajouter un champ" pour créer des champs personnalisés'
                : 'Click "Add Field" to create custom fields'}
            </p>
          )}

          {customFields.map((field, index) => (
            <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-muted/30">
              <div className="flex-1 space-y-2">
                <Input
                  value={field.key}
                  onChange={(e) => {
                    const newFields = [...customFields];
                    newFields[index].key = e.target.value;
                    setCustomFields(newFields);
                    handleFieldChange('customFields', newFields);
                  }}
                  placeholder={isFr ? 'Nom du champ' : 'Field name'}
                  className="text-sm"
                />
              </div>
              <div className="w-24">
                <Select
                  value={field.type}
                  onValueChange={(val: 'text' | 'number' | 'date') => {
                    const newFields = [...customFields];
                    newFields[index].type = val;
                    setCustomFields(newFields);
                    handleFieldChange('customFields', newFields);
                  }}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{isFr ? 'Texte' : 'Text'}</SelectItem>
                    <SelectItem value="number">{isFr ? 'Nombre' : 'Number'}</SelectItem>
                    <SelectItem value="date">{isFr ? 'Date' : 'Date'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                  value={field.value}
                  onChange={(e) => {
                    const newFields = [...customFields];
                    newFields[index].value = e.target.value;
                    setCustomFields(newFields);
                    handleFieldChange('customFields', newFields);
                  }}
                  placeholder={isFr ? 'Valeur' : 'Value'}
                  className="text-sm"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-destructive hover:text-destructive"
                onClick={() => {
                  const newFields = customFields.filter((_, i) => i !== index);
                  setCustomFields(newFields);
                  handleFieldChange('customFields', newFields);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render normal category form
  return (
    <div className="space-y-4">
      {Object.entries(sections).map(([section, sectionFields]) => {
        const isOpen = openSections.has(section);
        const sectionIcon = getSectionIcon(section);

        return (
          <Collapsible key={section} open={isOpen} onOpenChange={() => toggleSection(section)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
              <span className="flex items-center gap-2 font-medium">
                <span>{sectionIcon}</span>
                {section}
              </span>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-2">
                {sectionFields.map((field) => (
                  <div 
                    key={field.name}
                    className={field.type === 'textarea' || field.type === 'multiselect' ? 'md:col-span-2' : ''}
                  >
                    <DynamicFormField
                      field={field}
                      value={values[field.name]}
                      onChange={(val) => handleFieldChange(field.name, val)}
                      error={errors[field.name]}
                      watchValues={values}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function getSectionIcon(section: string): string {
  const lower = section.toLowerCase();
  if (lower.includes('basic') || lower.includes('base')) return '📋';
  if (lower.includes('contact') || lower.includes('coordon')) return '📞';
  if (lower.includes('license') || lower.includes('permis') || lower.includes('certification')) return '📜';
  if (lower.includes('vehicle') || lower.includes('véhicule')) return '🚚';
  if (lower.includes('power') || lower.includes('puissance') || lower.includes('performance')) return '⚡';
  if (lower.includes('registration') || lower.includes('immatriculation')) return '📄';
  if (lower.includes('purchase') || lower.includes('achat')) return '💼';
  if (lower.includes('equipment') || lower.includes('équipement')) return '🔧';
  if (lower.includes('schedule') || lower.includes('planification')) return '📅';
  if (lower.includes('assignment') || lower.includes('attribution')) return '👤';
  if (lower.includes('route') || lower.includes('itinéraire')) return '🗺️';
  if (lower.includes('detail') || lower.includes('détail')) return '📊';
  if (lower.includes('condition')) return '🌡️';
  if (lower.includes('station')) return '⛽';
  if (lower.includes('location') || lower.includes('localisation')) return '📍';
  if (lower.includes('technical') || lower.includes('technique')) return '⚙️';
  if (lower.includes('pricing') || lower.includes('tarif')) return '💰';
  if (lower.includes('access') || lower.includes('accès')) return '🔑';
  if (lower.includes('metric') || lower.includes('métrique')) return '📈';
  if (lower.includes('note')) return '📝';
  return '📂';
}

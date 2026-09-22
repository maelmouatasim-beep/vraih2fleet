import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { CATEGORIES, getSchemaForCategory } from './categorySchemas';
import { DynamicCategoryForm } from './DynamicCategoryForm';
import { Code, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateCustomDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; category: string; description: string; data: Record<string, unknown> }) => void;
  editingItem?: {
    id: string;
    name: string;
    category: string;
    description: string | null;
    data: Record<string, unknown>;
  } | null;
  isSaving: boolean;
}

export function CreateCustomDataDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  editingItem, 
  isSaving 
}: CreateCustomDataDialogProps) {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language === 'fr';

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  
  // Advanced mode toggle
  const [advancedMode, setAdvancedMode] = useState(false);
  const [rawJson, setRawJson] = useState('{}');

  // Reset form when dialog opens/closes or editingItem changes
  useEffect(() => {
    if (open) {
      if (editingItem) {
        setName(editingItem.name);
        setCategory(editingItem.category);
        setDescription(editingItem.description || '');
        setFormValues(editingItem.data || {});
        setRawJson(JSON.stringify(editingItem.data || {}, null, 2));
      } else {
        setName('');
        setCategory('');
        setDescription('');
        setFormValues({});
        setRawJson('{}');
      }
      setErrors({});
      setFormError('');
      setAdvancedMode(false);
    }
  }, [open, editingItem]);

  // Sync raw JSON when form values change (for advanced mode preview)
  useEffect(() => {
    if (!advancedMode) {
      setRawJson(JSON.stringify(formValues, null, 2));
    }
  }, [formValues, advancedMode]);

  // Auto-generate name based on category and key field
  useEffect(() => {
    if (!editingItem && category && !name) {
      const catDef = CATEGORIES.find(c => c.value === category);
      const keyField = getKeyFieldForCategory(category);
      const keyValue = formValues[keyField] as string;
      
      if (keyValue) {
        setName(keyValue);
      } else if (catDef) {
        const today = new Date().toLocaleDateString('en-CA');
        setName(`${isFr ? catDef.labelFr : catDef.label} - ${today}`);
      }
    }
  }, [category, formValues, editingItem, name, isFr]);

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setFormValues({});
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors._name = isFr ? 'Le nom est requis' : 'Name is required';
    }
    if (!category) {
      newErrors._category = isFr ? 'La catégorie est requise' : 'Category is required';
    }

    // Validate category-specific fields
    if (category && !advancedMode) {
      try {
        const schema = getSchemaForCategory(category);
        schema.parse(formValues);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'errors' in err) {
          const zodError = err as { errors: Array<{ path: string[]; message: string }> };
          zodError.errors.forEach((e) => {
            if (e.path.length > 0) {
              newErrors[e.path[0]] = e.message;
            }
          });
        }
      }
    }

    // Validate JSON in advanced mode
    if (advancedMode) {
      try {
        JSON.parse(rawJson);
      } catch {
        newErrors._json = isFr ? 'JSON invalide' : 'Invalid JSON format';
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setFormError(isFr ? 'Veuillez corriger les erreurs ci-dessus' : 'Please fix the errors above');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    setFormError('');
    
    if (!validateForm()) return;

    const data = advancedMode ? JSON.parse(rawJson) : formValues;
    
    onSubmit({
      name: name.trim(),
      category,
      description: description.trim(),
      data,
    });
  };

  const selectedCategory = CATEGORIES.find(c => c.value === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {selectedCategory && <span>{selectedCategory.icon}</span>}
            {editingItem 
              ? (isFr ? 'Modifier les données' : 'Edit Reference Data')
              : (isFr ? 'Créer des données de référence' : 'Create Reference Data')}
          </DialogTitle>
          <DialogDescription>
            {isFr 
              ? 'Ajoutez des données personnalisées pour la gestion de votre flotte.'
              : 'Add custom reference data for your fleet management.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            {/* Category Selection */}
            {!category && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">
                  {isFr ? '🏷️ Choisir une catégorie' : '🏷️ Choose a Category'}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => handleCategorySelect(cat.value)}
                      className="flex items-start gap-3 p-3 text-left border rounded-lg hover:bg-muted/50 hover:border-primary transition-colors"
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <div>
                        <p className="font-medium">{isFr ? cat.labelFr : cat.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {isFr ? cat.descriptionFr : cat.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {errors._category && <p className="text-sm text-destructive">{errors._category}</p>}
              </div>
            )}

            {/* Selected category header */}
            {category && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCategory('')}
                      className="text-muted-foreground"
                    >
                      ← {isFr ? 'Changer' : 'Change'}
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                      <span>{selectedCategory?.icon}</span>
                      <span className="font-medium text-sm">
                        {isFr ? selectedCategory?.labelFr : selectedCategory?.label}
                      </span>
                    </div>
                  </div>
                  
                  {/* Advanced mode toggle */}
                  <div className="flex items-center gap-2 text-sm">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {isFr ? 'Mode avancé' : 'Advanced'}
                    </span>
                    <Switch
                      checked={advancedMode}
                      onCheckedChange={setAdvancedMode}
                    />
                  </div>
                </div>

                {/* Name field */}
                <div className="space-y-2">
                  <Label className="after:content-['*'] after:ml-0.5 after:text-destructive">
                    {isFr ? 'Nom de l\'entrée' : 'Entry Name'}
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={isFr ? 'ex. Camion BYD #001' : 'e.g., BYD Truck #001'}
                    maxLength={100}
                  />
                  {errors._name && <p className="text-xs text-destructive">{errors._name}</p>}
                </div>

                {/* Description field */}
                <div className="space-y-2">
                  <Label>{isFr ? 'Description (optionnelle)' : 'Description (optional)'}</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isFr ? 'Brève description...' : 'Brief description...'}
                    rows={2}
                    maxLength={500}
                  />
                </div>

                {/* Dynamic form or JSON editor */}
                {advancedMode ? (
                  <div className="space-y-2">
                    <Label>{isFr ? 'Données JSON' : 'JSON Data'}</Label>
                    <Textarea
                      value={rawJson}
                      onChange={(e) => setRawJson(e.target.value)}
                      className="font-mono text-sm min-h-[200px]"
                      placeholder='{"key": "value"}'
                    />
                    {errors._json && <p className="text-xs text-destructive">{errors._json}</p>}
                    <p className="text-xs text-muted-foreground">
                      {isFr 
                        ? 'Entrez des données JSON valides. Le format sera validé à la soumission.'
                        : 'Enter valid JSON data. Format will be validated on submit.'}
                    </p>
                  </div>
                ) : (
                  <DynamicCategoryForm
                    category={category}
                    values={formValues}
                    onChange={setFormValues}
                    errors={errors}
                    setErrors={setErrors}
                  />
                )}
              </>
            )}

            {formError && (
              <p className="text-sm text-destructive text-center py-2 bg-destructive/10 rounded">
                {formError}
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isFr ? 'Annuler' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !category}>
            {isSaving ? (
              <>{isFr ? 'Enregistrement...' : 'Saving...'}</>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {editingItem 
                  ? (isFr ? 'Mettre à jour' : 'Update')
                  : (isFr ? 'Créer l\'entrée' : 'Create Entry')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getKeyFieldForCategory(category: string): string {
  switch (category) {
    case 'drivers': return 'driverName';
    case 'vehicles': return 'vehicleId';
    case 'maintenance': return 'equipmentId';
    case 'routes': return 'routeName';
    case 'charging': return 'stationName';
    case 'metrics': return 'metricName';
    case 'other': return 'title';
    default: return '';
  }
}

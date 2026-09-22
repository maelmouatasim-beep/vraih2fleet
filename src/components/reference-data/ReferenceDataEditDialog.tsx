import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ReferenceDataRange, 
  ConfidenceLevel,
  confidenceLabels 
} from '@/types/referenceData';
import { useUpdateReferenceData } from '@/hooks/useReferenceData';
import { AlertCircle } from 'lucide-react';

interface ReferenceDataEditDialogProps {
  data: ReferenceDataRange;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReferenceDataEditDialog({
  data,
  open,
  onOpenChange,
}: ReferenceDataEditDialogProps) {
  const [minValue, setMinValue] = useState(data.min_value.toString());
  const [midValue, setMidValue] = useState(data.mid_value.toString());
  const [maxValue, setMaxValue] = useState(data.max_value.toString());
  const [sourceUrl, setSourceUrl] = useState(data.source_url || '');
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>(data.confidence_level);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const updateMutation = useUpdateReferenceData();
  
  useEffect(() => {
    setMinValue(data.min_value.toString());
    setMidValue(data.mid_value.toString());
    setMaxValue(data.max_value.toString());
    setSourceUrl(data.source_url || '');
    setConfidenceLevel(data.confidence_level);
    setValidationError(null);
  }, [data]);
  
  const validate = (): boolean => {
    const min = parseFloat(minValue);
    const mid = parseFloat(midValue);
    const max = parseFloat(maxValue);
    
    if (isNaN(min) || isNaN(mid) || isNaN(max)) {
      setValidationError('All values must be valid numbers.');
      return false;
    }
    
    if (min >= mid) {
      setValidationError('Minimum value must be less than mid value.');
      return false;
    }
    
    if (mid >= max) {
      setValidationError('Mid value must be less than maximum value.');
      return false;
    }
    
    setValidationError(null);
    return true;
  };
  
  const handleSubmit = () => {
    if (!validate()) return;
    
    updateMutation.mutate({
      id: data.id,
      min_value: parseFloat(minValue),
      mid_value: parseFloat(midValue),
      max_value: parseFloat(maxValue),
      source_url: sourceUrl || null,
      confidence_level: confidenceLevel,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Reference Data</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Category</Label>
              <Input value={data.subcategory} disabled />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Region</Label>
              <Input value={data.region} disabled />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-muted-foreground">Unit</Label>
            <Input value={data.unit} disabled />
          </div>
          
          {/* Editable fields */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min">Min Value</Label>
              <Input
                id="min"
                type="number"
                step="any"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mid">Mid Value</Label>
              <Input
                id="mid"
                type="number"
                step="any"
                value={midValue}
                onChange={(e) => setMidValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max Value</Label>
              <Input
                id="max"
                type="number"
                step="any"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
              />
            </div>
          </div>
          
          {validationError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {validationError}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="confidence">Confidence Level</Label>
            <Select value={confidenceLevel} onValueChange={(v) => setConfidenceLevel(v as ConfidenceLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(confidenceLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="source">Source URL</Label>
            <Input
              id="source"
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

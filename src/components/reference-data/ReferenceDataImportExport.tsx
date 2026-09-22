import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { ReferenceDataRange, ReferenceCategory } from '@/types/referenceData';
import { useCreateReferenceData } from '@/hooks/useReferenceData';
import { toast } from '@/hooks/use-toast';

interface ReferenceDataImportExportProps {
  data: ReferenceDataRange[];
  category: ReferenceCategory;
}

export default function ReferenceDataImportExport({ data, category }: ReferenceDataImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateReferenceData();
  
  const handleExportCSV = () => {
    if (data.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There is no data available for this category.',
        variant: 'destructive',
      });
      return;
    }
    
    const headers = [
      'category',
      'subcategory',
      'region',
      'min_value',
      'mid_value',
      'max_value',
      'unit',
      'source_url',
      'confidence_level',
      'date_effective',
    ];
    
    const csvContent = [
      headers.join(','),
      ...data.map(item => [
        item.category,
        `"${item.subcategory}"`,
        item.region,
        item.min_value,
        item.mid_value,
        item.max_value,
        `"${item.unit}"`,
        item.source_url ? `"${item.source_url}"` : '',
        item.confidence_level,
        item.date_effective,
      ].join(',')),
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reference_data_${category}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Export successful',
      description: `Exported ${data.length} records to CSV.`,
    });
  };
  
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('CSV file must have a header row and at least one data row.');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['subcategory', 'region', 'min_value', 'mid_value', 'max_value', 'unit'];
        
        for (const required of requiredHeaders) {
          if (!headers.includes(required)) {
            throw new Error(`Missing required column: ${required}`);
          }
        }
        
        let importedCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
          });
          
          const min = parseFloat(row.min_value);
          const mid = parseFloat(row.mid_value);
          const max = parseFloat(row.max_value);
          
          if (isNaN(min) || isNaN(mid) || isNaN(max)) {
            console.warn(`Skipping row ${i + 1}: Invalid numeric values`);
            continue;
          }
          
          if (min >= mid || mid >= max) {
            console.warn(`Skipping row ${i + 1}: Values must satisfy min < mid < max`);
            continue;
          }
          
          await createMutation.mutateAsync({
            category,
            subcategory: row.subcategory,
            region: row.region,
            min_value: min,
            mid_value: mid,
            max_value: max,
            unit: row.unit,
            source_url: row.source_url || null,
            confidence_level: (row.confidence_level as any) || 'medium',
            date_effective: row.date_effective || new Date().toISOString().split('T')[0],
          });
          
          importedCount++;
        }
        
        toast({
          title: 'Import successful',
          description: `Imported ${importedCount} records.`,
        });
      } catch (error) {
        toast({
          title: 'Import failed',
          description: error instanceof Error ? error.message : 'Failed to parse CSV file.',
          variant: 'destructive',
        });
      }
    };
    
    reader.readAsText(file);
    
    // Reset the input so the same file can be imported again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportCSV}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2" />
        Import CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
      >
        <Download className="w-4 h-4 mr-2" />
        Export CSV
      </Button>
    </div>
  );
}

// Helper function to parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

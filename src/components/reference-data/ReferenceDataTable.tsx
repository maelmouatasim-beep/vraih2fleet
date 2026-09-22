import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Pencil, 
  Trash2, 
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  ReferenceDataRange, 
  confidenceLabels, 
  confidenceColors 
} from '@/types/referenceData';
import { format } from 'date-fns';
import ReferenceDataEditDialog from './ReferenceDataEditDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteReferenceData } from '@/hooks/useReferenceData';

interface ReferenceDataTableProps {
  data: ReferenceDataRange[];
  isLoading: boolean;
}

type SortField = 'subcategory' | 'region' | 'mid_value' | 'last_updated';
type SortOrder = 'asc' | 'desc';

export default function ReferenceDataTable({ data, isLoading }: ReferenceDataTableProps) {
  const [editingItem, setEditingItem] = useState<ReferenceDataRange | null>(null);
  const [deletingItem, setDeletingItem] = useState<ReferenceDataRange | null>(null);
  const [sortField, setSortField] = useState<SortField>('region');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  const deleteReferenceData = useDeleteReferenceData();
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  
  const sortedData = [...data].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'subcategory':
        comparison = a.subcategory.localeCompare(b.subcategory);
        break;
      case 'region':
        comparison = a.region.localeCompare(b.region);
        break;
      case 'mid_value':
        comparison = a.mid_value - b.mid_value;
        break;
      case 'last_updated':
        comparison = new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime();
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </TableHead>
  );
  
  const formatValue = (value: number, unit: string) => {
    return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available for this category.
      </div>
    );
  }
  
  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader field="subcategory">Category</SortHeader>
              <SortHeader field="region">Region</SortHeader>
              <TableHead>Min</TableHead>
              <SortHeader field="mid_value">Mid</SortHeader>
              <TableHead>Max</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Source</TableHead>
              <SortHeader field="last_updated">Last Updated</SortHeader>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.subcategory}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.region}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatValue(item.min_value, item.unit)}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatValue(item.mid_value, item.unit)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatValue(item.max_value, item.unit)}
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {item.unit}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge className={confidenceColors[item.confidence_level]}>
                    {confidenceLabels[item.confidence_level]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.source_url ? (
                    <a 
                      href={item.source_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                    >
                      Source
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(item.last_updated), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingItem(item)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingItem(item)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {editingItem && (
        <ReferenceDataEditDialog
          data={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
        />
      )}
      
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reference Data</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingItem?.subcategory}" for region "{deletingItem?.region}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingItem) {
                  deleteReferenceData.mutate(deletingItem.id);
                  setDeletingItem(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

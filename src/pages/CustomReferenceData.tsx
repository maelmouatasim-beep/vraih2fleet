import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Lock, Database, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CreateCustomDataDialog, CATEGORIES } from '@/components/custom-data';

interface CustomReferenceData {
  id: string;
  user_id: string;
  name: string;
  category: string;
  description: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const FeatureLockedCard = () => (
  <Card className="border-dashed border-2 border-muted">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Feature Not Available
      </h2>
      <p className="text-muted-foreground max-w-md mb-6">
        Custom Reference Data is available on Medium Fleet and Large Fleet plans. 
        Upgrade your subscription to store custom driver info, vehicle specifications, 
        and maintenance schedules.
      </p>
      <Button asChild>
        <Link to="/contact">
          <Crown className="w-4 h-4 mr-2" />
          Contact Us to Upgrade
        </Link>
      </Button>
    </CardContent>
  </Card>
);

export default function CustomReferenceData() {
  const { user } = useAuth();
  const { canAccessFeature, isLoading: subscriptionLoading } = useSubscription();
  const [data, setData] = useState<CustomReferenceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomReferenceData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasAccess = canAccessFeature('custom_reference_data');

  useEffect(() => {
    document.title = 'Custom Reference Data | H2Fleet Planner';
    if (user && hasAccess) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [user, hasAccess]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const { data: result, error } = await supabase
        .from('custom_reference_data')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setData((result as CustomReferenceData[]) || []);
    } catch (error) {
      console.error('Error fetching custom reference data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load custom reference data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: CustomReferenceData) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (formData: { name: string; category: string; description: string; data: Record<string, unknown> }) => {
    if (!user) return;

    try {
      setIsSaving(true);

      // Cast data to Json type for Supabase compatibility
      const payload = {
        user_id: user.id,
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        data: formData.data as unknown as import('@/integrations/supabase/types').Json,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('custom_reference_data')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Reference data updated.' });
      } else {
        const { error } = await supabase
          .from('custom_reference_data')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Success', description: 'Reference data created.' });
      }

      setIsDialogOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      console.error('Error saving custom reference data:', error);
      toast({ title: 'Error', description: 'Failed to save reference data.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reference data?')) return;

    try {
      const { error } = await supabase
        .from('custom_reference_data')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Deleted', description: 'Reference data deleted.' });
      fetchData();
    } catch (error) {
      console.error('Error deleting custom reference data:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete reference data.',
        variant: 'destructive',
      });
    }
  };

  if (subscriptionLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="w-6 h-6 text-primary" />
              Custom Reference Data
            </h1>
            <p className="text-muted-foreground">
              Store and manage your own reference data for drivers, vehicles, and more.
            </p>
          </div>
          {hasAccess && (
            <>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Reference Data
              </Button>
              <CreateCustomDataDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmit={handleSubmit}
                editingItem={editingItem}
                isSaving={isSaving}
              />
            </>
          )}
        </div>

        {/* Content */}
        {!hasAccess ? (
          <FeatureLockedCard />
        ) : isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Database className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No Custom Reference Data Yet
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Create your first custom reference data to store driver information, 
                vehicle specifications, or maintenance schedules.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Entry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Reference Data</CardTitle>
              <CardDescription>
                {data.length} item{data.length !== 1 ? 's' : ''} stored
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden sm:table-cell">Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {item.description || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

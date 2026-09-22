import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, ArrowRight, RefreshCw } from 'lucide-react';
import { useReferenceDataStats } from '@/hooks/useReferenceData';
import { categoryLabels } from '@/types/referenceData';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function ReferenceDataStatusCard() {
  const { data: stats, isLoading, refetch } = useReferenceDataStats();
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          Reference Data Status
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground">{stats?.totalRecords || 0}</p>
            <p className="text-sm text-muted-foreground">Total Records</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats?.regionCount || 0}</p>
            <p className="text-sm text-muted-foreground">Regions</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">By Category</p>
          <div className="grid grid-cols-2 gap-2">
            {stats && Object.entries(stats.categoryCounts).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground truncate">
                  {categoryLabels[key as keyof typeof categoryLabels]}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-3">
            Last updated: {stats?.lastUpdated 
              ? format(new Date(stats.lastUpdated), 'MMM d, yyyy HH:mm')
              : 'Never'}
          </p>
          <Link to="/dashboard/donnees-ref">
            <Button variant="outline" size="sm" className="w-full gap-2">
              Manage Reference Data
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

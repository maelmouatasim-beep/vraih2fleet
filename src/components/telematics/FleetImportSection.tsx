import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, CheckSquare, Square, AlertTriangle, CheckCircle2, Gauge, Calculator, Wrench, Database } from "lucide-react";
import { toast } from "sonner";
import { MockVehicle, generateMockFleet } from "@/lib/mockTelematicsData";
import { parseProviderFleet } from "@/lib/telematicsParser";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";

interface FleetImportSectionProps {
  provider: string;
  connectionId?: string;
  /** Connexion active : les identifiants restent côté serveur (chiffrés). */
  connected?: boolean;
  onVehiclesImported: (vehicles: MockVehicle[]) => void;
  onAnalyze: (selectedVehicles: MockVehicle[]) => void;
  isDemoMode?: boolean;
  onSessionExpired?: () => void;
}

const FleetImportSection = ({ 
  provider, 
  connectionId, 
  connected, 
  onVehiclesImported, 
  onAnalyze,
  isDemoMode = false,
  onSessionExpired
}: FleetImportSectionProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingToDB, setIsSavingToDB] = useState(false);
  const [vehicles, setVehicles] = useState<MockVehicle[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [vehicleCount, setVehicleCount] = useState(50);
  const [useMockData, setUseMockData] = useState(false);
  const [importSource, setImportSource] = useState<'real' | 'mock' | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    
    let importedVehicles: MockVehicle[] = [];
    let source: 'real' | 'mock' = 'mock';
    
    // In demo mode or with mock toggle, use mock data directly
    const shouldUseMockData = isDemoMode || useMockData || !connected;
    
    if (!shouldUseMockData) {
      try {
        toast.info(t('pages.telematics.import.fetchingReal', { 
          provider: provider.charAt(0).toUpperCase() + provider.slice(1) 
        }));
        
        const { data, error } = await supabase.functions.invoke('fetch-telematics-vehicles', {
          body: { provider },
        });

        if (error) {
          console.error('Edge function error:', error);
          throw new Error(error.message || 'API call failed');
        }

        // Check for session expiration
        if (data?.requiresReauth || data?.error === 'SESSION_EXPIRED') {
          toast.error(t('telematics.reauth.sessionExpired'));
          onSessionExpired?.();
          setIsImporting(false);
          return;
        }

        if (data?.success && data?.vehicles?.length > 0) {
          // Parse the vehicles from the API response
          importedVehicles = parseProviderFleet(provider, data.vehicles);
          source = 'real';
          
          toast.success(t('pages.telematics.import.realDataSuccess', { 
            count: importedVehicles.length,
            provider: provider.charAt(0).toUpperCase() + provider.slice(1)
          }));
        } else {
          throw new Error(data?.error || 'No vehicles returned');
        }
      } catch (error) {
        // Phase 2c : PLUS JAMAIS de bascule silencieuse vers une flotte
        // factice. Un échec d'API est un échec, point — le mode démo est
        // un choix explicite de l'utilisateur, jamais un repli.
        console.error('Real API import failed:', error);
        toast.error(t('pages.telematics.import.apiError'), {
          description: error instanceof Error ? error.message : undefined,
        });
        setIsImporting(false);
        return;
      }
    }

    // Mode démo EXPLICITE seulement (interrupteur ou compte démo)
    if (shouldUseMockData) {
      const count = Math.min(500, Math.max(10, vehicleCount));
      importedVehicles = generateMockFleet(count);
      source = 'mock';
      toast.success(t('pages.telematics.import.success'), {
        description: t('pages.telematics.import.successDesc', { count: importedVehicles.length }),
      });
    }
    
    setVehicles(importedVehicles);
    setSelectedIds(new Set(importedVehicles.map(v => v.id)));
    setImportSource(source);
    setSavedToDb(false);
    onVehiclesImported(importedVehicles);
    
    // Persist vehicles to database if real import and user authenticated
    if (source === 'real' && user && connectionId) {
      await persistVehiclesToDatabase(importedVehicles);
    }
    
    setIsImporting(false);
  };

  const persistVehiclesToDatabase = async (vehiclesToSave: MockVehicle[]) => {
    if (!user || !connectionId) return;
    
    setIsSavingToDB(true);
    try {
      const vehicleRecords = vehiclesToSave.map(v => ({
        connection_id: connectionId,
        user_id: user.id,
        external_id: v.externalId,
        vehicle_type: v.vehicleType,
        make_model: v.makeModel,
        vin: v.vin || null,
        make: v.make || null,
        model: v.model || null,
        model_year: v.modelYear || null,
        annual_km: v.annualKm,
        fuel_consumption: v.fuelConsumption,
        consumption_source: v.consumptionSource ?? 'estimation',
        route_type: v.routeType,
        daily_km: v.dailyKm,
        has_real_odometer: v.hasRealOdometer || false,
        current_odometer: v.currentOdometer || null,
      }));

      const { error } = await supabase
        .from('telematics_vehicles')
        .upsert(vehicleRecords, { 
          onConflict: 'external_id,user_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;
      
      setSavedToDb(true);
      toast.success(t('pages.telematics.import.savedToDb', { count: vehiclesToSave.length }));
    } catch (error) {
      console.error('Error saving vehicles to database:', error);
      toast.error(t('pages.telematics.import.saveDbError'));
    } finally {
      setIsSavingToDB(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(vehicles.map(v => v.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedVehicles = vehicles.filter(v => selectedIds.has(v.id));

  if (vehicles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            {t('pages.telematics.import.title')}
          </CardTitle>
          <CardDescription>
            {t('pages.telematics.import.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
        {importSource === 'mock' && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            {t('pages.telematics.import.demoBanner')}
          </div>
        )}
          {/* Admin-only Test Mode */}
          {isAdmin && (
            <Card className="border-dashed border-orange-400 bg-orange-50/50 dark:bg-orange-950/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-orange-600 border-orange-400">
                    <Wrench className="w-3 h-3 mr-1" />
                    Admin Only
                  </Badge>
                  <CardTitle className="text-sm font-medium">{t('telematics.testMode.title', 'Test Mode')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="useMockData" className="text-sm font-medium">
                      {t('telematics.testMode.useSimulated', 'Use simulated fleet data')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('telematics.testMode.description', 'Generate mock vehicles for testing purposes')}
                    </p>
                  </div>
                  <Switch
                    id="useMockData"
                    checked={useMockData}
                    onCheckedChange={setUseMockData}
                    disabled={isImporting}
                  />
                </div>

                {useMockData && (
                  <div className="space-y-2">
                    <Label htmlFor="vehicleCount" className="text-sm">
                      {t('pages.telematics.import.vehicleCountLabel')}
                    </Label>
                    <Input
                      id="vehicleCount"
                      type="number"
                      min={10}
                      max={500}
                      value={vehicleCount}
                      onChange={(e) => setVehicleCount(parseInt(e.target.value) || 50)}
                      className="w-32"
                      disabled={isImporting}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('pages.telematics.import.vehicleCountHint')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button onClick={handleImport} disabled={isImporting} className="w-full sm:w-auto">
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {useMockData 
                  ? t('pages.telematics.import.importing') 
                  : t('pages.telematics.import.fetchingReal', { provider: provider.charAt(0).toUpperCase() + provider.slice(1) })}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {t('pages.telematics.import.button', { provider: provider.charAt(0).toUpperCase() + provider.slice(1) })}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('pages.telematics.import.importedVehicles')}</CardTitle>
            <CardDescription>
              {t('pages.telematics.import.selectVehicles')}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {savedToDb && (
              <Badge variant="outline" className="flex items-center gap-1 border-primary/50 text-primary">
                <Database className="w-3 h-3" />
                {t('pages.telematics.import.savedToDbBadge')}
              </Badge>
            )}
            {isSavingToDB && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('pages.telematics.import.savingToDb')}
              </Badge>
            )}
            {importSource && (
              <Badge 
                variant={importSource === 'real' ? 'default' : 'destructive'}
                className="flex items-center gap-1"
              >
                {importSource === 'real' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    {t('pages.telematics.import.sourceReal')}
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    {t('pages.telematics.import.sourceMock')}
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={selectAll}>
            <CheckSquare className="w-4 h-4 mr-2" />
            {t('pages.telematics.import.selectAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            <Square className="w-4 h-4 mr-2" />
            {t('pages.telematics.import.deselectAll')}
          </Button>
          <Badge variant="secondary">
            {t('pages.telematics.import.selected', { count: selectedIds.size })}
          </Badge>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>{t('pages.telematics.import.columns.vehicleId')}</TableHead>
                <TableHead>{t('pages.telematics.import.columns.type')}</TableHead>
                <TableHead>{t('pages.telematics.import.columns.makeModel')}</TableHead>
                <TableHead className="text-right">{t('pages.telematics.import.columns.annualKm')}</TableHead>
                <TableHead className="text-right">{t('pages.telematics.import.columns.fuelConsumption')}</TableHead>
                <TableHead>{t('pages.telematics.import.columns.routeType')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(vehicle.id)}
                      onCheckedChange={() => toggleSelect(vehicle.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{vehicle.externalId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{vehicle.vehicleType}</Badge>
                  </TableCell>
                  <TableCell>{vehicle.makeModel}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span>{vehicle.annualKm.toLocaleString()}</span>
                      {vehicle.hasRealOdometer ? (
                        <span title={t('pages.telematics.import.realOdometer')} className="text-green-600">
                          <Gauge className="w-4 h-4" />
                        </span>
                      ) : (
                        <span title={t('pages.telematics.import.estimatedKm')} className="text-muted-foreground">
                          <Calculator className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{vehicle.fuelConsumption} L/100km</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        vehicle.routeType === 'Urban' ? 'default' :
                        vehicle.routeType === 'Regional' ? 'secondary' : 'destructive'
                      }
                    >
                      {vehicle.routeType}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={() => onAnalyze(selectedVehicles)} 
            disabled={selectedIds.size === 0}
          >
            {t('pages.telematics.import.analyze')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FleetImportSection;

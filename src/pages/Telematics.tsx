import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plug, Shield, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw, Clock, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTelematicsAuth } from "@/hooks/useTelematicsAuth";
import FleetImportSection from "@/components/telematics/FleetImportSection";
import VehicleGroupsSection from "@/components/telematics/VehicleGroupsSection";
import FleetAnalyticsSection from "@/components/telematics/FleetAnalyticsSection";
import ScenarioRecommendationsSection from "@/components/telematics/ScenarioRecommendationsSection";
import ReauthDialog from "@/components/telematics/ReauthDialog";
import ReconciliationCard from "@/components/telematics/ReconciliationCard";
import { MockVehicle, VehicleGroup, groupVehicles, generateScenarioRecommendations, ScenarioRecommendation } from "@/lib/mockTelematicsData";

type Provider = 'geotab' | 'samsara';

interface TelematicsConnection {
  id: string;
  provider: string;
  database: string | null;
  username: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
  encrypted_credentials: string;
}

const Telematics = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { 
    reauthState, 
    isReauthenticating, 
    promptReauth, 
    dismissReauth, 
    reauthenticate 
  } = useTelematicsAuth();
  
  const [provider, setProvider] = useState<Provider>('geotab');
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connection, setConnection] = useState<TelematicsConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Fleet data states
  const [importedVehicles, setImportedVehicles] = useState<MockVehicle[]>([]);
  const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
  const [scenarioRecommendations, setScenarioRecommendations] = useState<ScenarioRecommendation[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const isFormComplete = provider === 'samsara' 
    ? username.trim() !== "" && password.trim() !== ""
    : database.trim() !== "" && username.trim() !== "" && password.trim() !== "";

  useEffect(() => {
    fetchConnection();
  }, [user]);

  const fetchConnection = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('telematics_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .maybeSingle();

      if (error) throw error;
      setConnection(data);
    } catch (error) {
      console.error('Error fetching connection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('authenticate-telematics', {
        body: { provider, database, username, password }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('telematics.testSuccess'));
      } else {
        toast.error(data.error || t('telematics.testFailed'));
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      toast.error(error.message || t('telematics.testFailed'));
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!user) return;
    
    setIsConnecting(true);
    try {
      const { data: authData, error: authError } = await supabase.functions.invoke('authenticate-telematics', {
        body: { provider, database, username, password }
      });

      if (authError) throw authError;

      if (!authData.success) {
        toast.error(authData.error || t('telematics.connectionFailed'));
        return;
      }

      const { data, error } = await supabase
        .from('telematics_connections')
        .upsert({
          user_id: user.id,
          provider,
          database: provider === 'geotab' ? database : null,
          username,
          encrypted_credentials: authData.credentials,
          status: 'connected',
          last_sync_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,provider'
        })
        .select()
        .single();

      if (error) throw error;

      setConnection(data);
      toast.success(t('telematics.connectionSuccess'));
      setPassword("");
    } catch (error: any) {
      console.error('Connection error:', error);
      toast.error(error.message || t('telematics.connectionFailed'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;

    try {
      const { error } = await supabase
        .from('telematics_connections')
        .update({ status: 'disconnected' })
        .eq('id', connection.id);

      if (error) throw error;

      setConnection(null);
      setImportedVehicles([]);
      setVehicleGroups([]);
      setScenarioRecommendations([]);
      setHasAnalyzed(false);
      toast.success(t('telematics.disconnected'));
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error(error.message);
    }
  };

  const handleManualSync = async () => {
    if (!connection) return;
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-telematics-data', {
        body: { connectionId: connection.id }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(t('telematics.syncSuccess'), {
          description: t('telematics.syncSuccessDesc', { count: data.vehiclesUpdated })
        });
        
        // Update connection's last sync time
        setConnection(prev => prev ? {
          ...prev,
          last_sync_at: new Date().toISOString()
        } : null);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(t('telematics.syncFailed'), {
        description: error.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVehiclesImported = (vehicles: MockVehicle[]) => {
    setImportedVehicles(vehicles);
  };

  const handleSessionExpired = () => {
    if (connection) {
      promptReauth(connection, () => {
        // Retry import after successful reauth
        toast.info(t('telematics.reauth.retryImport'));
      });
    }
  };

  const handleExitDemo = () => {
    setIsDemoMode(false);
    setImportedVehicles([]);
    setVehicleGroups([]);
    setScenarioRecommendations([]);
    setHasAnalyzed(false);
  };

  const handleAnalyze = (selectedVehicles: MockVehicle[]) => {
    const groups = groupVehicles(selectedVehicles);
    setVehicleGroups(groups);
    
    const recommendations = generateScenarioRecommendations(selectedVehicles);
    setScenarioRecommendations(recommendations);
    
    setHasAnalyzed(true);
    
    toast.success(t('telematics.analysisComplete'));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plug className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('telematics.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('telematics.subtitle')}</p>
          </div>
        </div>

        {/* Connection Card */}
        {connection ? (
          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {t('telematics.connected')}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({connection.provider.charAt(0).toUpperCase() + connection.provider.slice(1)})
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {connection.username}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('telematics.lastSync')}</span>
                <span>
                  {connection.last_sync_at 
                    ? new Date(connection.last_sync_at).toLocaleString()
                    : t('common.never')}
                </span>
              </div>
              
              {/* Auto-sync indicator */}
              <div className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('telematics.autoSync')}</span>
                </div>
                <span className="text-xs text-muted-foreground">{t('telematics.autoSyncTime')}</span>
              </div>

              {connection.database && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('telematics.geotab.database')}</span>
                  <span>{connection.database}</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex-1"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('telematics.syncing')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t('telematics.syncNow')}
                    </>
                  )}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnect}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {t('telematics.disconnect')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plug className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('telematics.geotab.title')}</CardTitle>
                  <CardDescription>{t('telematics.geotab.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">{t('telematics.provider')}</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geotab">Geotab</SelectItem>
                    <SelectItem value="samsara">Samsara</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {provider === 'geotab' && (
                <div className="space-y-2">
                  <Label htmlFor="database">{t('telematics.geotab.database')}</Label>
                  <Input
                    id="database"
                    type="text"
                    placeholder="my_database"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">
                  {provider === 'samsara' ? t('telematics.samsara.accountEmail') : t('telematics.geotab.username')}
                </Label>
                <Input
                  id="username"
                  type="email"
                  placeholder="user@company.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {provider === 'samsara' ? t('telematics.samsara.apiToken') : t('telematics.geotab.password')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={!isFormComplete || isTesting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('telematics.geotab.testConnection')
                  )}
                </Button>
                <Button
                  onClick={handleConnect}
                  disabled={!isFormComplete || isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('telematics.geotab.connect')
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                <Shield className="w-4 h-4" />
                <span>{t('telematics.geotab.securityNote')}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fleet Import Section - Show when connected OR in demo mode */}
        {(connection || isDemoMode) && (
          <>
            {isDemoMode && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                <Play className="h-4 w-4 text-blue-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{t('telematics.demoBanner')}</span>
                  <Button variant="ghost" size="sm" onClick={handleExitDemo}>
                    {t('telematics.exitDemo')}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <FleetImportSection
              provider={connection?.provider || 'demo'}
              connectionId={connection?.id}
              encryptedCredentials={connection?.encrypted_credentials}
              onVehiclesImported={handleVehiclesImported}
              onAnalyze={handleAnalyze}
              isDemoMode={isDemoMode}
              onSessionExpired={handleSessionExpired}
            />
          </>
        )}

        {/* Reconciliation Card - Show when connected and has analyzed */}
        {connection && hasAnalyzed && (
          <ReconciliationCard />
        )}

        {/* Analysis Results - Only show after analysis */}
        {hasAnalyzed && importedVehicles.length > 0 && (
          <>
                        <VehicleGroupsSection groups={vehicleGroups} />
            <FleetAnalyticsSection vehicles={importedVehicles} />
            <ScenarioRecommendationsSection 
              recommendations={scenarioRecommendations} 
              totalVehicles={importedVehicles.length}
            />
          </>
        )}

        {/* Empty State when not connected and not in demo mode */}
        {!connection && !isDemoMode && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('telematics.emptyState.title')}</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                {t('telematics.emptyState.description')}
              </p>
              <Button onClick={() => setIsDemoMode(true)} variant="outline">
                <Play className="w-4 h-4 mr-2" />
                {t('telematics.tryDemo')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Reauth Dialog */}
      <ReauthDialog
        isOpen={reauthState.isRequired}
        provider={reauthState.connection?.provider || 'geotab'}
        username={reauthState.connection?.username || ''}
        database={reauthState.connection?.database}
        isLoading={isReauthenticating}
        onReauth={reauthenticate}
        onClose={dismissReauth}
      />
    </DashboardLayout>
  );
};

export default Telematics;

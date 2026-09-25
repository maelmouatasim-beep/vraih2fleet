import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Key,
  Copy,
  Check,
  Plus,
  MoreHorizontal,
  Pencil,
  Ban,
  Trash2,
  Loader2,
  Clock,
  Shield,
  Zap,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import WebhooksManagement from "@/components/api/WebhooksManagement";
import ScopesSelector from "@/components/api/ScopesSelector";

interface ApiKey {
  id: string;
  key_name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

// Generate a cryptographically secure random string
const generateSecureKey = (): string => {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const base64 = btoa(String.fromCharCode(...array));
  // Make URL-safe and remove padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

// Simple hash function (in production, use bcrypt on the server)
const hashKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const ApiKeyManagement = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Form states
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [editKeyName, setEditKeyName] = useState("");
  const [copied, setCopied] = useState(false);

  // Load API keys
  useEffect(() => {
    loadApiKeys();
  }, [user]);

  const loadApiKeys = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setApiKeys(data || []);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: t('apiKeys.toast.error'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!user || !newKeyName.trim()) return;
    
    setIsGenerating(true);
    try {
      // Generate the key
      const rawKey = `h2f_${generateSecureKey()}`;
      // 12 caractères, aligné avec l'indicatif attendu côté gateway
      const keyPrefix = rawKey.substring(0, 12);
      const keyHash = await hashKey(rawKey);
      
      // Save to database
      const { error } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          key_name: newKeyName.trim(),
          key_hash: keyHash,
          key_prefix: keyPrefix,
        });
      
      if (error) throw error;
      
      // Show success modal with the key
      setGeneratedKey(rawKey);
      setShowGenerateModal(false);
      setShowSuccessModal(true);
      setNewKeyName("");
      
      // Reload keys
      loadApiKeys();
      
      toast({
        title: t('apiKeys.toast.generated'),
      });
    } catch (error) {
      console.error('Error generating API key:', error);
      toast({
        title: t('apiKeys.toast.errorGenerating'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    toast({
      title: t('apiKeys.toast.copied'),
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRename = async () => {
    if (!selectedKey || !editKeyName.trim()) return;
    
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ key_name: editKeyName.trim() })
        .eq('id', selectedKey.id);
      
      if (error) throw error;
      
      setShowRenameModal(false);
      setSelectedKey(null);
      setEditKeyName("");
      loadApiKeys();
      
      toast({
        title: t('apiKeys.toast.renamed'),
      });
    } catch (error) {
      console.error('Error renaming API key:', error);
      toast({
        title: t('apiKeys.toast.errorRenaming'),
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: !key.is_active })
        .eq('id', key.id);
      
      if (error) throw error;
      
      loadApiKeys();
      
      toast({
        title: key.is_active ? t('apiKeys.toast.revoked') : t('apiKeys.toast.activated'),
      });
    } catch (error) {
      console.error('Error updating API key:', error);
      toast({
        title: t('apiKeys.toast.errorRevoking'),
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async () => {
    if (!selectedKey) return;
    
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', selectedKey.id);
      
      if (error) throw error;
      
      setShowRevokeDialog(false);
      setSelectedKey(null);
      loadApiKeys();
      
      toast({
        title: t('apiKeys.toast.revoked'),
      });
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast({
        title: t('apiKeys.toast.errorRevoking'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedKey) return;
    
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', selectedKey.id);
      
      if (error) throw error;
      
      setShowDeleteDialog(false);
      setSelectedKey(null);
      loadApiKeys();
      
      toast({
        title: t('apiKeys.toast.deleted'),
      });
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast({
        title: t('apiKeys.toast.errorDeleting'),
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('apiKeys.title')}</h1>
          <p className="text-muted-foreground">{t('apiKeys.subtitle')}</p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('apiKeys.generateNew')}
        </Button>
      </div>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t('apiKeys.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('apiKeys.noKeys')}</h3>
              <p className="text-muted-foreground mb-4">{t('apiKeys.noKeysDescription')}</p>
              <Button onClick={() => setShowGenerateModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('apiKeys.generateNew')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('apiKeys.table.name')}</TableHead>
                  <TableHead>{t('apiKeys.table.keyPrefix')}</TableHead>
                  <TableHead>{t('apiKeys.table.created')}</TableHead>
                  <TableHead>{t('apiKeys.table.lastUsed')}</TableHead>
                  <TableHead>{t('apiKeys.table.status')}</TableHead>
                  <TableHead className="text-right">{t('apiKeys.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.key_name}</TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-sm">
                        {key.key_prefix}...
                      </code>
                    </TableCell>
                    <TableCell>{formatDate(key.created_at)}</TableCell>
                    <TableCell>
                      {key.last_used_at ? formatDate(key.last_used_at) : (
                        <span className="text-muted-foreground">{t('apiKeys.table.never')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {key.is_active ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('apiKeys.status.active')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <Ban className="h-3 w-3 mr-1" />
                          {t('apiKeys.status.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedKey(key);
                              setEditKeyName(key.key_name);
                              setShowRenameModal(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            {t('apiKeys.actions.rename')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(key)}
                          >
                            {key.is_active ? (
                              <>
                                <Ban className="h-4 w-4 mr-2" />
                                {t('apiKeys.actions.revoke')}
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {t('apiKeys.actions.activate')}
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedKey(key);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('apiKeys.actions.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Rate Limits Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('apiKeys.rateLimit.title')}
          </CardTitle>
          <CardDescription>{t('apiKeys.rateLimit.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 bg-muted rounded-lg text-center">
              <Zap className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-lg font-semibold">{t('apiKeys.rateLimit.requests')}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-lg font-semibold">{t('apiKeys.rateLimit.burst')}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <Shield className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-lg font-semibold">TLS 1.3</p>
              <p className="text-sm text-muted-foreground">Encryption</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t('apiKeys.documentation.title')}
          </CardTitle>
          <CardDescription>{t('apiKeys.documentation.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="javascript">
            <TabsList className="mb-4">
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="javascript">
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                <code>{`const response = await fetch('https://api.h2fleet.com/v1/scenarios', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My Scenario',
    region: 'CA_QC',
    fleetComposition: { diesel: 10, ev: 5, hydrogen: 2 }
  })
});

const result = await response.json();`}</code>
              </pre>
            </TabsContent>
            <TabsContent value="python">
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                <code>{`import requests

response = requests.post(
    'https://api.h2fleet.com/v1/scenarios',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'name': 'My Scenario',
        'region': 'US_CA',
        'fleetComposition': {'diesel': 10, 'ev': 5, 'hydrogen': 2}
    }
)

result = response.json()`}</code>
              </pre>
            </TabsContent>
            <TabsContent value="curl">
              <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                <code>{`curl -X POST 'https://api.h2fleet.com/v1/scenarios' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -d '{"name": "My Scenario", "region": "US_CA", "fleetComposition": {"diesel": 10, "ev": 5, "hydrogen": 2}}'`}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Generate Key Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('apiKeys.modal.generateTitle')}</DialogTitle>
            <DialogDescription>{t('apiKeys.modal.generateDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">{t('apiKeys.modal.keyName')}</Label>
              <Input
                id="keyName"
                placeholder={t('apiKeys.modal.keyNamePlaceholder')}
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
              {t('apiKeys.modal.cancel')}
            </Button>
            <Button onClick={handleGenerateKey} disabled={!newKeyName.trim() || isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('apiKeys.modal.generating')}
                </>
              ) : (
                t('apiKeys.modal.generate')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal (Show Key Once) */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              {t('apiKeys.modal.successTitle')}
            </DialogTitle>
            <DialogDescription>{t('apiKeys.modal.successDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg font-mono text-sm break-all">
              <span className="flex-1">{generatedKey}</span>
              <Button variant="ghost" size="icon" onClick={handleCopyKey}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {t('apiKeys.modal.warning')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCopyKey} variant="outline" className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('apiKeys.modal.copied') : t('apiKeys.modal.copyKey')}
            </Button>
            <Button onClick={() => {
              setShowSuccessModal(false);
              setGeneratedKey("");
            }}>
              {t('apiKeys.modal.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('apiKeys.modal.renameTitle')}</DialogTitle>
            <DialogDescription>{t('apiKeys.modal.renameDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editKeyName">{t('apiKeys.modal.keyName')}</Label>
              <Input
                id="editKeyName"
                value={editKeyName}
                onChange={(e) => setEditKeyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameModal(false)}>
              {t('apiKeys.modal.cancel')}
            </Button>
            <Button onClick={handleRename} disabled={!editKeyName.trim()}>
              {t('apiKeys.modal.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('apiKeys.modal.revokeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('apiKeys.modal.revokeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('apiKeys.modal.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('apiKeys.modal.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('apiKeys.modal.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('apiKeys.modal.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('apiKeys.modal.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('apiKeys.actions.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const ApiDocumentation = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <ApiKeyManagement />
        <WebhooksManagement />
      </div>
    </DashboardLayout>
  );
};

export default ApiDocumentation;
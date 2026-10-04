import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Webhook,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  History,
  Send,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WebhookRecord {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  event_type: string;
  success: boolean;
  response_status: number | null;
  delivered_at: string;
}

const AVAILABLE_EVENTS = [
  { id: "tco.calculated", label: "TCO Calculated", description: "When a TCO calculation completes" },
  { id: "scenario.created", label: "Scenario Created", description: "When a new scenario is created" },
  { id: "scenario.updated", label: "Scenario Updated", description: "When a scenario is modified" },
];

// Generate a secure secret for webhooks
const generateSecret = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

const WebhooksManagement = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form states
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookRecord | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    loadWebhooks();
  }, [user]);

  const loadWebhooks = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error('Error loading webhooks:', error);
      toast({
        title: "Error loading webhooks",
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !formName.trim() || !formUrl.trim() || formEvents.length === 0) return;

    setIsSaving(true);
    try {
      const secret = generateSecret();
      
      const { error } = await supabase
        .from('webhooks')
        .insert({
          user_id: user.id,
          name: formName.trim(),
          url: formUrl.trim(),
          events: formEvents,
          secret,
        });

      if (error) throw error;

      setShowCreateModal(false);
      resetForm();
      loadWebhooks();

      toast({
        title: "Webhook created",
        description: "Your webhook endpoint has been configured.",
      });
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Error creating webhook",
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedWebhook || !formName.trim() || !formUrl.trim() || formEvents.length === 0) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('webhooks')
        .update({
          name: formName.trim(),
          url: formUrl.trim(),
          events: formEvents,
        })
        .eq('id', selectedWebhook.id);

      if (error) throw error;

      setShowEditModal(false);
      setSelectedWebhook(null);
      resetForm();
      loadWebhooks();

      toast({
        title: "Webhook updated",
      });
    } catch (error) {
      console.error('Error updating webhook:', error);
      toast({
        title: "Error updating webhook",
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWebhook) return;

    try {
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', selectedWebhook.id);

      if (error) throw error;

      setShowDeleteDialog(false);
      setSelectedWebhook(null);
      loadWebhooks();

      toast({
        title: "Webhook deleted",
      });
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast({
        title: "Error deleting webhook",
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (webhook: WebhookRecord) => {
    try {
      const { error } = await supabase
        .from('webhooks')
        .update({ is_active: !webhook.is_active })
        .eq('id', webhook.id);

      if (error) throw error;
      loadWebhooks();

      toast({
        title: webhook.is_active ? "Webhook disabled" : "Webhook enabled",
      });
    } catch (error) {
      console.error('Error toggling webhook:', error);
      toast({
        title: "Error updating webhook",
        variant: 'destructive',
      });
    }
  };

  const loadDeliveries = async (webhookId: string) => {
    try {
      const { data, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('delivered_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setDeliveries(data || []);
    } catch (error) {
      console.error('Error loading deliveries:', error);
    }
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast({ title: "Secret copied" });
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormEvents([]);
  };

  const openEditModal = (webhook: WebhookRecord) => {
    setSelectedWebhook(webhook);
    setFormName(webhook.name);
    setFormUrl(webhook.url);
    setFormEvents(webhook.events);
    setShowEditModal(true);
  };

  const openHistoryModal = async (webhook: WebhookRecord) => {
    setSelectedWebhook(webhook);
    await loadDeliveries(webhook.id);
    setShowHistoryModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleEvent = (eventId: string) => {
    setFormEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks
          </h2>
          <p className="text-muted-foreground text-sm">
            Receive real-time notifications when events occur in your account.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* Webhooks Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
              <p className="text-muted-foreground mb-4">
                Set up a webhook to receive notifications when events occur.
              </p>
              <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Webhook
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px] block">
                        {webhook.url}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map(event => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.is_active ? (
                        webhook.failure_count > 3 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Failing
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {webhook.last_triggered_at ? (
                        <span className="text-sm">{formatDate(webhook.last_triggered_at)}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
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
                          <DropdownMenuItem onClick={() => openEditModal(webhook)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openHistoryModal(webhook)}>
                            <History className="h-4 w-4 mr-2" />
                            View History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copySecret(webhook.secret)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Secret
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(webhook)}>
                            {webhook.is_active ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Disable
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Enable
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedWebhook(webhook);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to receive event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhookName">Name</Label>
              <Input
                id="webhookName"
                placeholder="My Webhook"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Endpoint URL</Label>
              <Input
                id="webhookUrl"
                placeholder="https://your-server.com/webhook"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Events to Subscribe</Label>
              {AVAILABLE_EVENTS.map(event => (
                <div key={event.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={event.id}
                    checked={formEvents.includes(event.id)}
                    onCheckedChange={() => toggleEvent(event.id)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor={event.id} className="text-sm font-medium cursor-pointer">
                      {event.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!formName.trim() || !formUrl.trim() || formEvents.length === 0 || isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>
              Update your webhook configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editWebhookName">Name</Label>
              <Input
                id="editWebhookName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editWebhookUrl">Endpoint URL</Label>
              <Input
                id="editWebhookUrl"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Events to Subscribe</Label>
              {AVAILABLE_EVENTS.map(event => (
                <div key={event.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={`edit-${event.id}`}
                    checked={formEvents.includes(event.id)}
                    onCheckedChange={() => toggleEvent(event.id)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label htmlFor={`edit-${event.id}`} className="text-sm font-medium cursor-pointer">
                      {event.label}
                    </label>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditModal(false); resetForm(); setSelectedWebhook(null); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!formName.trim() || !formUrl.trim() || formEvents.length === 0 || isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Delivery History
            </DialogTitle>
            <DialogDescription>
              Recent webhook deliveries for "{selectedWebhook?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-auto">
            {deliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No deliveries yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>
                        <Badge variant="outline">{delivery.event_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {delivery.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {delivery.response_status || "N/A"}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(delivery.delivered_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowHistoryModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WebhooksManagement;

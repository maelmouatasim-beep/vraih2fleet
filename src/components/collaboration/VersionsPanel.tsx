import { useState } from "react";
import { useTranslation } from "react-i18next";
import { History, Plus, RotateCcw, Eye, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/hooks/use-toast";
import { useProjectVersions } from "@/hooks/useProjectVersions";
import { useProjectCollaborators } from "@/hooks/useProjectCollaborators";

interface VersionsPanelProps {
  projectId: string;
}

export function VersionsPanel({ projectId }: VersionsPanelProps) {
  const { t, i18n } = useTranslation();
  const { versions, isLoading, createVersion, restoreVersion, deleteVersion } =
    useProjectVersions(projectId);
  const { canEdit } = useProjectCollaborators(projectId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const dateLocale = i18n.language === "fr" ? fr : enUS;

  const handleCreate = async () => {
    if (!versionName.trim()) return;

    setIsCreating(true);
    try {
      await createVersion(versionName, versionNote || undefined);
      setIsCreateOpen(false);
      setVersionName("");
      setVersionNote("");
      toast({
        title: t("collaboration.versions.created", "Version créée"),
        description: t(
          "collaboration.versions.createdDesc",
          "La version a été sauvegardée avec succès."
        ),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;

    try {
      await restoreVersion(restoreTarget);
      toast({
        title: t("collaboration.versions.restored", "Version restaurée"),
        description: t(
          "collaboration.versions.restoredDesc",
          "Le projet a été restauré à la version sélectionnée."
        ),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRestoreTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteVersion(deleteTarget);
      toast({
        title: t("collaboration.versions.deleted", "Version supprimée"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <History className="w-4 h-4" />
        <span>{t("collaboration.versions.loading", "Chargement...")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <History className="w-4 h-4" />
          {t("collaboration.versions.title", "Historique des versions")}
        </h4>
        {canEdit && (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("collaboration.versions.create", "Créer une version")}
          </Button>
        )}
      </div>

      {/* Versions list */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t("collaboration.versions.empty", "Aucune version sauvegardée")}</p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("collaboration.versions.createFirst", "Créer la première version")}
              </Button>
            )}
          </div>
        ) : (
          versions.map((version, index) => (
            <div key={version.id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={version.profile?.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(version.profile?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{version.versionName}</span>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {t("collaboration.versions.current", "actuel")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {version.profile?.fullName || t("collaboration.versions.unknown", "Inconnu")} •{" "}
                      {format(new Date(version.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: dateLocale,
                      })}
                    </div>
                    {version.versionNote && (
                      <p className="text-sm text-muted-foreground mt-1">{version.versionNote}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-1">
                  {canEdit && index !== 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRestoreTarget(version.id)}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      {t("collaboration.versions.restore", "Restaurer")}
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(version.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create version dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("collaboration.versions.createTitle", "Créer une version")}</DialogTitle>
            <DialogDescription>
              {t(
                "collaboration.versions.createDesc",
                "Sauvegardez l'état actuel du projet pour pouvoir y revenir plus tard."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("collaboration.versions.name", "Nom de la version")}
              </label>
              <Input
                placeholder={t("collaboration.versions.namePlaceholder", "ex: v1.0 - Version initiale")}
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("collaboration.versions.note", "Note (optionnel)")}
              </label>
              <Textarea
                placeholder={t(
                  "collaboration.versions.notePlaceholder",
                  "Décrivez les changements principaux..."
                )}
                value={versionNote}
                onChange={(e) => setVersionNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t("common.cancel", "Annuler")}
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !versionName.trim()}>
              {t("collaboration.versions.create", "Créer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={() => setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("collaboration.versions.restoreConfirm", "Restaurer cette version ?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "collaboration.versions.restoreConfirmDesc",
                "L'état actuel sera sauvegardé automatiquement avant la restauration."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              {t("collaboration.versions.restore", "Restaurer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("collaboration.versions.deleteConfirm", "Supprimer cette version ?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "collaboration.versions.deleteConfirmDesc",
                "Cette action est irréversible."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {t("common.delete", "Supprimer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

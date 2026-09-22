import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, X, Crown, Pencil, Eye, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useProjectCollaborators, type ProjectRole, type Collaborator } from "@/hooks/useProjectCollaborators";
import { useAuth } from "@/hooks/useAuth";

interface CollaboratorsPanelProps {
  projectId: string;
}

const roleIcons = {
  owner: Crown,
  editor: Pencil,
  viewer: Eye,
};

const roleColors = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  editor: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  viewer: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

export function CollaboratorsPanel({ projectId }: CollaboratorsPanelProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    collaborators,
    isLoading,
    canManageCollaborators,
    inviteCollaborator,
    removeCollaborator,
    updateCollaboratorRole,
  } = useProjectCollaborators(projectId);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ProjectRole>("viewer");
  const [isInviting, setIsInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Collaborator | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const result = await inviteCollaborator(inviteEmail, inviteRole);
      
      if (result.type === "added") {
        toast({
          title: t("collaboration.collaborators.added", "Collaborateur ajouté"),
          description: t(
            "collaboration.collaborators.addedDesc",
            "L'utilisateur a été ajouté au projet."
          ),
        });
      } else {
        toast({
          title: t("collaboration.collaborators.inviteSent", "Invitation envoyée"),
          description: t(
            "collaboration.collaborators.inviteSentDesc",
            "Un email d'invitation a été envoyé. L'utilisateur sera ajouté automatiquement à la création de son compte."
          ),
        });
      }
      setInviteEmail("");
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;

    try {
      await removeCollaborator(removeTarget.id);
      toast({
        title: t("collaboration.collaborators.removed", "Collaborateur retiré"),
        description: t(
          "collaboration.collaborators.removedDesc",
          "Le collaborateur a été retiré du projet."
        ),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRemoveTarget(null);
    }
  };

  const handleRoleChange = async (collaborator: Collaborator, newRole: ProjectRole) => {
    try {
      await updateCollaboratorRole(collaborator.id, newRole);
      toast({
        title: t("collaboration.collaborators.roleChanged", "Rôle modifié"),
        description: t(
          "collaboration.collaborators.roleChangedDesc",
          "Le rôle du collaborateur a été mis à jour."
        ),
      });
    } catch (error: any) {
      toast({
        title: t("common.error", "Erreur"),
        description: error.message,
        variant: "destructive",
      });
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
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{t("collaboration.collaborators.loading", "Chargement...")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite section */}
      {canManageCollaborators && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {t("collaboration.collaborators.invite", "Inviter")}
          </h4>
          <div className="flex gap-2">
            <Input
              placeholder={t("collaboration.collaborators.invitePlaceholder", "email@example.com")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as ProjectRole)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">
                  {t("collaboration.collaborators.roles.editor", "Éditeur")}
                </SelectItem>
                <SelectItem value="viewer">
                  {t("collaboration.collaborators.roles.viewer", "Lecteur")}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
              <UserPlus className="w-4 h-4 mr-2" />
              {t("collaboration.collaborators.invite", "Inviter")}
            </Button>
          </div>
        </div>
      )}

      {/* Collaborators list */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          {t("collaboration.collaborators.title", "Collaborateurs")} ({collaborators.length})
        </h4>
        <div className="space-y-2">
          {collaborators.map((collab) => {
            const RoleIcon = roleIcons[collab.role];
            const isCurrentUser = collab.userId === user?.id;
            const isOwner = collab.role === "owner";

            return (
              <div
                key={collab.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={collab.profile?.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(collab.profile?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {collab.profile?.fullName || t("collaboration.collaborators.unknown", "Utilisateur inconnu")}
                      </span>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">
                          {t("collaboration.collaborators.you", "vous")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {canManageCollaborators && !isOwner && !isCurrentUser ? (
                    <>
                      <Select
                        value={collab.role}
                        onValueChange={(v) => handleRoleChange(collab, v as ProjectRole)}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">
                            {t("collaboration.collaborators.roles.editor", "Éditeur")}
                          </SelectItem>
                          <SelectItem value="viewer">
                            {t("collaboration.collaborators.roles.viewer", "Lecteur")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setRemoveTarget(collab)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Badge className={`${roleColors[collab.role]} gap-1`}>
                      <RoleIcon className="w-3 h-3" />
                      {t(`collaboration.collaborators.roles.${collab.role}`, collab.role)}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("collaboration.collaborators.removeConfirm", "Retirer ce collaborateur ?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "collaboration.collaborators.removeConfirmDesc",
                "Cette personne n'aura plus accès au projet."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Annuler")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              {t("collaboration.collaborators.remove", "Retirer")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

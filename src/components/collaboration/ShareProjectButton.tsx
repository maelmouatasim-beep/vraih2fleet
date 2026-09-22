import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollaboratorsPanel } from "./CollaboratorsPanel";
import { CommentsPanel } from "./CommentsPanel";
import { VersionsPanel } from "./VersionsPanel";
import { useProjectCollaborators } from "@/hooks/useProjectCollaborators";
import { useProjectComments } from "@/hooks/useProjectComments";

interface ShareProjectButtonProps {
  projectId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ShareProjectButton({
  projectId,
  variant = "outline",
  size = "default",
}: ShareProjectButtonProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { collaborators } = useProjectCollaborators(projectId);
  const { totalCount: commentCount } = useProjectComments(projectId);

  const collaboratorCount = collaborators.length;
  const hasCollaborators = collaboratorCount > 1; // More than just owner

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setIsOpen(true)} className="gap-2">
        <Users className="w-4 h-4" />
        {size !== "icon" && t("collaboration.share", "Partager")}
        {hasCollaborators && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5">
            {collaboratorCount}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              {t("collaboration.title", "Collaboration")}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="collaborators" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="collaborators" className="gap-2">
                <Users className="w-4 h-4" />
                {t("collaboration.collaborators.title", "Équipe")}
                {hasCollaborators && (
                  <Badge variant="secondary" className="h-5 px-1.5">
                    {collaboratorCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-2">
                {t("collaboration.comments.title", "Commentaires")}
                {commentCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">
                    {commentCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="versions">
                {t("collaboration.versions.title", "Versions")}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto mt-4">
              <TabsContent value="collaborators" className="mt-0">
                <CollaboratorsPanel projectId={projectId} />
              </TabsContent>
              <TabsContent value="comments" className="mt-0">
                <CommentsPanel projectId={projectId} />
              </TabsContent>
              <TabsContent value="versions" className="mt-0">
                <VersionsPanel projectId={projectId} />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
